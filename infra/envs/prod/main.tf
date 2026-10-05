module "network" {
  source     = "../../modules/network"
  name       = "lumer-prod"
  azs        = ["ap-southeast-1a", "ap-southeast-1b"]
  single_nat = false
}

module "k8s" {
  source             = "../../modules/k8s-ec2"
  name               = "lumer-prod"
  private_subnet_ids = module.network.private_subnet_ids
  node_sg_id         = module.network.node_sg_id

  worker_min     = 2
  worker_max     = 8
  worker_desired = 2

  control_plane_user_data = file("${path.module}/files/control-plane.sh")
  worker_user_data        = file("${path.module}/files/worker.sh")

  # Ví dụ: thi sáng thứ Hai, nâng lên 15 phút trước giờ, hạ xuống sau khi thi
  exam_schedules = [
    {
      name      = "exam-mon-morning"
      up_cron   = "45 7 * * 1"
      down_cron = "0 11 * * 1"
      min_size  = 6
      desired   = 6
    }
  ]
}
