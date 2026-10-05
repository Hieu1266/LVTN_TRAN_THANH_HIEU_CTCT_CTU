output "control_plane_private_ip" {
  value = aws_instance.control_plane.private_ip
}

output "worker_asg_name" {
  value = aws_autoscaling_group.worker.name
}

output "node_role_name" {
  value = aws_iam_role.node.name
}
