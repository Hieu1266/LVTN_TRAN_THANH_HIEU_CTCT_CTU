output "control_plane_private_ip" {
  value = module.k8s.control_plane_private_ip
}

output "worker_asg_name" {
  value = module.k8s.worker_asg_name
}
