terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC
resource "aws_vpc" "sovr" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "sovr-vpc"
    Environment = var.environment
  }
}

# Internet Gateway
resource "aws_internet_gateway" "sovr" {
  vpc_id = aws_vpc.sovr.id

  tags = {
    Name = "sovr-igw"
  }
}

# Public Subnets
resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.sovr.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  map_public_ip_on_launch = true

  tags = {
    Name = "sovr-public-${count.index + 1}"
  }
}

# Private Subnets
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.sovr.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "sovr-private-${count.index + 1}"
  }
}

# EKS Cluster
resource "aws_eks_cluster" "sovr" {
  name     = "sovr-cluster"
  version  = "1.28"
  role_arn = aws_iam_role.eks_cluster.arn

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.eks.id]
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
    aws_iam_role_policy_attachment.eks_service_policy,
  ]
}

# RDS PostgreSQL
resource "aws_db_instance" "sovr_postgres" {
  identifier             = "sovr-postgres"
  engine                 = "postgres"
  engine_version         = "18"
  instance_class         = "db.r6g.large"
  allocated_storage      = 100
  storage_type           = "gp3"
  db_name                = "sovr"
  username               = "sovr"
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.sovr.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  skip_final_snapshot    = false
  final_snapshot_identifier = "sovr-postgres-final-snapshot"
  backup_retention_period = 7
  storage_encrypted       = true
  kms_key_id             = aws_kms_key.sovr.arn

  tags = {
    Name = "sovr-postgres"
  }
}

# ElastiCache Redis
resource "aws_elasticache_cluster" "sovr_redis" {
  cluster_id           = "sovr-redis"
  engine               = "redis"
  node_type            = "cache.r6g.large"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.sovr.name
  security_group_ids   = [aws_security_group.redis.id]

  tags = {
    Name = "sovr-redis"
  }
}

# MSK Kafka
resource "aws_msk_cluster" "sovr_kafka" {
  cluster_name           = "sovr-kafka"
  kafka_version          = "3.5.1"
  number_of_broker_nodes = 3

  broker_node_group_info {
    instance_type   = "kafka.m5.large"
    client_subnets  = aws_subnet.private[*].id
    security_groups = [aws_security_group.kafka.id]
    storage_info {
      ebs_storage_info {
        volume_size = 100
      }
    }
  }

  tags = {
    Name = "sovr-kafka"
  }
}
