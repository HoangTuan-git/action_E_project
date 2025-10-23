const chai = require('chai');
const chaiHttp = require('chai-http');
chai.use(chaiHttp);

const { expect } = chai;

// URL của API Gateway, được truyền từ docker-compose.e2e.yml
// Ví dụ: http://api-gateway:80
const apiUrl = process.env.API_GATEWAY_URL;

describe('Full E2E Test via API Gateway', () => {
  let app;
  let authToken = null; // Sẽ lưu token thật
  let createdProductId = null; // Sẽ lưu ID sản phẩm
  let createdOrderId = null; // Sẽ lưu ID đơn hàng

  const testUser = {
    username: `testuser_${Date.now()}`,
    password: 'password123'
  };

  const testProduct = {
    name: 'E2E Test Product',
    price: 999
  };

  before(() => {
    // Tất cả request đều đi qua API Gateway
    app = chai.request(apiUrl);
  });

  // Giai đoạn 1: Test Auth Service (qua Gateway)
  describe('Phase 1: Auth Service (via Gateway)', () => {
    it('should register a new user', async () => {
      const res = await app.post('auth/register') // Giả sử route gateway là /register
        .send(testUser);
      
      expect(res).to.have.status(201);
      expect(res.body).to.have.property('username', testUser.username);
    });

    it('should log in and get a real JWT token', async () => {
      const res = await app.post('auth/login') // Giả sử route gateway là /login
        .send(testUser);
      
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('token');
      
      // LƯU TOKEN THẬT ĐỂ DÙNG CHO CÁC SERVICE KHÁC
      authToken = res.body.token; 
    });
  });

  // Giai đoạn 2.1: Test Product Service (qua Gateway, dùng token thật)
  describe('Phase 2: Product Service (via Gateway)', () => {
    it('should fail to create a product without a token', async () => {
      const res = await app.post('products/') 
        .send(testProduct);
      
      expect(res).to.have.status(401); // 401 Unauthorized
    });

    it('should create a new product with a valid token', async () => {
      expect(authToken, 'Auth token must exist to run this test').to.not.be.null;

      const res = await app.post('products/')
        .set('Authorization', `Bearer ${authToken}`) // Gửi token thật
        .send(testProduct);
      
      expect(res).to.have.status(201);
      expect(res.body).to.have.property('name', testProduct.name);
      
      // LƯU ID SẢN PHẨM để dùng cho Order Service
      createdProductId = res.body._id;
    });

    it('should get all products with a valid token', async () => {
      const res = await app.get('products/')
        .set('Authorization', `Bearer ${authToken}`);
        
      expect(res).to.have.status(200);
      expect(res.body).to.be.an('array');
      expect(res.body.length).to.be.greaterThan(0);
    });
  });

  // Giai đoạn 2.2: buy product qua Gateway
  describe('Phase 2.2: Buy Product (via Gateway)', () => {
    it('should fail to create an order with invalid product ID', async () => {
      expect(authToken, 'Auth token must exist').to.not.be.null;

      const orderData = [{ _id: 'invalid-id', quantity: 1 }];
      
      const res = await app.post('products/buy') // Giả sử route gateway là /buy
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData);
      
      // Giả sử service của bạn trả về 400 nếu sản phẩm không hợp lệ
      expect(res).to.have.status(400); 
    });

    it('should successfully create an order with valid data', async () => {
      expect(authToken, 'Auth token must exist').to.not.be.null;
      expect(createdProductId, 'Product ID must exist').to.not.be.null;

      const orderData = [{ _id: createdProductId, quantity: 2 }];

      const res = await app.post('products/buy')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData);

      expect(res).to.have.status(201);
      expect(res.body).to.have.property('_id');
      expect(res.body.products[0]).to.have.property('product_id', createdProductId);
      
      createdOrderId = res.body._id; // Lưu ID đơn hàng
    });
  });
  // Giai đoạn 3: Test Order Service (qua Gateway, dùng token thật)
  describe('Phase 3: Order Service (via Gateway)', () => {
    it('should get all orders for the user with a valid token', async () => {
      expect(authToken, 'Auth token must exist').to.not.be.null;
      const res = await app.get('orders/') // Giả sử route gateway là /orders
        .set('Authorization', `Bearer ${authToken}`);

      expect(res).to.have.status(200);
      expect(res.body).to.be.an('array');
      // Kiểm tra xem đơn hàng vừa tạo có nằm trong danh sách không
      const found = res.body.some(order => order._id === createdOrderId);
      expect(found).to.be.true;
    });
    it('should not get orders without a token', async () => {
      const res = await app.get('orders/'); // Giả sử route gateway là /orders
      expect(res).to.have.status(401); // 401 Unauthorized
    });
  });
});
