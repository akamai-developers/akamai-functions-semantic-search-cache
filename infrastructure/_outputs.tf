output "linode_ip" {
  description = "Linode IP"
  value       = tolist(linode_instance.llm.ipv4)[0]
}

output "ollama_list_models_endpoint" {
  description = "ollama list models endpoint"
  value       = "http://${tolist(linode_instance.llm.ipv4)[0]}:11434/api/tags"
}

output "ollama_generate_response_endpoint" {
  description = "ollama generate response endpoint"
  value       = "http://${tolist(linode_instance.llm.ipv4)[0]}:11434/api/generate"
}

output "ollama_chat_endpoint" {
  description = "ollama chat endpoint"
  value       = "http://${tolist(linode_instance.llm.ipv4)[0]}:11434/api/chat"
}

output "ollama_endpoint" {
  description = "ollama endpoint"
  value       = "http://${tolist(linode_instance.llm.ipv4)[0]}:11434"
}
