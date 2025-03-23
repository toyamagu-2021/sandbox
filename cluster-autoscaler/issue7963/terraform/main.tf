provider "aws" {
  region = local.region
  default_tags {
    tags = {
      Owner = "toyamagu"
    }
  }
}

data "aws_availability_zones" "available" {}

locals {
  name   = "ex-${basename(path.cwd)}"
  region = "ap-northeast-1"

  vpc_cidr = "10.0.0.0/16"
  azs      = slice(data.aws_availability_zones.available.names, 0, 3)

  tags = {
    Example    = local.name
    GithubRepo = "terraform-aws-vpc"
    GithubOrg  = "terraform-aws-modules"
  }
}

################################################################################
# VPC Module
################################################################################

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.19.0"


  name = local.name
  cidr = local.vpc_cidr

  azs             = local.azs
  private_subnets = [for k, v in local.azs : cidrsubnet(local.vpc_cidr, 4, k)]
  public_subnets  = [for k, v in local.azs : cidrsubnet(local.vpc_cidr, 4, k + 4)]

  enable_nat_gateway = true

  tags = local.tags
  public_subnet_tags = {
    "kubernetes.io/role/elb" = 1
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = 1
  }
}

module "eks_al2023" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name                             = "${local.name}-al2023"
  cluster_version                          = "1.31"
  enable_cluster_creator_admin_permissions = true
  cluster_endpoint_public_access           = true


  # EKS Addons
  cluster_addons = {
    coredns                = {}
    eks-pod-identity-agent = {}
    kube-proxy             = {}
    vpc-cni                = {}
  }

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets


  self_managed_node_groups = {
    example = {
      # Starting on 1.30, AL2023 is the default AMI type for EKS managed node groups
      instance_types = ["m6i.2xlarge"]
      iam_role_additional_policies = {
        cluster_autoscaler = aws_iam_policy.cluster_autoscaler_policy.arn
      }

      tags = {
        "k8s.io/cluster-autoscaler/enabled"              = "true"
        "k8s.io/cluster-autoscaler/${local.name}-al2023" = "owned"
      }

      bootstrap_extra_args = "--kubelet-extra-args '--node-labels=systems=true'"

      min_size = 1
      max_size = 10
      # This value is ignored after the initial creation
      # https://github.com/bryantbiggs/eks-desired-size-hack
      desired_size = 2
      # This is not required - demonstrates how to pass additional configuration to nodeadm
      # Ref https://awslabs.github.io/amazon-eks-ami/nodeadm/doc/api/
      cloudinit_pre_nodeadm = [
        {
          content_type = "application/node.eks.aws"
          content      = <<-EOT
            ---
            apiVersion: node.eks.aws/v1alpha1
            kind: NodeConfig
            spec:
              kubelet:
                config:
                  shutdownGracePeriod: 30s
                  featureGates:
                    DisableKubeletCloudCredentialProviders: true
          EOT
        }
      ]
    }

    app = {
      # Starting on 1.30, AL2023 is the default AMI type for EKS managed node groups
      instance_types = ["m6i.large"]
      iam_role_additional_policies = {
        cluster_autoscaler = aws_iam_policy.cluster_autoscaler_policy.arn
      }

      bootstrap_extra_args = "--kubelet-extra-args '--node-labels=app=true'"

      tags = {
        "k8s.io/cluster-autoscaler/enabled"              = "true"
        "k8s.io/cluster-autoscaler/${local.name}-al2023" = "owned"
      }

      min_size = 1
      max_size = 10
      # This value is ignored after the initial creation
      # https://github.com/bryantbiggs/eks-desired-size-hack
      desired_size = 2
      # This is not required - demonstrates how to pass additional configuration to nodeadm
      # Ref https://awslabs.github.io/amazon-eks-ami/nodeadm/doc/api/
      cloudinit_pre_nodeadm = [
        {
          content_type = "application/node.eks.aws"
          content      = <<-EOT
            ---
            apiVersion: node.eks.aws/v1alpha1
            kind: NodeConfig
            spec:
              kubelet:
                config:
                  shutdownGracePeriod: 30s
                  featureGates:
                    DisableKubeletCloudCredentialProviders: true
          EOT
        }
      ]
    }
  }

  tags = local.tags
}

data "aws_iam_policy_document" "cluster_autoscaler_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "cluster_autoscaler" {
  name               = "eks-cluster-autoscaler"
  assume_role_policy = data.aws_iam_policy_document.cluster_autoscaler_assume_role_policy.json
}

resource "aws_iam_policy" "cluster_autoscaler_policy" {
  name        = "eks-cluster-autoscaler"
  description = "EKS Cluster Autoscaler Policy"
  policy      = data.aws_iam_policy_document.cluster_autoscaler_policy.json
}

// cluster autoscaler iam policy
data "aws_iam_policy_document" "cluster_autoscaler_policy" {
  statement {
    actions = [
      "autoscaling:DescribeAutoScalingGroups",
      "autoscaling:DescribeAutoScalingInstances",
      "autoscaling:DescribeLaunchConfigurations",
      "autoscaling:DescribeScalingActivities",
      "ec2:DescribeImages",
      "ec2:DescribeInstanceTypes",
      "ec2:DescribeLaunchTemplateVersions",
      "ec2:GetInstanceTypesFromInstanceRequirements",
      "eks:DescribeNodegroup"
    ]

    resources = ["*"]
  }
  statement {
    actions = [
      "autoscaling:SetDesiredCapacity",
      "autoscaling:TerminateInstanceInAutoScalingGroup"
    ]

    resources = ["*"]
  }
}

// Might need latest clsuter-autoscaler version
# module "cluster_autoscaler_pod_identity" {
#   source  = "terraform-aws-modules/eks-pod-identity/aws"
#   version = "1.11.0"

#   name = "cluster-autoscaler"

#   attach_cluster_autoscaler_policy = true
#   cluster_autoscaler_cluster_names = [
#     module.eks_al2023.cluster_name
#   ]

#   # Pod Identity Associations
#   association_defaults = {
#     namespace       = "kube-system"
#     service_account = "cluster-autoscaler-aws-cluster-autoscaler"
#   }

#   associations = {
#     ex-one = {
#       cluster_name = module.eks_al2023.cluster_name
#     }
#   }

#   tags = local.tags
# }
