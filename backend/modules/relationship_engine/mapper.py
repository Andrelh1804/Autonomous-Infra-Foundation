"""
Relationship Engine — maps relationships between assets.
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from backend.core.domain.models import Asset, AssetRelationship


VALID_RELATIONSHIP_TYPES = [
    "hosts",
    "runs",
    "connects_to",
    "depends_on",
    "backs_up",
    "virtualizes",
    "manages",
    "uses_database",
    "prints_via",
    "routes_through",
    "protected_by",
]


def create_relationship(
    db: Session,
    source_id: int,
    target_id: int,
    relationship_type: str,
    description: Optional[str] = None,
) -> AssetRelationship:
    existing = db.query(AssetRelationship).filter(
        AssetRelationship.source_asset_id == source_id,
        AssetRelationship.target_asset_id == target_id,
        AssetRelationship.relationship_type == relationship_type,
    ).first()

    if existing:
        return existing

    rel = AssetRelationship(
        source_asset_id=source_id,
        target_asset_id=target_id,
        relationship_type=relationship_type,
        description=description,
    )
    db.add(rel)
    db.commit()
    db.refresh(rel)
    return rel


def get_asset_relationships(
    db: Session,
    asset_id: int,
) -> List[AssetRelationship]:
    return db.query(AssetRelationship).filter(
        (AssetRelationship.source_asset_id == asset_id) |
        (AssetRelationship.target_asset_id == asset_id)
    ).all()


def delete_relationship(db: Session, rel_id: int) -> bool:
    rel = db.query(AssetRelationship).filter(AssetRelationship.id == rel_id).first()
    if rel:
        db.delete(rel)
        db.commit()
        return True
    return False
