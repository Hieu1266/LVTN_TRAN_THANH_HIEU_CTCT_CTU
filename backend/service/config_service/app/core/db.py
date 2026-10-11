from collections.abc import Generator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import create_engine
from sqlmodel import Session

from app.core.config import settings

# Service cấu hình chỉ đọc/ghi vài dòng → pool nhỏ.
# (Bản cũ: pool_size=30 + max_overflow=50 = 80 kết nối, gần hết ngân sách 100 của Postgres.)
engine = create_engine(
    settings.CONFIG_DB_URL,
    pool_size=3,
    max_overflow=2,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True,
)


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]
