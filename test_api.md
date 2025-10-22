### Base URLs
- **API Gateway**: `http://localhost:3003`
- **Auth Service**: `http://localhost:3000` (Direct)
- **Product Service**: `http://localhost:3001` (Direct)
- **Order Service**: `http://localhost:3002` (Direct)


## 1. Authentication Service APIs

## 1.1 Register User
**Method**: POST  
**URL**: `http://localhost:3003/auth/register`  
**Headers**:
```
Content-Type: application/json
```
**Body** (JSON):
```json
{
  "username": "testuser",
  "password": "password123",
  "email": "testuser@example.com"
}
```

### 1.2 Login User
**Method**: POST  
**URL**: `http://localhost:3003/auth/login`  
**Headers**:
```
Content-Type: application/json
```
**Body** (JSON):
```json
{
  "username": "testuser",
  "password": "password123"
}
```
**⚠️ Lưu token để sử dụng cho các API khác**

### 1.3 Get Profile
**Method**: POST  
**URL**: `http://localhost:3003/auth/profile`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer <your_jwt_token>
```
**Body** (JSON):
```json
{
  "username": "testuser"
}
```

### 1.4 Dashboard (Protected Route)
**Method**: GET  
**URL**: `http://localhost:3003/auth/dashboard`  
**Headers**:
```
Authorization: Bearer <your_jwt_token>
```

### 1.5 Delete User
**Method**: DELETE  
**URL**: `http://localhost:3003/auth/deluser`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer <your_jwt_token>
```
**Body** (JSON):
```json
{
  "username": "testuser"
}
```

## 2. Product Service APIs

**⚠️ Tất cả Product APIs yêu cầu authentication token**

### 2.1 Create Product
**Method**: POST  
**URL**: `http://localhost:3003/products/`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer <your_jwt_token>
```
**Body** (JSON):
```json
{
  "name": "iPhone 15",
  "description": "Latest iPhone model",
  "price": 999.99,
  "category": "Electronics",
  "stock": 50
}
```

### 2.2 Get All Products
**Method**: GET  
**URL**: `http://localhost:3003/products/`  
**Headers**:
```
Authorization: Bearer <your_jwt_token>
```

### 2.3 Buy Product (Create Order)
**Method**: POST  
**URL**: `http://localhost:3003/products/buy`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer <your_jwt_token>
```
**Body** (JSON):
```json
{
  "productId": "product_id_here",
  "quantity": 2,
  "shippingAddress": "123 Main St, City, Country"
}
```

### 2.4 Get Order by ID (from Product Service)
**Method**: GET  
**URL**: `http://localhost:3003/products/{order_id}`  
**Headers**:
```
Authorization: Bearer <your_jwt_token>
```

## 3. Order Service APIs

**⚠️ Tất cả Order APIs yêu cầu authentication token**

### 3.1 Get All Orders
**Method**: GET  
**URL**: `http://localhost:3003/orders/`  
**Headers**:
```
Authorization: Bearer <your_jwt_token>
```

### 3.2 Get Order by ID
**Method**: GET  
**URL**: `http://localhost:3003/orders/{order_id}`  
**Headers**:
```
Authorization: Bearer <your_jwt_token>
```

## Test Flow Scenarios

### Scenario 1: Complete User Journey
1. **Register** một user mới
2. **Login** để lấy token
3. **Create Product** để có sản phẩm test
4. **Get All Products** để xem danh sách
5. **Buy Product** để tạo order
6. **Get All Orders** để xem orders
7. **Get Order by ID** để xem chi tiết order

### Scenario 2: Authentication Testing
1. Thử gọi các protected APIs mà không có token → Expect 401 Unauthorized
2. Thử gọi với token không hợp lệ → Expect 401 Unauthorized
3. Thử gọi với token hợp lệ → Expect 200 OK

### Scenario 3: Error Handling
1. **Register** với thông tin trùng lặp → Expect 400 Bad Request
2. **Login** với sai thông tin → Expect 401 Unauthorized
3. **Create Product** với dữ liệu thiếu → Expect 400 Bad Request
4. **Buy Product** với productId không tồn tại → Expect 404 Not Found