"""
Seed the database with initial data:
- Default roles and permissions
- Super Admin user
- Initial organization
- Default settings
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from backend.core.infrastructure.database import SessionLocal
from backend.core.infrastructure.security import get_password_hash
from backend.core.domain.models import (
    Base, Organization, User, Role, Permission, RolePermission,
    UserRole, Settings
)
from backend.core.infrastructure.database import engine


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # ── Permissions ────────────────────────────────────────────
        permissions_data = [
            ("organizations:read", "organizations", "View organizations"),
            ("organizations:write", "organizations", "Create/edit organizations"),
            ("organizations:delete", "organizations", "Delete organizations"),
            ("users:read", "users", "View users"),
            ("users:write", "users", "Create/edit users"),
            ("users:delete", "users", "Delete users"),
            ("sites:read", "sites", "View sites"),
            ("sites:write", "sites", "Create/edit sites"),
            ("sites:delete", "sites", "Delete sites"),
            ("roles:read", "roles", "View roles"),
            ("roles:write", "roles", "Create/edit roles"),
            ("audit:read", "audit", "View audit logs"),
            ("settings:read", "settings", "View settings"),
            ("settings:write", "settings", "Edit settings"),
            ("dashboard:read", "dashboard", "View dashboard"),
        ]
        perms = {}
        for name, module, desc in permissions_data:
            p = db.query(Permission).filter(Permission.name == name).first()
            if not p:
                p = Permission(name=name, module=module, description=desc)
                db.add(p)
                db.flush()
            perms[name] = p

        # ── Roles ──────────────────────────────────────────────────
        roles_data = {
            "super_admin": list(perms.keys()),
            "msp_admin": [k for k in perms if k not in ("settings:write",)],
            "tenant_admin": [k for k in perms if "organizations:" not in k and "settings:" not in k],
            "operator": ["organizations:read", "users:read", "sites:read", "sites:write", "dashboard:read"],
            "viewer": ["organizations:read", "users:read", "sites:read", "dashboard:read"],
        }
        role_objs = {}
        for role_name, perm_names in roles_data.items():
            r = db.query(Role).filter(Role.name == role_name).first()
            if not r:
                r = Role(name=role_name, description=role_name.replace("_", " ").title())
                db.add(r)
                db.flush()
                for pn in perm_names:
                    if pn in perms:
                        db.add(RolePermission(role_id=r.id, permission_id=perms[pn].id))
            role_objs[role_name] = r

        # ── Initial Organization ───────────────────────────────────
        org = db.query(Organization).filter(Organization.name == "AII Platform").first()
        if not org:
            org = Organization(
                name="AII Platform",
                company_name="AII Technologies",
                document="00.000.000/0001-00",
                status="active",
            )
            db.add(org)
            db.flush()

        # ── Super Admin User ───────────────────────────────────────
        admin_email = os.environ.get("ADMIN_EMAIL", "admin@aii.local")
        admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@2024!")

        admin = db.query(User).filter(User.email == admin_email).first()
        if not admin:
            admin = User(
                organization_id=org.id,
                first_name="Super",
                last_name="Admin",
                email=admin_email,
                password_hash=get_password_hash(admin_password),
                is_super_admin=True,
                active=True,
            )
            db.add(admin)
            db.flush()
            db.add(UserRole(user_id=admin.id, role_id=role_objs["super_admin"].id))

        # ── Default Settings ───────────────────────────────────────
        default_settings = [
            ("platform_name", "AII Platform", "Platform display name"),
            ("smtp_host", "", "SMTP server host"),
            ("smtp_port", "587", "SMTP server port"),
            ("smtp_user", "", "SMTP username"),
            ("default_language", "en", "Default UI language"),
            ("default_timezone", "UTC", "Default timezone"),
        ]
        for key, value, desc in default_settings:
            s = db.query(Settings).filter(Settings.key == key).first()
            if not s:
                db.add(Settings(key=key, value=value, description=desc))

        db.commit()
        print("✅ Database seeded successfully!")
        print(f"   Admin email:    {admin_email}")
        print(f"   Admin password: {admin_password}")

    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
