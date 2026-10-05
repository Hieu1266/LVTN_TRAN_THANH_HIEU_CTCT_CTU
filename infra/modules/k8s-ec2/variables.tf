variable "name" {
  description = "Tên cụm, dùng cho tag và tên tài nguyên"
  type        = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "node_sg_id" {
  type = string
}

variable "control_plane_instance_type" {
  type    = string
  default = "t3.large"
}

variable "worker_instance_type" {
  description = "Chọn theo kết quả đo tải. Tránh dòng t* khi test tải vì bị giới hạn CPU credit"
  type        = string
  default     = "m6i.large"
}

variable "root_volume_gb" {
  type    = number
  default = 50
}

variable "worker_min" {
  type    = number
  default = 2
}

variable "worker_max" {
  type    = number
  default = 8
}

variable "worker_desired" {
  description = "Chỉ dùng cho lần tạo đầu; sau đó autoscaler/lịch quyết định"
  type        = number
  default     = 2
}

variable "control_plane_user_data" {
  description = "Script khởi tạo control plane (kubeadm hoặc k3s)"
  type        = string
  default     = ""
}

variable "worker_user_data" {
  description = "Script cho worker tự join cụm"
  type        = string
  default     = ""
}

variable "exam_schedules" {
  description = "Lịch scale trước giờ thi (cron theo múi giờ Asia/Ho_Chi_Minh)"
  type = list(object({
    name      = string
    up_cron   = string
    down_cron = string
    min_size  = number
    desired   = number
  }))
  default = []
}
