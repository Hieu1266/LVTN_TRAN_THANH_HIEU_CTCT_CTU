"""Phân loại biến cấu hình — không phụ thuộc framework để dễ test.

  secret : K8s Secret / GitHub Secrets quản lý. UI chỉ thấy bản đã che, không sửa.
  build  : NEXT_PUBLIC_* được Next.js nhúng lúc build → muốn đổi phải build lại image.
  runtime: lưu ở config_service → ghi ra ConfigMap → restart Deployment.

Phải khớp với classifyKey() trong frontend/src/app/admin/settings/page.tsx.
"""
from typing import Any

MASK = "********"

_SECRET_HINTS = (
    "SECRET", "PASSWORD", "TOKEN", "PRIVATE", "API_KEY", "ADMIN_KEY",
    "_DB_URL", "DATABASE_URL",
)
# ACCESS_TOKEN_EXPIRE_DAYS chứa "TOKEN" nhưng không phải bí mật
_RUNTIME_SUFFIXES = ("_EXPIRE_DAYS", "_EXPIRE_MINUTES", "_EXPIRE_SECONDS")


def classify(key: str) -> str:
    k = key.upper()
    if k.endswith(_RUNTIME_SUFFIXES):
        return "runtime"
    if any(h in k for h in _SECRET_HINTS):
        return "secret"
    if k.startswith("NEXT_PUBLIC_"):
        return "build"
    return "runtime"


def mask(cfg: dict[str, Any]) -> dict[str, Any]:
    return {
        k: (MASK if classify(k) == "secret" and v not in ("", None) else v)
        for k, v in cfg.items()
    }


def meta(cfg: dict[str, Any]) -> dict[str, str]:
    return {k: classify(k) for k in cfg}


def split_runtime(cfg: dict[str, Any]) -> tuple[dict[str, str], list[str]]:
    """Tách phần được phép sửa (runtime) và danh sách khóa bị bỏ qua."""
    runtime: dict[str, str] = {}
    ignored: list[str] = []
    for k, v in cfg.items():
        if classify(k) == "runtime":
            runtime[k] = "" if v is None else str(v)
        else:
            ignored.append(k)
    return runtime, ignored


def to_env_text(cfg: dict[str, Any]) -> str:
    runtime, _ = split_runtime(cfg)
    lines = [f"{k}={str(v).replace(chr(10), ' ')}" for k, v in runtime.items()]
    return "\n".join(lines) + "\n" if lines else ""
