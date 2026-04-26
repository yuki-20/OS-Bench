"""S3-compatible object storage client (MinIO-friendly), with a local-FS backend.

Setting STORAGE_BACKEND=local in `.env` swaps to a filesystem mirror at
`LOCAL_STORAGE_ROOT`. Bucket layout is preserved so callers don't need to know
which backend they're talking to.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

import boto3
from botocore.client import Config
from tenacity import retry, stop_after_attempt, wait_fixed

from app.core.config import settings


def get_s3():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
        config=Config(signature_version="s3v4"),
    )


def _uses_local_storage() -> bool:
    return settings.storage_backend.lower() == "local"


def _local_root() -> Path:
    root = Path(settings.local_storage_root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _local_path(key: str) -> Path:
    safe_key = key.replace("\\", "/").lstrip("/")
    path = (_local_root() / settings.s3_bucket / safe_key).resolve()
    bucket_root = (_local_root() / settings.s3_bucket).resolve()
    if bucket_root not in path.parents and path != bucket_root:
        raise ValueError("Invalid storage key")
    return path


@retry(stop=stop_after_attempt(15), wait=wait_fixed(2), reraise=True)
def ensure_bucket() -> None:
    if _uses_local_storage():
        (_local_root() / settings.s3_bucket).mkdir(parents=True, exist_ok=True)
        return
    s3 = get_s3()
    existing = {b["Name"] for b in s3.list_buckets().get("Buckets", [])}
    if settings.s3_bucket not in existing:
        s3.create_bucket(Bucket=settings.s3_bucket)


def presigned_put_url(key: str, content_type: str = "application/octet-stream", ttl: int = 3600) -> str:
    if _uses_local_storage():
        return _local_path(key).as_uri()
    s3 = get_s3()
    return s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.s3_bucket, "Key": key, "ContentType": content_type},
        ExpiresIn=ttl,
    )


def presigned_get_url(key: str, ttl: int = 3600) -> str:
    if _uses_local_storage():
        return _local_path(key).as_uri()
    s3 = get_s3()
    return s3.generate_presigned_url(
        "get_object", Params={"Bucket": settings.s3_bucket, "Key": key}, ExpiresIn=ttl
    )


def public_url(key: str) -> str:
    if _uses_local_storage():
        return _local_path(key).as_uri()
    return f"{settings.s3_public_base_url.rstrip('/')}/{settings.s3_bucket}/{key.lstrip('/')}"


def put_bytes(key: str, body: bytes, content_type: str = "application/octet-stream") -> None:
    if _uses_local_storage():
        path = _local_path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
        return
    s3 = get_s3()
    s3.put_object(Bucket=settings.s3_bucket, Key=key, Body=body, ContentType=content_type)


def get_bytes(key: str) -> bytes:
    if _uses_local_storage():
        return _local_path(key).read_bytes()
    s3 = get_s3()
    obj = s3.get_object(Bucket=settings.s3_bucket, Key=key)
    return obj["Body"].read()


def delete_object(key: str) -> None:
    if _uses_local_storage():
        path = _local_path(key)
        if path.exists():
            path.unlink()
        return
    s3 = get_s3()
    s3.delete_object(Bucket=settings.s3_bucket, Key=key)


def head_object(key: str) -> Optional[dict]:
    if _uses_local_storage():
        path = _local_path(key)
        if not path.exists():
            return None
        return {"ContentLength": path.stat().st_size, "Key": key}
    s3 = get_s3()
    try:
        return s3.head_object(Bucket=settings.s3_bucket, Key=key)
    except Exception:
        return None
