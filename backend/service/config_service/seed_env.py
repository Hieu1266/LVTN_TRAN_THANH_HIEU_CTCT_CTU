import os
import requests

# 1. Cấu hình hệ thống
BASE_URL = "http://localhost:30005"

# Danh sách chuẩn toàn bộ các Microservices trong hệ thống LUMER
SERVICES = [
    "frontend",
    "course_service",
    "learning_progress_service",
    "quiz_exam_service",
    "user_service"
]

ENV_FILE_PATH = "./.env"  # Thay đổi nếu file .env nằm ở thư mục khác

ADMIN_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0M2M3NThmOS05NTM5LTRlYmItOTkzOS04YWViYTA0NjU4ZDAiLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZV9uYW1lIjoiQWRtaW4iLCJleHAiOjE3OTE1ODE4MjB9.Y5nAFbnpECvkI8tWgge0i1TGn7fm205F9uBnp95o3WM"

def load_env_vars(file_path):
    """Đọc file .env"""
    if not os.path.exists(file_path):
        file_path = "../../.env"
        if not os.path.exists(file_path):
            print(f"❌ Không tìm thấy file .env!")
            return None

    config_data = {}
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                config_data[key.strip()] = val.strip().strip('"').strip("'")
    return config_data

def seed_config():
    config_data = load_env_vars(ENV_FILE_PATH)
    if not config_data:
        return

    headers = {
        "Content-Type": "application/json",
        "authorization": f"Bearer {ADMIN_TOKEN}"
    }

    print(f"🚀 Tìm thấy {len(config_data)} biến môi trường.")

    for service_name in SERVICES:
        url = f"{BASE_URL}/config/{service_name}"
        payload = {"config": config_data}
        print(f"\n🔄 Đang nạp cấu hình cho service [{service_name}]...")

        try:
            res = requests.put(url, json=payload, headers=headers)
            if res.status_code == 200:
                print(f"✅ Nạp thành công cấu hình cho '{service_name}'!")
            else:
                print(f"❌ Lỗi ({res.status_code}) khi nạp '{service_name}': {res.text}")
        except Exception as e:
            print(f"❌ Lỗi kết nối server khi nạp '{service_name}': {e}")

if __name__ == "__main__":
    seed_config()