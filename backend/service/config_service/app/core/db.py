import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings, SERVICE_TO_DEPLOYMENT

# 1. Khởi tạo Database Engine & SessionLocal
# Lấy chuỗi kết nối DB từ settings hoặc biến môi trường
DATABASE_URL = getattr(settings, "DATABASE_URL", os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/config_db"))

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# 2. FastAPI Dependency & SessionDep
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


SessionDep = Annotated[Session, Depends(get_db)]

# 3. Kubernetes Runtime Configuration
_NS_FILE = Path("/var/run/secrets/kubernetes.io/serviceaccount/namespace")


def in_cluster() -> bool:
    return bool(os.getenv("KUBERNETES_SERVICE_HOST")) and _NS_FILE.exists()


def apply_runtime_config(service_name: str, runtime_cfg: dict[str, str], restart: bool = True) -> str:
    """Trả về 'k8s' nếu đã ghi vào cluster, 'db_only' nếu không chạy trong K8s."""
    if not in_cluster():
        return "db_only"

    from kubernetes import client, config  # import muộn: local không cần cài

    config.load_incluster_config()
    ns = _NS_FILE.read_text().strip()
    deployment = SERVICE_TO_DEPLOYMENT[service_name]
    cm_name = f"{deployment}-config"

    core, apps = client.CoreV1Api(), client.AppsV1Api()
    body = client.V1ConfigMap(
        metadata=client.V1ObjectMeta(name=cm_name, labels={"managed-by": "config-service"}),
        data={k: str(v) for k, v in runtime_cfg.items()},
    )
    try:
        core.replace_namespaced_config_map(cm_name, ns, body)
    except client.ApiException as e:
        if e.status != 404:
            raise
        core.create_namespaced_config_map(ns, body)

    if restart:
        apps.patch_namespaced_deployment(
            deployment,
            ns,
            {
                "spec": {
                    "template": {
                        "metadata": {
                            "annotations": {
                                "kubectl.kubernetes.io/restartedAt": datetime.now(
                                    timezone.utc
                                ).isoformat()
                            }
                        }
                    }
                }
            },
        )
    return "k8s"