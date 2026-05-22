from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import ai, analytics, auth, ideas, tasks, whatsapp, ws
from app.core.config import get_settings
from app.db.session import Base, engine


settings = get_settings()
app = FastAPI(title=settings.app_name, version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins + ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(ideas.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(whatsapp.router, prefix="/api")
app.include_router(ws.router)


@app.on_event("startup")
async def startup():
    if settings.auto_create_tables:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)


@app.get("/health")
async def health():
    return {"status": "ok", "service": settings.app_name}
