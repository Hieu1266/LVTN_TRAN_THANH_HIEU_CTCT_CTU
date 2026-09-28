"""
API Gateway - FastAPI reverse proxy + WLC + Priority + Waitlist
-----------------------------------------------------------------
Nhận request -> tính priority (user + api) -> xếp hàng nếu service đang
đầy (waitlist) -> chọn instance bằng Weighted Least Connections (WLC) ->
forward request -> trả kết quả về client.

Chạy: uvicorn gateway_main:app --host 0.0.0.0 --port 8088 --reload
Cần cài: pip install fastapi httpx uvicorn
"""

import asyncio
import heapq
import itertools
import time
from dataclasses import dataclass, field

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="API Gateway - WLC + Priority + Waitlist")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# 1. CẤU HÌNH INSTANCE + WEIGHT (lấy từ JMeter load test thực tế)
# ============================================================
SERVICE_INSTANCES = {
    "course": [
        {"url": "http://localhost:8001", "weight": 1.0, "active_connections": 0},
        {"url": "http://localhost:8011", "weight": 1.87, "active_connections": 0},
    ],
    "quiz": [
        {"url": "http://localhost:8003", "weight": 1.0, "active_connections": 0},
    ],
    "learning": [
        {"url": "http://localhost:8002", "weight": 1.0, "active_connections": 0},
    ],
    "user": [
        {"url": "http://localhost:8000", "weight": 1.0, "active_connections": 0},
    ],
}

# Bảng route: prefix path -> tên nhóm service (không phải URL trực tiếp nữa)
SERVICE_ROUTES = {
    "/login": "user",
    "/register": "user",
    "/users": "user",

    # ===== course-service (8001) — TẤT CẢ đều gạch NGANG =====
    "/assignment": "course",
    "/content-annotations": "course",
    "/course-collab-link": "course",
    "/course-tag-link": "course",
    "/courses": "course",
    "/curriculums": "course",
    "/lesson-resources": "course",
    "/lessons": "course",
    "/modules": "course",
    "/presentations": "course",
    "/subjects": "course",
    "/syllabus": "course",
    "/tags": "course",

    # ===== learning-progress-service (8002) — TẤT CẢ đều gạch DƯỚI =====
    "/certificate": "learning",
    "/comment": "learning",
    "/course_enrollment": "learning",
    "/lesson_progress": "learning",
    "/note": "learning",
    "/video_progress": "learning",

    # ===== quiz-service (8003) — TRỘN LẪN, cần chú ý từng cái =====
    "/peer-reviews": "quiz",          # gạch ngang
    "/question-options": "quiz",      # gạch ngang
    "/question_pools": "quiz",        # gạch DƯỚI
    "/questions-bank": "quiz",        # gạch ngang (KHÁC code cũ đang ghi "questions_bank")
    "/questions": "quiz",             # không gạch
    "/quiz-submissions": "quiz",      # gạch ngang (KHÁC code cũ đang ghi "quiz_submissions")
    "/quizzes": "quiz",               # không gạch
    "/submission-details": "quiz",    # gạch ngang (KHÁC code cũ đang ghi "submission_details")
}   

# ============================================================
# 2. CẤU HÌNH ADMISSION CONTROL (Waitlist) - giới hạn đồng thời
#    theo từng nhóm service, mô phỏng giới hạn connection tới DB.
#    Con số này nên khớp với pool_size của PgBouncer/Postgres.
# ============================================================
MAX_CONCURRENT = {
    "quiz": 20,       # Thi - ngân sách connection DB lớn nhất
    "course": 15,     # Học
    "learning": 10,
    "user": 10,
}
WAITLIST_TIMEOUT = 15.0  # giây - quá thời gian này thì trả 503, không chờ vô hạn

# ============================================================
# 3. CẤU HÌNH PRIORITY - user_priority + api_priority (số nhỏ = ưu tiên cao)
# ============================================================
USER_PRIORITY = {
    "admin": 1,
    "manager": 2,
    "instructor": 3,
    "student": 4,
    "tester": 5,
}
DEFAULT_USER_PRIORITY = 4  # coi như student nếu không có role trong header

API_PRIORITY_PREFIX = {
    "/quiz_submissions": 1,   # nộp bài thi - ưu tiên tuyệt đối
    "/quizzes": 1,
    "/questions": 2,
    "/lesson-progress": 3,    # học
    "/video-progress": 3,
    "/courses": 3,
    "/users": 2,              # đăng nhập/đăng ký - xử lý nhanh gọn
}
DEFAULT_API_PRIORITY = 4

# Trọng số: loại API (nghiệp vụ) quan trọng hơn ai gọi
USER_WEIGHT = 0.3
API_WEIGHT = 0.7


def compute_priority(path: str, role: str) -> float:
    user_p = USER_PRIORITY.get(role.lower(), DEFAULT_USER_PRIORITY)
    api_p = DEFAULT_API_PRIORITY
    for prefix, p in API_PRIORITY_PREFIX.items():
        if path.startswith(prefix):
            api_p = p
            break
    return user_p * USER_WEIGHT + api_p * API_WEIGHT


