# ==========================================
# Stage 1: Builder (cài thư viện bằng uv)
# ==========================================
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Nên ghim phiên bản uv (ví dụ :0.x.y) để build lặp lại được
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Gateway không dùng driver PostgreSQL nên không cần build-essential / libpq-dev
COPY requirements.txt .

RUN uv venv /app/.venv && \
    . /app/.venv/bin/activate && \
    uv pip install --no-cache -r requirements.txt

# ==========================================
# Stage 2: Runner (nhẹ, chạy bằng user thường)
# ==========================================
FROM python:3.11-slim AS runner

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system appgroup && useradd --system --gid appgroup appuser

COPY --from=builder --chown=appuser:appgroup /app/.venv /app/.venv
COPY --chown=appuser:appgroup ./app ./app

USER appuser

EXPOSE 8088

# Dùng /health có sẵn trong main.py (python:slim không có curl nên dùng urllib)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8088/health', timeout=2)" || exit 1

# CHỈ 1 worker: trạng thái Waitlist/WLC nằm trong RAM của tiến trình.
# Thêm --workers N sẽ nhân giới hạn MAX_CONCURRENT lên N lần.
# SECRET_KEY và 4 biến *_SERVICE_URL phải được truyền lúc chạy (không đóng gói .env vào image).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8088"]