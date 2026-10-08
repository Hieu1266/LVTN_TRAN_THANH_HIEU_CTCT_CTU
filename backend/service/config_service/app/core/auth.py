import hmac

import jwt
from fastapi import Header, HTTPException, status

from app.core.config import settings


def require_admin(authorization: str = Header(default="")) -> dict:
    """Chỉ cho JWT hợp lệ có role_name = admin (cùng SECRET_KEY với các service)."""
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Thiếu token")
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token không hợp lệ hoặc đã hết hạn")
    if str(payload.get("role_name", "")).lower() != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Chỉ admin được xem/sửa cấu hình")
    return payload


def require_service_token(x_service_token: str = Header(default="")) -> None:
    if not settings.SERVICE_TOKEN:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Chưa cấu hình SERVICE_TOKEN")
    if not hmac.compare_digest(x_service_token, settings.SERVICE_TOKEN):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sai service token")