"""Idempotent demo seed: creates demo org + reviewer/operator/admin users + sample documents."""
from __future__ import annotations

import asyncio
from pathlib import Path

from sqlalchemy import select

from app.core.config import settings
from app.core.logging import configure_logging, logger
from app.core.security import hash_password
from app.db.session import session_scope
from app.models.organization import Membership, Organization
from app.models.user import User
from app.scripts.sample_docs import seed_sample_documents
from app.services import storage


def _ensure_vision_fixtures() -> None:
    """Generate the 12 vision test images on first boot if they're missing.

    Without this, /api/evaluations/vision returns errors on a fresh deployment
    because the fixtures live in /app/sample_data/vision/<id>.jpg. Idempotent —
    skips if all 12 files already exist.
    """
    target = Path("/app/sample_data/vision")
    expected = 12
    existing = list(target.glob("*.jpg")) if target.exists() else []
    if len(existing) >= expected:
        return
    try:
        from app.scripts.gen_vision_fixtures import main as gen_main
        gen_main()
        logger.info("Generated vision fixtures at {}", target)
    except Exception as e:  # noqa: BLE001
        logger.warning("Vision fixture generation failed (non-fatal): {}", e)


async def seed() -> None:
    storage.ensure_bucket()
    _ensure_vision_fixtures()
    async with session_scope() as session:
        org = (await session.execute(select(Organization).where(Organization.slug == settings.seed_org_slug))).scalar_one_or_none()
        if org is None:
            org = Organization(name=settings.seed_org_name, slug=settings.seed_org_slug)
            session.add(org)
            await session.flush()
            logger.info("Seeded organization {} ({})", org.name, org.slug)

        seed_users = [
            (settings.seed_admin_email, "Admin Demo", "admin"),
            (settings.seed_reviewer_email, "Reviewer Demo", "reviewer"),
            (settings.seed_operator_email, "Operator Demo", "operator"),
        ]
        for email, name, role in seed_users:
            user = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
            if user is None:
                user = User(
                    email=email,
                    display_name=name,
                    password_hash=hash_password(settings.seed_password),
                )
                session.add(user)
                await session.flush()
                logger.info("Seeded user {}", email)
            existing = (
                await session.execute(
                    select(Membership).where(
                        Membership.user_id == user.id, Membership.org_id == org.id
                    )
                )
            ).scalar_one_or_none()
            if existing is None:
                m = Membership(org_id=org.id, user_id=user.id, role=role)
                session.add(m)
                logger.info("Seeded membership {} as {}", email, role)

        try:
            await seed_sample_documents(session, org)
        except Exception as e:  # noqa: BLE001
            logger.warning("Sample document seed failed (non-fatal): {}", e)

        # Backfill embeddings for any chunks inserted before embed_text() was
        # wired. Idempotent: skips chunks that already have a vector.
        try:
            from app.models.document import DocumentChunk
            from app.services.embedding import embed_text

            res = await session.execute(
                select(DocumentChunk).where(DocumentChunk.embedding.is_(None))
            )
            backfilled = 0
            for ch in res.scalars().all():
                ch.embedding = embed_text(ch.chunk_text or "")
                backfilled += 1
            if backfilled:
                logger.info("Backfilled embeddings for {} chunks", backfilled)
        except Exception as e:  # noqa: BLE001
            logger.warning("Embedding backfill failed (non-fatal): {}", e)


def main() -> None:
    configure_logging()
    asyncio.run(seed())


if __name__ == "__main__":
    main()
