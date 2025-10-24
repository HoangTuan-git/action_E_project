# E-Commerce Microservices Platform

A scalable microservices-based e-commerce platform built with Node.js, featuring automated CI/CD pipelines and comprehensive testing.

---

## 🎯 Problem Statement

This system solves the challenges of building a **scalable, maintainable e-commerce platform** by:
- Separating concerns into independent microservices
- Enabling independent deployment and scaling
- Providing fault isolation and resilience
- Supporting asynchronous communication between services

---

## 🏗️ System Architecture

### Services Overview

The platform consists of **4 core microservices** and **2 infrastructure services**:

#### **Core Services:**

1. **Auth Service** (Port 3000)
   - **Purpose:** User authentication and authorization
   - **Responsibilities:**
     - User registration and login
     - JWT token generation and validation
     - Protected route middleware
   - **Technology:** Express.js, MongoDB, bcrypt, JWT

2. **Product Service** (Port 3001)
   - **Purpose:** Product catalog management
   - **Responsibilities:**
     - CRUD operations for products
     - Product inventory management
     - Order creation and queue publishing
   - **Technology:** Express.js, MongoDB, RabbitMQ

3. **Order Service** (Port 3002)
   - **Purpose:** Order processing and management
   - **Responsibilities:**
     - Listen to order queue from Product Service
     - Order status management
     - Order history tracking
   - **Technology:** Express.js, MongoDB, RabbitMQ

4. **API Gateway** (Port 3003)
   - **Purpose:** Single entry point for all client requests
   - **Responsibilities:**
     - Request routing to appropriate services
     - Load balancing
     - Centralized error handling
   - **Technology:** Express.js, http-proxy

#### **Infrastructure Services:**

5. **MongoDB** (Port 27017)
   - Persistent data storage for all services
   - Separate databases per service (auth, product, order)

6. **RabbitMQ** (Port 5672, Management: 15672)
   - Message broker for asynchronous communication
   - Queues: `products`, `orders`

---

## 🎨 Design Patterns

### **1. Microservices Architecture**
- Independent services with single responsibility
- Decentralized data management
- Service isolation and fault tolerance

### **2. API Gateway Pattern**
- Single entry point for all client requests
- Service discovery and routing
- Cross-cutting concerns (logging, authentication)

### **3. Repository Pattern**
```
Controller → Service → Repository → Model
```
- Separation of business logic and data access
- Testability and maintainability
- Example: `authController → authService → userRepository`

### **4. Event-Driven Architecture**
- Asynchronous communication via RabbitMQ
- Publish/Subscribe pattern for order events
- Loose coupling between services

### **5. Singleton Pattern**
- MessageBroker connection management
- Single RabbitMQ connection shared across service

---

## 🔄 Service Communication

### **Synchronous Communication (HTTP/REST)**

```
Client → API Gateway → Auth/Product/Order Services
```

**Example Flow:**
```
POST /auth/register
  ↓
API Gateway (3003)
  ↓
Auth Service (3000)
  ↓
MongoDB (auth DB)
```

### **Asynchronous Communication (RabbitMQ)**

```
Product Service → RabbitMQ Queue → Order Service
```

**Order Creation Flow:**
```
1. Client → API Gateway → Product Service
   POST /products/buy
   
2. Product Service:
   - Create order in DB
   - Publish message to 'orders' queue
   
3. RabbitMQ:
   - Store message in queue
   
4. Order Service:
   - Consume message from queue
   - Process order
   - Update order status
```

**Message Structure:**
```json
{
  "username": "john_doe",
  "orderId": "507f1f77bcf86cd799439011",
  "products": [
    {
      "_id": "507f191e810c19729de860ea",
      "name": "iPhone 14",
      "price": 999,
      "quantity": 2
    }
  ]
}
```

---

## 🚀 CI/CD Workflows

### **Workflow 1: Simple CI/CD** (`ci-cd.yml`)
Fast deployment without E2E testing (~50s)

**Pipeline:**
```
Unit Tests (parallel) → Build & Push :latest → Done
  ├─ Auth tests (30s)
  └─ Product tests (30s)
       ↓
  Build 4 services (parallel, 12s)
       ↓
  Push to Docker Hub
```

**Features:**
- ✅ Node modules caching
- ✅ MongoDB binary caching
- ✅ Docker layer caching (GitHub Actions)
- ✅ Matrix parallelization

---

## 🧪 Testing Strategy

### **Unit Tests**
- **Framework:** Mocha, Chai, Sinon
- **Coverage:** Controllers, Services, Repositories
- **Mocking:** 
  - MongoDB: mongodb-memory-server
  - RabbitMQ: Sinon stubs
  - JWT Token: authHelper.js

---

## 🛠️ Technology Stack

