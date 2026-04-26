from __future__ import annotations

import hashlib
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentContext, current_context
from app.core.ids import att_id
from app.db.session import get_db
from app.models.run import Attachment, Run
from app.schemas.runs import AttachmentOut
from app.services import storage

router = APIRouter(prefix="/api", tags=["attachments"])


@router.post("/runs/{run_id}/attachments", response_model=AttachmentOut)
async def upload_run_attachment(
    run_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
    step_id: Optional[str] = Form(default=None),
    kind: str = Form(default="photo"),
) -> AttachmentOut:
    run = (await session.execute(select(Run).where(Run.id == run_id))).scalar_one_or_none()
    if run is None or run.org_id != ctx.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    raw = await file.read()
    storage.ensure_bucket()
    key = (
        f"orgs/{ctx.org_id}/runs/{run_id}/attachments/"
        f"{att_id()}_{(file.filename or 'upload').replace(' ', '_')}"
    )
    storage.put_bytes(key, raw, file.content_type or "application/octet-stream")
    a = Attachment(
        run_id=run.id,
        step_id=step_id,
        kind=kind,
        storage_path=key,
        mime_type=file.content_type or "application/octet-stream",
        checksum=hashlib.sha256(raw).hexdigest(),
        created_by=ctx.user_id,
    )
    session.add(a)
    await session.commit()
    return AttachmentOut.model_validate(a)


@router.get("/attachments/{attachment_id}/download-url")
async def attachment_download_url(
    attachment_id: str,
    ctx: Annotated[CurrentContext, Depends(current_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    a = (
        await session.execute(select(Attachment).where(Attachment.id == attachment_id))
    ).scalar_one_or_none()
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attachment not found")
    # tenant check via run
    if a.run_id:
        run = (await session.execute(select(Run).where(Run.id == a.run_id))).scalar_one_or_none()
        if run is None or run.org_id != ctx.org_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Attachment not found")
    return {"url": storage.presigned_get_url(a.storage_path)}
