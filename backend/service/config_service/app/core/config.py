from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    # Dùng chung với các service khác để xác thực JWT của admin
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    # Token nội bộ cho /export (service → config_service). Để trống = tắt endpoint đó.
    SERVICE_TOKEN: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

# service_name (trong DB / UI) -> tên Deployment trong K8s
SERVICE_TO_DEPLOYMENT = {
    "user_service": "user-service",
    "course_service": "course-service",
    "learning_progress_service": "learning-progress-service",
    "quiz_exam_service": "quiz-exam-service",
    "frontend": "frontend",
}
ALLOWED_SERVICES = set(SERVICE_TO_DEPLOYMENT)