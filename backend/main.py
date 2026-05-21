from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import health, users, sessions, attempts, questions, topics, concepts, progress
from app.routers import chat

logging.basicConfig(level=settings.log_level)

app = FastAPI(title="Tutor Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(users.router)
app.include_router(sessions.router)
app.include_router(attempts.router)
app.include_router(questions.router)
app.include_router(topics.router)
app.include_router(concepts.router)
app.include_router(progress.router)
app.include_router(chat.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.backend_host, port=settings.backend_port, reload=False)
