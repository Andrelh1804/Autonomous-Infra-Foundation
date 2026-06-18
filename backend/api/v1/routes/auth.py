import uuid
import pyotp
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db
from backend.core.infrastructure.security import (
    verify_password, create_access_token, create_refresh_token, decode_token,
    create_mfa_token, decode_mfa_token, get_password_hash,
)
from backend.core.domain.models import User, UserSession
from backend.core.application.schemas import LoginRequest, TokenResponse, RefreshRequest
from backend.core.application.audit import log_action
from backend.api.v1.dependencies import get_current_user, get_client_ip

router = APIRouter(prefix="/auth", tags=["auth"])


def _create_session_and_tokens(user: User, request: Request, db: Session):
    """Create JWT tokens + DB session for a fully-authenticated user."""
    access_token = create_access_token(
        data={"sub": str(user.id), "org": user.organization_id, "super": user.is_super_admin},
    )
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    access_payload = decode_token(access_token)
    refresh_payload = decode_token(refresh_token)

    session = UserSession(
        user_id=user.id,
        token_jti=access_payload["jti"],
        refresh_token_jti=refresh_payload["jti"],
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent", "")[:512],
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db.add(session)
    user.last_login = datetime.utcnow()
    db.commit()
    return access_token, refresh_token


@router.post("/login")
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email, User.active == True).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # MFA gate — return a short-lived challenge token instead of full tokens
    if user.mfa_enabled and user.mfa_secret:
        mfa_token = create_mfa_token(user.id)
        return {"mfa_required": True, "mfa_token": mfa_token}

    access_token, refresh_token = _create_session_and_tokens(user, request, db)

    log_action(
        db, action="LOGIN", module="auth",
        user_id=user.id, user_email=user.email,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent", "")[:512],
    )
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/mfa/verify", response_model=TokenResponse)
def mfa_verify(body: dict, request: Request, db: Session = Depends(get_db)):
    mfa_token = body.get("mfa_token", "")
    code = body.get("code", "")

    payload = decode_mfa_token(mfa_token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired MFA session")

    user = db.query(User).filter(User.id == int(payload["sub"]), User.active == True).first()
    if not user or not user.mfa_enabled or not user.mfa_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="MFA not configured")

    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(code, valid_window=1):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid verification code")

    access_token, refresh_token = _create_session_and_tokens(user, request, db)

    log_action(
        db, action="LOGIN", module="auth",
        user_id=user.id, user_email=user.email,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent", "")[:512],
    )
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.get("/mfa/setup")
def mfa_setup(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled")

    # Generate a new secret (or reuse a pending one)
    secret = current_user.mfa_secret or pyotp.random_base32()
    if not current_user.mfa_secret:
        current_user.mfa_secret = secret
        db.commit()

    totp = pyotp.TOTP(secret)
    otpauth_uri = totp.provisioning_uri(name=current_user.email, issuer_name="AII Platform")
    return {"secret": secret, "otpauth_uri": otpauth_uri}


@router.post("/mfa/enable")
def mfa_enable(body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled")
    if not current_user.mfa_secret:
        raise HTTPException(status_code=400, detail="Run /auth/mfa/setup first")

    code = body.get("code", "")
    totp = pyotp.TOTP(current_user.mfa_secret)
    if not totp.verify(code, valid_window=1):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification code")

    current_user.mfa_enabled = True
    db.commit()
    log_action(db, action="MFA_ENABLED", module="auth",
               user_id=current_user.id, user_email=current_user.email)
    return {"message": "MFA enabled successfully"}


@router.post("/mfa/disable")
def mfa_disable(body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is not enabled")

    code = body.get("code", "")
    password = body.get("password", "")

    # Accept either a valid TOTP code or the account password
    totp = pyotp.TOTP(current_user.mfa_secret)
    code_ok = totp.verify(code, valid_window=1) if code else False
    pass_ok = verify_password(password, current_user.password_hash) if password else False

    if not (code_ok or pass_ok):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Provide a valid TOTP code or account password")

    current_user.mfa_enabled = False
    current_user.mfa_secret = None
    db.commit()
    log_action(db, action="MFA_DISABLED", module="auth",
               user_id=current_user.id, user_email=current_user.email)
    return {"message": "MFA disabled successfully"}


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    jti = payload.get("jti")
    session = db.query(UserSession).filter(
        UserSession.refresh_token_jti == jti,
        UserSession.is_active == True,
    ).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired or revoked")

    user = db.query(User).filter(User.id == session.user_id, User.active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    new_access = create_access_token(
        data={"sub": str(user.id), "org": user.organization_id, "super": user.is_super_admin},
    )
    new_refresh = create_refresh_token(data={"sub": str(user.id)})

    access_payload = decode_token(new_access)
    refresh_payload = decode_token(new_refresh)

    session.token_jti = access_payload["jti"]
    session.refresh_token_jti = refresh_payload["jti"]
    db.commit()

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)


@router.post("/logout")
def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    auth_header = request.headers.get("authorization", "")
    token = auth_header.replace("Bearer ", "").replace("bearer ", "")
    payload = decode_token(token)

    if payload:
        jti = payload.get("jti")
        session = db.query(UserSession).filter(UserSession.token_jti == jti).first()
        if session:
            session.is_active = False
            db.commit()

    log_action(
        db, action="LOGOUT", module="auth",
        user_id=current_user.id, user_email=current_user.email,
        ip_address=get_client_ip(request),
    )
    return {"message": "Logged out successfully"}


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    roles = [ur.role.name for ur in current_user.user_roles]
    return {
        "id": current_user.id,
        "uuid": current_user.uuid,
        "organization_id": current_user.organization_id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "email": current_user.email,
        "active": current_user.active,
        "is_super_admin": current_user.is_super_admin,
        "mfa_enabled": current_user.mfa_enabled,
        "last_login": current_user.last_login,
        "roles": roles,
    }
