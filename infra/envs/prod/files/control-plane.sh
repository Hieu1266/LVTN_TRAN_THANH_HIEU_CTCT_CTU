#!/bin/bash
# TODO: cài container runtime + khởi tạo control plane (kubeadm init hoặc k3s server).
# Sau khi khởi tạo, ghi token join vào SSM Parameter Store (SecureString)
# để worker đọc, ví dụ: /lumer/prod/join-token
# Cần thêm quyền ssm:PutParameter cho role của node nếu ghi từ chính node.
