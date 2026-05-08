variable "linode_type" {
  default     = "g2-gpu-rtx4000a1-l"
  description = "Linode Type (defaults to RTX4000 Ada x1 Large)"
}

variable "linode_region" {
  default     = "us-sea"
  description = "Linode Region (defaults to us-sea)"
}

variable "user_tags" {
  type        = map(string)
  default     = {}
  description = "A map of tags to add to resources"
}

variable "root_password" {
  sensitive   = true
  description = "Root password for the Linode instance"
}

variable "ollama_models" {
  type        = list(string)
  default     = ["nomic-embed-text", "qwen2.5:14b"]
  description = "Ollama models to pull on first boot. Order matters — embed model first, then chat model."
}
