#!/bin/bash
# TODO: cài container runtime + kubelet, đọc token từ SSM Parameter Store
# (/lumer/prod/join-token) rồi join cụm (kubeadm join hoặc k3s agent).
# Cần thêm quyền ssm:GetParameter cho role của node.
