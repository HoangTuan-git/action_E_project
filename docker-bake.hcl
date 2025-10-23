# docker-bake.hcl - Docker Bake configuration for multi-stage builds
# Sử dụng với: docker buildx bake -f docker-bake.hcl

variable "REGISTRY" {
  default = "your-dockerhub-username"
}

variable "TAG" {
  default = "latest"
}

variable "CACHE_REGISTRY" {
  default = "${REGISTRY}"
}

# Group definitions
group "default" {
  targets = ["auth", "product", "order", "api-gateway"]
}

group "test" {
  targets = ["auth", "product"]
}

# Common configuration
target "common" {
  cache-from = ["type=gha"]
  cache-to   = ["type=gha,mode=max"]
  platforms  = ["linux/amd64"]
}

# Auth Service
target "auth" {
  inherits = ["common"]
  context  = "./auth"
  tags = [
    "${REGISTRY}/auth-service:${TAG}",
    "${REGISTRY}/auth-service:latest"
  ]
  cache-from = [
    "type=registry,ref=${CACHE_REGISTRY}/auth-service:buildcache",
    "type=gha,scope=auth"
  ]
  cache-to = [
    "type=registry,ref=${CACHE_REGISTRY}/auth-service:buildcache,mode=max",
    "type=gha,scope=auth,mode=max"
  ]
  labels = {
    "org.opencontainers.image.title"       = "Auth Service"
    "org.opencontainers.image.description" = "Authentication microservice"
  }
}

# Product Service
target "product" {
  inherits = ["common"]
  context  = "./product"
  tags = [
    "${REGISTRY}/product-service:${TAG}",
    "${REGISTRY}/product-service:latest"
  ]
  cache-from = [
    "type=registry,ref=${CACHE_REGISTRY}/product-service:buildcache",
    "type=gha,scope=product"
  ]
  cache-to = [
    "type=registry,ref=${CACHE_REGISTRY}/product-service:buildcache,mode=max",
    "type=gha,scope=product,mode=max"
  ]
  labels = {
    "org.opencontainers.image.title"       = "Product Service"
    "org.opencontainers.image.description" = "Product management microservice"
  }
}

# Order Service
target "order" {
  inherits = ["common"]
  context  = "./order"
  tags = [
    "${REGISTRY}/order-service:${TAG}",
    "${REGISTRY}/order-service:latest"
  ]
  cache-from = [
    "type=registry,ref=${CACHE_REGISTRY}/order-service:buildcache",
    "type=gha,scope=order"
  ]
  cache-to = [
    "type=registry,ref=${CACHE_REGISTRY}/order-service:buildcache,mode=max",
    "type=gha,scope=order,mode=max"
  ]
  labels = {
    "org.opencontainers.image.title"       = "Order Service"
    "org.opencontainers.image.description" = "Order processing microservice"
  }
}

# API Gateway
target "api-gateway" {
  inherits = ["common"]
  context  = "./api-gateway"
  tags = [
    "${REGISTRY}/api-gateway:${TAG}",
    "${REGISTRY}/api-gateway:latest"
  ]
  cache-from = [
    "type=registry,ref=${CACHE_REGISTRY}/api-gateway:buildcache",
    "type=gha,scope=gateway"
  ]
  cache-to = [
    "type=registry,ref=${CACHE_REGISTRY}/api-gateway:buildcache,mode=max",
    "type=gha,scope=gateway,mode=max"
  ]
  labels = {
    "org.opencontainers.image.title"       = "API Gateway"
    "org.opencontainers.image.description" = "API Gateway for microservices"
  }
}
