from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import KnowledgeArticle
from backend.api.v1.dependencies import get_current_user
from backend.core.domain.models import User

router = APIRouter(prefix="/knowledge-base", tags=["knowledge-base"])


@router.get("")
def list_articles(
    search: str = Query(None),
    category: str = Query(None),
    status: str = Query(None),
    tags: str = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(KnowledgeArticle)
    if not current_user.is_super_admin:
        q = q.filter(KnowledgeArticle.organization_id == current_user.organization_id)
    if search:
        q = q.filter(KnowledgeArticle.title.ilike(f"%{search}%") | KnowledgeArticle.content.ilike(f"%{search}%") | KnowledgeArticle.tags.ilike(f"%{search}%"))
    if category:
        q = q.filter(KnowledgeArticle.category == category)
    if status:
        q = q.filter(KnowledgeArticle.status == status)
    if tags:
        q = q.filter(KnowledgeArticle.tags.ilike(f"%{tags}%"))
    total = q.count()
    items = q.order_by(KnowledgeArticle.views.desc(), KnowledgeArticle.updated_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.post("")
def create_article(body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = body.get("organization_id") or current_user.organization_id
    if not current_user.is_super_admin:
        org_id = current_user.organization_id
    article = KnowledgeArticle(
        organization_id=org_id,
        title=body.get("title", ""),
        content=body.get("content"),
        category=body.get("category"),
        tags=body.get("tags"),
        author_id=current_user.id,
        status=body.get("status", "draft"),
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@router.get("/categories")
def list_categories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(KnowledgeArticle.category).distinct()
    if not current_user.is_super_admin:
        q = q.filter(KnowledgeArticle.organization_id == current_user.organization_id)
    return [r[0] for r in q.all() if r[0]]


@router.get("/popular")
def popular_articles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(KnowledgeArticle)
    if not current_user.is_super_admin:
        q = q.filter(KnowledgeArticle.organization_id == current_user.organization_id)
    return q.filter(KnowledgeArticle.status == "published").order_by(KnowledgeArticle.views.desc()).limit(10).all()


@router.get("/{article_id}")
def get_article(article_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    article = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and article.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    article.views += 1
    db.commit()
    db.refresh(article)
    return article


@router.patch("/{article_id}")
def update_article(article_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    article = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and article.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    for k, v in body.items():
        if hasattr(article, k) and k not in ("id", "organization_id", "views"):
            setattr(article, k, v)
    if body.get("status") == "published" and not article.published_at:
        article.published_at = datetime.utcnow()
    article.version = (article.version or 1) + 1
    db.commit()
    db.refresh(article)
    return article


@router.delete("/{article_id}", status_code=204)
def delete_article(article_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    article = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and article.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    db.delete(article)
    db.commit()


@router.post("/{article_id}/vote")
def vote_helpful(article_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    article = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404)
    if body.get("helpful", True):
        article.helpful_votes = (article.helpful_votes or 0) + 1
    db.commit()
    return {"helpful_votes": article.helpful_votes}
