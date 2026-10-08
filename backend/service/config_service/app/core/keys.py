from typing import Optional

from sqlalchemy.orm import Session

from app.models.service_config import ServiceConfig


def get_config(db: Session, service_name: str) -> Optional[ServiceConfig]:
    return db.query(ServiceConfig).filter_by(service_name=service_name).first()


def get_all_configs(db: Session):
    return db.query(ServiceConfig).all()


def replace_config(db: Session, service_name: str, new_config: dict) -> ServiceConfig:
    """Ghi ĐÈ toàn bộ config. (upsert cũ gộp {**cũ, **mới} nên không bao giờ xoá được khóa → nút thùng rác vô tác dụng.)"""
    row = get_config(db, service_name)
    if row:
        row.config_json = new_config
    else:
        row = ServiceConfig(service_name=service_name, config_json=new_config)
        db.add(row)
    db.commit()
    db.refresh(row)
    return row