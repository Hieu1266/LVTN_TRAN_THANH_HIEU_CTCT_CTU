variable "name" {
  type = string
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "azs" {
  description = "Danh sách AZ, ví dụ [\"ap-southeast-1a\", \"ap-southeast-1b\"]"
  type        = list(string)
}

variable "nodeport_from" {
  description = "Đầu dải NodePort mà gateway được phép gọi vào node K8s"
  type        = number
  default     = 30000
}

variable "nodeport_to" {
  type    = number
  default = 32767
}

variable "db_port" {
  description = "Cổng PostgreSQL (hoặc pgBouncer 6432 nếu chạy riêng ngoài cụm)"
  type        = number
  default     = 5432
}

variable "single_nat" {
  description = "true: 1 NAT Gateway (rẻ, cho dev/test tải). false: 1 NAT mỗi AZ (prod)"
  type        = bool
  default     = true
}
