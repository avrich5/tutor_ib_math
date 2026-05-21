import secrets
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models.user import AppUser

security = HTTPBasic()


def get_current_user(
    credentials: HTTPBasicCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> AppUser:
    ok = secrets.compare_digest(
        credentials.username.encode(), settings.single_user_email.encode()
    ) and secrets.compare_digest(
        credentials.password.encode(), settings.single_user_basic_password.encode()
    )
    if not ok:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )

    user = db.query(AppUser).filter_by(email=settings.single_user_email).first()
    if not user:
        user = AppUser(email=settings.single_user_email, display_name="Student")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user
