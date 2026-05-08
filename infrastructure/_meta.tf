terraform {
  required_providers {
    linode = {
      source  = "linode/linode"
      version = "3.7.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }
}

provider "linode" {}