| Category | Technologies |
|----------|-------------|
| **Runtime** | Node.js 18 (Alpine Linux) |
| **Framework** | Express.js |
| **Database** | MongoDB 6.0 |
| **Message Broker** | RabbitMQ 3.11 |
| **Authentication** | JWT, bcrypt |
| **Testing** | Mocha, Chai, Sinon |
| **Containerization** | Docker, Docker Compose |
| **CI/CD** | GitHub Actions |
| **Registry** | Docker Hub |

---

## 📦 Quick Start

### **Prerequisites**
- Docker & Docker Compose
- Node.js 18+ (for local development)

### **Run Locally**

```bash
# Clone repository
git clone https://github.com/HoangTuan-git/action_E_project.git
cd action_E_project

# Start all services
docker-compose up -d

# Check service health
docker-compose ps

# View logs
docker-compose logs -f

# Run E2E tests
cd e2e-test
npm install
npm test
```

### **Access Services**
- API Gateway: http://localhost:3003
- RabbitMQ Management: http://localhost:15672 (admin/admin)

---

## 📁 Project Structure

```
.
├── auth/                    # Authentication service
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── services/       # Business logic
│   │   ├── repositories/   # Data access
│   │   ├── models/         # MongoDB schemas
│   │   ├── routes/         # API routes
│   │   └── test/           # Unit tests
│   └── Dockerfile
│
├── product/                 # Product service
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── models/
│   │   ├── routes/
│   │   └── utils/
│   │       └── messageBroker.js  # RabbitMQ client
│   └── Dockerfile
│
├── order/                   # Order service
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── models/
│   │   └── utils/
│   │       └── messageBroker.js
│   └── Dockerfile
│
├── api-gateway/            # API Gateway
│   ├── index.js           # Proxy routing
│   └── Dockerfile
│
├── e2e-test/              # E2E test suite
│   ├── e2e.test.js       # Full test suite (10 tests)
│   └── e2e.lite.test.js  # Lite suite (1 test)
│
├── .github/
│   └── workflows/
│       ├── ci-cd.yml         # Simple workflow
│       └── ci-cd-e2e.yml     # Full workflow with E2E
│
├── docker-compose.yml         # Local development
├── docker-compose.e2e.yml     # E2E testing (build)
└── docker-compose.e2e.ci.yml  # CI/CD testing (pull)
```

---

## 🔐 Environment Variables

### **Auth Service**
```env
PORT=3000
JWT_SECRET=your_secret_key
MONGODB_AUTH_URI=mongodb://mongodb:27017/auth
```

### **Product Service**
```env
PORT=3001
JWT_SECRET=your_secret_key
MONGODB_PRODUCT_URI=mongodb://mongodb:27017/product
RABBITMQ_URI=amqp://admin:admin@rabbitmq:5672
RABBITMQ_QUEUE_PRODUCT=products
RABBITMQ_QUEUE_ORDER=orders
```

### **Order Service**
```env
PORT=3002
JWT_SECRET=your_secret_key
MONGODB_ORDER_URI=mongodb://mongodb:27017/order
RABBITMQ_URI=amqp://admin:admin@rabbitmq:5672
RABBITMQ_QUEUE_ORDER=orders
RABBITMQ_QUEUE_PRODUCT=products
```

### **API Gateway**
```env
PORT=3003
AUTH_SERVICE_URL=http://auth-service:3000
PRODUCT_SERVICE_URL=http://product-service:3001
ORDER_SERVICE_URL=http://order-service:3002
```

---

## 🎯 API Endpoints

### **Auth Service** (`/auth`)
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login (returns JWT)
- `GET /auth/dashboard` - Protected route (requires JWT)

### **Product Service** (`/products`)
- `GET /products` - List all products
- `POST /products` - Create product (protected)
- `POST /products/buy` - Create order (protected)

### **Order Service** (`/orders`)
- `GET /orders` - List user orders (protected)
- Message consumer for order processing

---

## 📊 Performance Metrics

### **CI/CD Performance**

| Workflow | Cold Cache | Warm Cache | Time Saved |
|----------|-----------|------------|------------|
| Simple CI/CD | 109s | 50s | 54% |

### **Cache Optimization**
- Node modules cache: ~9s saved per service
- MongoDB binary cache: ~15s saved
- Docker layer cache: ~10-15s saved per service

---


---

## 📝 License

This project is licensed under the MIT License.

---

## 👤 Author

**HoangTuan**
- GitHub: [@HoangTuan-git](https://github.com/HoangTuan-git)
- Repository: [action_E_project](https://github.com/HoangTuan-git/action_E_project)
---

## 🙏 Acknowledgments

- Built with modern microservices best practices
- CI/CD optimized for GitHub Actions
- Docker multi-stage builds for production efficiency
- Comprehensive testing strategy (unit + E2E)

---

**⭐ If you find this project helpful, please give it a star!**
