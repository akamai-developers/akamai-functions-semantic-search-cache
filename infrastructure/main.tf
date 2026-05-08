locals {
  default_tags = ["akamai-functions"]
  all_tags     = distinct(concat(local.default_tags, values(var.user_tags)))
}

resource "linode_instance" "llm" {
  label      = "semantic_search_cache"
  image      = "linode/ubuntu24.04"
  region     = var.linode_region
  type       = var.linode_type
  root_pass  = var.root_password
  tags       = local.all_tags
  private_ip = false
  metadata {
    user_data = base64encode(templatefile("./userdata/linode.yml", {
      ollama_models = var.ollama_models
    }))
  }
}

resource "null_resource" "wait_for_ollama" {
  depends_on = [linode_instance.llm, linode_firewall.lb-fw]

  provisioner "local-exec" {
    command = <<-EOT
      echo "Waiting for Ollama to become ready (up to 30 min)..."
      for i in $(seq 1 60); do
        if curl -sf "http://${tolist(linode_instance.llm.ipv4)[0]}:11434" > /dev/null 2>&1; then
          echo "Ollama is ready."
          exit 0
        fi
        echo "  attempt $i/60 — retrying in 30s..."
        sleep 30
      done
      echo "ERROR: timed out waiting for Ollama." >&2
      exit 1
    EOT
  }
}

resource "linode_firewall" "lb-fw" {
  label           = "semantic_search_cache"
  linodes         = [linode_instance.llm.id]
  inbound_policy  = "DROP"
  outbound_policy = "ACCEPT"
  tags            = local.all_tags

  inbound {
    label    = "allow-ssh"
    action   = "ACCEPT"
    protocol = "TCP"
    ports    = "22"
    ipv4     = ["0.0.0.0/0"]
  }

  inbound {
    label    = "allow-ollama-http"
    action   = "ACCEPT"
    protocol = "TCP"
    ports    = "11434"
    ipv4     = ["0.0.0.0/0"]
  }
}
