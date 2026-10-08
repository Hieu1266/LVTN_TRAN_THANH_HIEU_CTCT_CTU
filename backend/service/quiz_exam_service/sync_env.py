"""
sync_env.py
Đặt file này CẠNH file .env của từng service (user_service, course_service,
learning_progress_service, quiz_exam_service). KHÔNG đặt trong config_service.

Cách chạy song song với uvicorn (mở thêm 1 terminal, activate venv, rồi):
    python3 sync_env.py

Chạy uvicorn với --reload-include để tự restart khi .env đổi:
    python3 -m uvicorn app.main:app --reload --reload-include ".env" --port 8003
"""

import os
import time
import httpx

# ==== CHỈNH DÒNG NÀY CHO ĐÚNG TỪNG SERVICE ====
# Đổi giá trị này khi copy sang thư mục service khác:
# user_service / course_service / learning_progress_service /  / frontend
SERVICE_NAME = "quiz_exam_service"
ENV_PATH = ".env"   # đặt file này cạnh .env của từng service, giữ nguyên đường dẫn này
# =================================================

CONFIG_SERVICE_URL = os.getenv("CONFIG_SERVICE_URL", "http://127.0.0.1:8005")
POLL_INTERVAL_SECONDS = 10  # 10s cho dev để thấy đổi ngay, sau này deploy thật thì tăng lên 30-60s


def fetch_remote_env_text() -> str | None:
    try:
        resp = httpx.get(
            f"{CONFIG_SERVICE_URL}/config/{SERVICE_NAME}/export",
            headers={"X-Service-Token": os.getenv("CONFIG_SERVICE_TOKEN", "")},
            timeout=5,
        )
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        print(f"[sync_env] Không gọi được config_service: {e}")
        return None


def read_local_env_text() -> str:
    if not os.path.exists(ENV_PATH):
        return ""
    with open(ENV_PATH, "r", encoding="utf-8") as f:
        return f.read()


def write_local_env_text(content: str) -> None:
    with open(ENV_PATH, "w", encoding="utf-8") as f:
        f.write(content)


def merge_env(local_text: str, remote_text: str) -> str:
    """Chỉ cập nhật/thêm các khóa runtime mà config_service trả về.
    Giữ nguyên mọi dòng khác (secret, DB URL, comment) của .env local —
    bản cũ ghi đè cả file nên sẽ xoá mất secret khi config_service không còn xuất secret."""
    remote: dict[str, str] = {}
    for line in remote_text.splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            remote[k.strip()] = v

    out, seen = [], set()
    for line in local_text.splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k = line.split("=", 1)[0].strip()
            if k in remote:
                out.append(f"{k}={remote[k]}")
                seen.add(k)
                continue
        out.append(line)
    out += [f"{k}={v}" for k, v in remote.items() if k not in seen]
    return "\n".join(out).rstrip("\n") + "\n"


def sync_once() -> None:
    remote_text = fetch_remote_env_text()
    if remote_text is None:
        return  # config_service đang tắt hoặc lỗi mạng, bỏ qua lần này

    local_text = read_local_env_text()
    merged = merge_env(local_text, remote_text)

    if merged.strip() != local_text.strip():
        write_local_env_text(merged)
        print(f"[sync_env] Đã cập nhật .env cho '{SERVICE_NAME}' — uvicorn sẽ tự reload nếu chạy với --reload-include \".env\"")
    else:
        print(f"[sync_env] Config '{SERVICE_NAME}' không đổi.")


def main():
    print(f"[sync_env] Bắt đầu theo dõi config cho '{SERVICE_NAME}', mỗi {POLL_INTERVAL_SECONDS}s...")
    while True:
        sync_once()
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()