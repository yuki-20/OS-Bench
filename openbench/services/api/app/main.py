from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_admin import router as admin_router
from app.api.routes_ai import router as ai_router, protocol_trace_router
from app.api.routes_attachments import router as attachments_router
from app.api.routes_auth import router as auth_router
from app.api.routes_dashboard import router as dashboard_router
from app.api.routes_deviations import router as deviations_router
from app.api.routes_documents import router as documents_router
from app.api.routes_escalations import router as escalations_router
from app.api.routes_evaluation import router as evaluation_router
from app.api.routes_exports import router as exports_router
from app.api.routes_notifications import router as notifications_router
from app.api.routes_templates import router as templates_router
from app.api.routes_handover import router as handover_router
from app.api.routes_protocols import router as protocols_router
from app.api.routes_runs import router as runs_router
from app.api.routes_sync import router as sync_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.schemas.common import HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    yield


app = FastAPI(
    title=settings.app_name,
    description=(
        "OpenBench OS — protocol execution runtime for lab work. "
        "Compiles approved SOPs/SDSs/manuals into versioned execution graphs and runs "
        "them with explicit state, citations, photo verification, deviation capture, "
        "and structured handover reporting."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth_router)
app.include_router(documents_router)
app.include_router(protocols_router)
app.include_router(runs_router)
app.include_router(attachments_router)
app.include_router(ai_router)
app.include_router(protocol_trace_router)
app.include_router(handover_router)
app.include_router(deviations_router)
app.include_router(dashboard_router)
app.include_router(admin_router)
app.include_router(sync_router)
app.include_router(escalations_router)
app.include_router(evaluation_router)
app.include_router(exports_router)
app.include_router(templates_router)
app.include_router(notifications_router)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        app_name=settings.app_name,
        app_env=settings.app_env,
        timestamp=datetime.utcnow(),
    )


@app.get("/")
def root() -> dict[str, str]:
    return {"app": settings.app_name, "docs": "/docs"}
