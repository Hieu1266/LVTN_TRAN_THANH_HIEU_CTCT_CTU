import re

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from app.core import keys
from app.core.auth import require_admin, require_service_token
from app.core.config import ALLOWED_SERVICES
from app.core.db import SessionDep
from app.core.k8s_apply import apply_runtime_config
from app.crud import config as crud_config
from app.schemas.config import ConfigUpdate

router = APIRouter(prefix="/config", tags=["config"])

_ENV_KEY = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _check_service(name: str) -> None:
    if name not in ALLOWED_SERVICES:
        raise HTTPException(404, f"'{name}' không hợp lệ. Hợp lệ: {sorted(ALLOWED_SERVICES)}")


def _view(service_name: str, row) -> dict:
    cfg = row.config_json if row else {}
    return {
        "service_name": service_name,
        "config": keys.mask(cfg),          # secret luôn bị che trước khi ra khỏi service
        "meta": keys.meta(cfg),
        "updated_at": row.updated_at if row else None,
    }


@router.get("", dependencies=[Depends(require_admin)])
def get_all_configs(db: SessionDep):
    return {r.service_name: _view(r.service_name, r) for r in crud_config.get_all_configs(db)}


@router.get("/{service_name}", dependencies=[Depends(require_admin)])
def get_service_config(service_name: str, db: SessionDep):
    _check_service(service_name)
    # Chưa có dòng nào → trả config rỗng (bản cũ trả 404 nên màn "chưa có biến nào" không bao giờ hiện)
    return _view(service_name, crud_config.get_config(db, service_name))


@router.get(
    "/{service_name}/export",
    response_class=PlainTextResponse,
    dependencies=[Depends(require_service_token)],
)
def export_service_config_as_env(service_name: str, db: SessionDep):
    """Cho sync_env.py khi chạy local. Chỉ xuất khóa runtime, KHÔNG bao giờ xuất secret."""
    _check_service(service_name)
    row = crud_config.get_config(db, service_name)
    return keys.to_env_text(row.config_json if row else {})


@router.put("/{service_name}", dependencies=[Depends(require_admin)])
def update_service_config(
    service_name: str,
    payload: ConfigUpdate,
    db: SessionDep,
    restart: bool = Query(True, description="Restart Deployment sau khi ghi ConfigMap"),
):
    _check_service(service_name)

    bad = [k for k in payload.config if not _ENV_KEY.match(k)]
    if bad:
        raise HTTPException(400, f"Tên biến không hợp lệ: {bad}")

    runtime, ignored = keys.split_runtime(payload.config)
    old = crud_config.get_config(db, service_name)
    # Giữ lại khóa build-time cũ để hiển thị; secret cũ nằm trong DB sẽ bị loại ở lần lưu này
    kept_build = {
        k: v for k, v in (old.config_json if old else {}).items() if keys.classify(k) == "build"
    }
    row = crud_config.replace_config(db, service_name, {**kept_build, **runtime})

    try:
        applied = apply_runtime_config(service_name, runtime, restart=restart)
    except Exception as e:  # DB đã lưu, K8s thì chưa
        raise HTTPException(
            502, f"Đã lưu vào DB nhưng chưa áp dụng được vào Kubernetes: {e}"
        )

    return {
        "message": f"Đã cập nhật config cho '{service_name}'",
        **_view(service_name, row),
        "applied": applied,
        "restarted": applied == "k8s" and restart,
        "ignored": ignored,
    }