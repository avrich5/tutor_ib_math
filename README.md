# tutor_ib_math

Self-hosted IB Math AA HL tutor for one student.

- **Backend:** FastAPI + PostgreSQL (pgvector) on port 4800
- **Frontend:** React + Vite + TypeScript + KaTeX + MathLive on port 5173
- **LLM access:** via `home_orchestrator :4700` only
- **Production:** skufs `~/tutor_skufs/`
- **Mirror:** MacBook `~/tutor_macbook/`

## Quick start (skufs)

```bash
cd ~/tutor_skufs
./deploy.sh
```

## Docs

- `SPEC.md` — full architecture spec and phased plan
- `MEMORY.md` — append-only architectural decision log
- `ERRORS.md` — failure log
