"""
RAG Engine — index and search platform knowledge using vector similarity.
Uses pgvector for similarity search via raw SQL when available.
Falls back to keyword search when no embedding key is configured.
"""
import json
import logging
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

CHUNK_SIZE = 500  # chars per chunk


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE) -> list[str]:
    """Simple fixed-size chunking with overlap."""
    if len(text) <= chunk_size:
        return [text]
    chunks = []
    step = int(chunk_size * 0.8)
    for i in range(0, len(text), step):
        chunk = text[i:i + chunk_size]
        if chunk.strip():
            chunks.append(chunk)
    return chunks


def index_document(
    db: Session,
    org_id: int,
    source_type: str,
    source_id: int,
    title: str,
    content: str,
) -> int:
    """Chunk, embed, and store a document. Returns number of chunks indexed."""
    from backend.core.domain.models import VectorDocument
    from backend.core.ai.llm_gateway import get_embeddings

    # Remove existing chunks for this source
    db.query(VectorDocument).filter(
        VectorDocument.organization_id == org_id,
        VectorDocument.source_type == source_type,
        VectorDocument.source_id == source_id,
    ).delete()
    db.flush()

    chunks = chunk_text(content)
    texts_to_embed = [f"{title}\n\n{chunk}" for chunk in chunks]

    try:
        embeddings = get_embeddings(texts_to_embed)
    except Exception as e:
        logger.warning(f"Embedding failed: {e} — storing without embeddings")
        embeddings = [None] * len(chunks)

    for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
        doc = VectorDocument(
            organization_id=org_id,
            source_type=source_type,
            source_id=source_id,
            title=title,
            content=chunk,
            chunk_index=i,
            embedding=emb,
            is_indexed=emb is not None,
        )
        db.add(doc)

    db.commit()
    return len(chunks)


def search_documents(
    db: Session,
    org_id: int,
    query: str,
    limit: int = 5,
    source_types: Optional[list[str]] = None,
) -> list[dict]:
    """Semantic search using cosine similarity or keyword fallback."""
    from backend.core.domain.models import VectorDocument
    from backend.core.ai.llm_gateway import get_embeddings, _get_openai_key

    results = []

    if _get_openai_key():
        try:
            [q_emb] = get_embeddings([query])
            # Use raw SQL with pgvector cosine distance
            q = db.query(VectorDocument).filter(
                VectorDocument.organization_id == org_id,
                VectorDocument.is_indexed == True,
            )
            if source_types:
                q = q.filter(VectorDocument.source_type.in_(source_types))
            docs = q.limit(200).all()

            # Compute cosine similarity in Python (pgvector not registered as column type)
            import math
            def cosine(a, b):
                dot = sum(x * y for x, y in zip(a, b))
                na = math.sqrt(sum(x * x for x in a))
                nb = math.sqrt(sum(x * x for x in b))
                return dot / (na * nb + 1e-9)

            scored = [(cosine(q_emb, d.embedding), d) for d in docs if d.embedding]
            scored.sort(key=lambda x: -x[0])
            results = [{"score": round(s, 3), "title": d.title, "content": d.content, "source_type": d.source_type, "source_id": d.source_id} for s, d in scored[:limit]]
            return results
        except Exception as e:
            logger.warning(f"Vector search failed: {e}, falling back to keyword")

    # Keyword fallback
    from sqlalchemy import or_
    q = db.query(VectorDocument).filter(
        VectorDocument.organization_id == org_id,
        or_(
            VectorDocument.title.ilike(f"%{query}%"),
            VectorDocument.content.ilike(f"%{query}%"),
        ),
    )
    if source_types:
        q = q.filter(VectorDocument.source_type.in_(source_types))
    docs = q.limit(limit).all()
    return [{"score": 1.0, "title": d.title, "content": d.content, "source_type": d.source_type, "source_id": d.source_id} for d in docs]


def index_knowledge_base(db: Session, org_id: int) -> int:
    """Index all published KB articles for an org."""
    from backend.core.domain.models import KnowledgeArticle
    articles = db.query(KnowledgeArticle).filter(
        KnowledgeArticle.organization_id == org_id,
        KnowledgeArticle.status == "published",
        KnowledgeArticle.content != None,
    ).all()
    total = 0
    for art in articles:
        total += index_document(db, org_id, "knowledge_article", art.id, art.title, art.content)
    return total


def index_resolved_tickets(db: Session, org_id: int) -> int:
    """Index recently resolved tickets for RAG."""
    from backend.core.domain.models import Ticket
    tickets = db.query(Ticket).filter(
        Ticket.organization_id == org_id,
        Ticket.status.in_(["resolved", "closed"]),
        Ticket.description != None,
    ).limit(100).all()
    total = 0
    for t in tickets:
        content = f"Title: {t.title}\n\nDescription: {t.description or ''}"
        total += index_document(db, org_id, "ticket", t.id, t.title or "Ticket", content)
    return total
