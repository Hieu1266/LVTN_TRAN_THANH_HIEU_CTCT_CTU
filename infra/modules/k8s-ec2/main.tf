data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

# ---------- IAM: SSM (truy cập không cần SSH) + quyền cho cluster-autoscaler ----------
data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "node" {
  name               = "${var.name}-node"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "autoscaler" {
  statement {
    actions = [
      "autoscaling:DescribeAutoScalingGroups",
      "autoscaling:DescribeAutoScalingInstances",
      "autoscaling:DescribeLaunchConfigurations",
      "autoscaling:DescribeScalingActivities",
      "autoscaling:DescribeTags",
      "ec2:DescribeImages",
      "ec2:DescribeInstanceTypes",
      "ec2:DescribeLaunchTemplateVersions",
    ]
    resources = ["*"]
  }

  statement {
    actions = [
      "autoscaling:SetDesiredCapacity",
      "autoscaling:TerminateInstanceInAutoScalingGroup",
    ]
    resources = [aws_autoscaling_group.worker.arn]
  }
}

resource "aws_iam_role_policy" "autoscaler" {
  name   = "${var.name}-cluster-autoscaler"
  role   = aws_iam_role.node.id
  policy = data.aws_iam_policy_document.autoscaler.json
}

resource "aws_iam_instance_profile" "node" {
  name = "${var.name}-node"
  role = aws_iam_role.node.name
}

# ---------- Control plane (1 máy) ----------
resource "aws_instance" "control_plane" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.control_plane_instance_type
  subnet_id              = var.private_subnet_ids[0]
  vpc_security_group_ids = [var.node_sg_id]
  iam_instance_profile   = aws_iam_instance_profile.node.name
  user_data              = var.control_plane_user_data

  metadata_options {
    http_tokens = "required" # bắt buộc IMDSv2
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = var.root_volume_gb
    encrypted   = true
  }

  tags = {
    Name = "${var.name}-control-plane"
    Role = "control-plane"
  }
}

# ---------- Worker: Launch Template + Auto Scaling Group ----------
resource "aws_launch_template" "worker" {
  name_prefix            = "${var.name}-worker-"
  image_id               = data.aws_ami.ubuntu.id
  instance_type          = var.worker_instance_type
  vpc_security_group_ids = [var.node_sg_id]
  user_data              = base64encode(var.worker_user_data)

  iam_instance_profile {
    name = aws_iam_instance_profile.node.name
  }

  metadata_options {
    http_tokens = "required"
  }

  block_device_mappings {
    device_name = "/dev/sda1"

    ebs {
      volume_type = "gp3"
      volume_size = var.root_volume_gb
      encrypted   = true
    }
  }

  tag_specifications {
    resource_type = "instance"

    tags = {
      Name = "${var.name}-worker"
      Role = "worker"
    }
  }
}

resource "aws_autoscaling_group" "worker" {
  name                      = "${var.name}-worker"
  min_size                  = var.worker_min
  max_size                  = var.worker_max
  desired_capacity          = var.worker_desired
  vpc_zone_identifier       = var.private_subnet_ids
  health_check_type         = "EC2"
  health_check_grace_period = 300

  launch_template {
    id      = aws_launch_template.worker.id
    version = "$Latest"
  }

  # Cluster-autoscaler tự tìm ASG theo 2 tag này
  tag {
    key                 = "k8s.io/cluster-autoscaler/enabled"
    value               = "true"
    propagate_at_launch = false
  }

  tag {
    key                 = "k8s.io/cluster-autoscaler/${var.name}"
    value               = "owned"
    propagate_at_launch = false
  }

  # Số node hiện tại do autoscaler và lịch quyết định, Terraform không ghi đè
  lifecycle {
    ignore_changes = [desired_capacity]
  }
}

# ---------- Scale trước giờ thi ----------
resource "aws_autoscaling_schedule" "up" {
  for_each = { for s in var.exam_schedules : s.name => s }

  scheduled_action_name  = "${each.key}-up"
  autoscaling_group_name = aws_autoscaling_group.worker.name
  recurrence             = each.value.up_cron
  time_zone              = "Asia/Ho_Chi_Minh"
  min_size               = each.value.min_size
  max_size               = var.worker_max
  desired_capacity       = each.value.desired
}

resource "aws_autoscaling_schedule" "down" {
  for_each = { for s in var.exam_schedules : s.name => s }

  scheduled_action_name  = "${each.key}-down"
  autoscaling_group_name = aws_autoscaling_group.worker.name
  recurrence             = each.value.down_cron
  time_zone              = "Asia/Ho_Chi_Minh"
  min_size               = var.worker_min
  max_size               = var.worker_max
  desired_capacity       = var.worker_min
}