# ============================================================
# 4. HÀNG ĐỢI ƯU TIÊN (Waitlist) - mỗi service 1 hàng đợi riêng
#    dùng asyncio.Semaphore để giới hạn số request XỬ LÝ ĐỒNG THỜI,
#    và heapq để chọn request có priority thấp nhất (ưu tiên cao) trước
#    khi có slot trống.
# ============================================================
@dataclass(order=True)
class _WaitItem:
    priority: float
    seq: int
    event: asyncio.Event = field(compare=False)


class PriorityWaitlist:
    """Semaphore có ưu tiên: request priority thấp được cấp slot trước
    khi nhiều request cùng đang chờ 1 slot trống."""

    def __init__(self, capacity: int):
        self.capacity = capacity
        self.in_use = 0
        self._heap: list[_WaitItem] = []
        self._counter = itertools.count()
        self._lock = asyncio.Lock()

    async def acquire(self, priority: float, timeout: float) -> bool:
        async with self._lock:
            if self.in_use < self.capacity:
                self.in_use += 1
                return True
            item = _WaitItem(priority=priority, seq=next(self._counter), event=asyncio.Event())
            heapq.heappush(self._heap, item)

        try:
            await asyncio.wait_for(item.event.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            async with self._lock:
                if item in self._heap:
                    self._heap.remove(item)
                    heapq.heapify(self._heap)
            return False

    async def release(self):
        async with self._lock:
            if self._heap:
                # có người đang chờ -> trao slot vừa trống cho người priority cao nhất
                next_item = heapq.heappop(self._heap)
                next_item.event.set()
            else:
                self.in_use -= 1


waitlists: dict[str, PriorityWaitlist] = {
    name: PriorityWaitlist(capacity) for name, capacity in MAX_CONCURRENT.items()
}

# ============================================================
# 5. WEIGHTED LEAST CONNECTIONS - chọn instance trong nhóm service
# ============================================================
wlc_lock = asyncio.Lock()


async def pick_instance_wlc(service_name: str) -> dict:
    instances = SERVICE_INSTANCES[service_name]
    async with wlc_lock:
        best = min(instances, key=lambda i: i["active_connections"] / i["weight"])
        best["active_connections"] += 1
    return best


async def release_instance(instance: dict):
    async with wlc_lock:
        instance["active_connections"] -= 1


# ============================================================
# 6. HTTP CLIENT DÙNG CHUNG
# ============================================================
client: httpx.AsyncClient | None = None


@app.on_event("startup")
async def startup():
    global client
    client = httpx.AsyncClient(timeout=30.0)


@app.on_event("shutdown")
async def shutdown():
    await client.aclose()


def resolve_service_name(path: str) -> str | None:
    matches = [prefix for prefix in SERVICE_ROUTES if path.startswith(prefix)]
    if not matches:
        return None
    best_prefix = max(matches, key=len)
    return SERVICE_ROUTES[best_prefix]


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/debug/state")
async def debug_state():
    """Xem nhanh trạng thái WLC + Waitlist hiện tại - hữu ích khi demo."""
    return {
        "instances": SERVICE_INSTANCES,
        "waitlists": {
            name: {"in_use": w.in_use, "waiting": len(w._heap), "capacity": w.capacity}
            for name, w in waitlists.items()
        },
    }


@app.api_route(
    "/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def proxy(full_path: str, request: Request):
    path = f"/{full_path}"
    service_name = resolve_service_name(path)

    if service_name is None:
        return Response(
            content=f'{{"detail": "Khong co service nao xu ly path {path}"}}',
            status_code=404,
            media_type="application/json",
        )

    # --- Priority: đọc role từ header do client/frontend gửi lên
    #     (thực tế nên lấy từ JWT đã xác thực, ở đây đơn giản hoá bằng header) ---
    role = request.headers.get("x-user-role", "student")
    priority = compute_priority(path, role)

    # --- Waitlist: xin 1 slot xử lý, có thể phải CHỜ nếu service đang đầy ---
    waitlist = waitlists[service_name]
    started_waiting = time.monotonic()
    admitted = await waitlist.acquire(priority, timeout=WAITLIST_TIMEOUT)

    if not admitted:
        return Response(
            content='{"detail": "He thong dang qua tai, vui long thu lai sau"}',
            status_code=503,
            media_type="application/json",
            headers={"Retry-After": "5"},
        )
    wait_time = time.monotonic() - started_waiting

    instance = None
    try:
        # --- WLC: chọn instance cụ thể trong nhóm service ---
        instance = await pick_instance_wlc(service_name)
        target_url = f"{instance['url']}{path}"

        body = await request.body()
        headers = dict(request.headers)
        headers.pop("host", None)

        upstream_response = await client.request(
            method=request.method,
            url=target_url,
            params=request.query_params,
            headers=headers,
            content=body,
        )

        resp_headers = {
            k: v
            for k, v in upstream_response.headers.items()
            if k.lower() not in ("content-encoding", "transfer-encoding", "content-length")
        }
        resp_headers["x-gateway-priority"] = str(round(priority, 2))
        resp_headers["x-gateway-wait-seconds"] = str(round(wait_time, 3))
        resp_headers["x-gateway-instance"] = instance["url"]

        return Response(
            content=upstream_response.content,
            status_code=upstream_response.status_code,
            headers=resp_headers,
            media_type=upstream_response.headers.get("content-type"),
        )
    finally:
        if instance is not None:
            await release_instance(instance)
        await waitlist.release()