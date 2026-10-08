from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1.router import router as api_router
from app.core.db import engine
from app.models.service_config import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)  # bản cũ không tạo bảng ở đâu cả
    yield


# Không còn CORS "*": trình duyệt không gọi thẳng config_service nữa,
# chỉ route handler phía server của Next.js (và sync_env.py) gọi.
app = FastAPI(title="Config Service", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(api_router)