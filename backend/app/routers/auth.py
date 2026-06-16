from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..auth import create_access_token, get_current_user, verify_google_id_token

router = APIRouter(prefix="/auth", tags=["auth"])


class GoogleLoginRequest(BaseModel):
    credential: str = Field(min_length=10)


class AuthUser(BaseModel):
    email: str
    name: str | None = None
    picture: str | None = None


class GoogleLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUser


@router.post("/google", response_model=GoogleLoginResponse)
async def login_with_google(body: GoogleLoginRequest):
    payload = verify_google_id_token(body.credential)
    email = payload["email"].lower()
    name = payload.get("name")
    picture = payload.get("picture")
    token = create_access_token(email=email, name=name, picture=picture)
    return GoogleLoginResponse(
        access_token=token,
        user=AuthUser(email=email, name=name, picture=picture),
    )


@router.get("/me", response_model=AuthUser)
async def get_me(user: dict = Depends(get_current_user)):
    return AuthUser(
        email=user["email"],
        name=user.get("name"),
        picture=user.get("picture"),
    )
