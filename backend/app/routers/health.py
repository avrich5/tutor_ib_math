import httpx
from fastapi import APIRouter
from app.config import settings
from app.db import check_db

router = APIRouter()


@router.get("/health")
async def health():
    db_ok = check_db()

    orch_ok = False
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{settings.orchestrator_url}/health")
            orch_ok = r.status_code == 200
    except Exception:
        pass

    return {
        "status": "ok" if (db_ok and orch_ok) else "degraded",
        "db": "ok" if db_ok else "error",
        "orchestrator": "ok" if orch_ok else "unreachable",
        "service": "tutor_backend",
        "version": "0.1.0",
    }
