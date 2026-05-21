from fastapi import APIRouter, Depends
from app.models.user import AppUser
from app.routers.auth import get_current_user

router = APIRouter()


@router.get("/me")
def me(user: AppUser = Depends(get_current_user)):
    return {
        "user_id": str(user.id),
        "name": user.display_name,
        "email": user.email,
    }
