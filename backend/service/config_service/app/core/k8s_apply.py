"""Áp dụng cấu hình runtime vào Kubernetes: ghi ConfigMap rồi (tuỳ chọn) restart Deployment.

Ngoài cluster (chạy local) thì bỏ qua và chỉ lưu DB — luồng sync_env.py cũ vẫn dùng được.
"""
import os
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import SERVICE_TO_DEPLOYMENT

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
            deployment, ns,
            {"spec": {"template": {"metadata": {"annotations": {
                "kubectl.kubernetes.io/restartedAt": datetime.now(timezone.utc).isoformat()
            }}}}},
        )
    return "k8s"