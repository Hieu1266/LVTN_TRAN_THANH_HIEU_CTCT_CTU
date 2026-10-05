terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # State để trên S3 (tạo bucket trước, bật versioning và mã hóa)
  backend "s3" {
    bucket       = "lumer-tfstate"
    key          = "prod/terraform.tfstate"
    region       = "ap-southeast-1"
    use_lockfile = true
  }
}

provider "aws" {
  region = "ap-southeast-1"

  default_tags {
    tags = {
      Project = "lumer"
      Env     = "prod"
    }
  }
}
