variable "project_name" {
  type    = string
  default = "gyf"
}

variable "environment" {
  type    = string
  default = "production"
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

# --- Vercel ---
variable "vercel_api_token" {
  type      = string
  sensitive = true
}

variable "git_repo" {
  type        = string
  description = "owner/repo for the connected Git repository."
  default     = "GetYourFit/GYF-V2"
}

# --- Supabase ---
variable "supabase_access_token" {
  type      = string
  sensitive = true
}

variable "supabase_org_id" {
  type = string
}

variable "supabase_db_password" {
  type      = string
  sensitive = true
}

variable "supabase_region" {
  type    = string
  default = "us-east-1"
}

# --- Upstash (Redis) ---
variable "upstash_email" {
  type = string
}

variable "upstash_api_key" {
  type      = string
  sensitive = true
}
