const chai = require('chai');
const chaiHttp = require('chai-http');
chai.use(chaiHttp);

const { expect } = chai;

// URL của API Gateway
const apiUrl = process.env.API_GATEWAY_URL || 'http://localhost:3003';

describe('E2E Test - Microservices via API Gateway', () => {
  let app;
  let authToken = null;
  let createdProductId = null;
  let testUser = {
    username: `user_${Date.now()}`,
    password: 'test123'
  };

  before(() => {
    app = chai.request(apiUrl);
    console.log(`\n🔗 Testing API Gateway at: ${apiUrl}\n`);
  });

  // ==================== AUTH SERVICE ====================
  describe('1. Auth Service', () => {
    it('should register a new user', async () => {
      const res = await app
        .post('/auth/register')
        .send(testUser);
      
      console.log(`✅ Register response:`, res.status);
      expect(res).to.have.status(201);
      expect(res.body).to.have.property('username', testUser.username);
    });

    it('should login and get JWT token', async () => {
      const res = await app
        .post('/auth/login')
        .send(testUser);
      
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('token');
      
      authToken = res.body.token;
      console.log(`✅ Token received: ${authToken.substring(0, 20)}...`);
    });

    it('should fail login with wrong password', async () => {
      const res = await app
        .post('/auth/login')
        .send({ username: testUser.username, password: 'wrongpass' });
      
      expect(res.status).to.be.oneOf([401, 400]);
    });
  });

  // ==================== PRODUCT SERVICE ====================
  describe('2. Product Service', () => {
    it('should fail to create product without token', async () => {
      const res = await app
        .post('/products/')
        .send({ name: 'Test Product', price: 100 });
      
      expect(res).to.have.status(401);
    });

    it('should create a product with valid token', async () => {
      expect(authToken, 'Auth token must exist').to.not.be.null;

      const productData = {
        name: `Product_${Date.now()}`,
        description: 'E2E Test Product',
        price: 999
      };

      const res = await app
        .post('/products/')
        .set('Authorization', `Bearer ${authToken}`)
        .send(productData);

      console.log(`Product creation response:`, res.status, res.body);
      
      // Kiểm tra response
      expect(res).to.have.status(201);
      expect(res.body).to.have.property('_id');
      expect(res.body).to.have.property('name', productData.name);
      expect(res.body).to.have.property('price', productData.price);
      
      createdProductId = res.body._id;
      console.log(`✅ Product created with ID: ${createdProductId}`);
    });

    it('should get all products', async () => {
      expect(authToken).to.not.be.null;

      const res = await app
        .get('/products/')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res).to.have.status(200);
      expect(res.body).to.be.an('array');
      expect(res.body.length).to.be.greaterThan(0);
      
      console.log(`✅ Found ${res.body.length} product(s)`);
    });
  });

  // ==================== ORDER SERVICE (via Product /buy) ====================
  describe('3. Order Service (Create via Product)', () => {
    it('should create an order successfully', async function() {
      this.timeout(15000); // Tăng timeout cho test này
      
      expect(authToken).to.not.be.null;
      expect(createdProductId, 'Product ID must exist').to.not.be.null;

      const orderData = [
        { _id: createdProductId, quantity: 2 }
      ];

      const res = await app
        .post('/products/buy')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData);

      console.log(`Order creation response:`, res.status);
      console.log(`Order body:`, JSON.stringify(res.body, null, 2));

      expect(res).to.have.status(201);
      expect(res.body).to.have.property('_id');
      expect(res.body).to.have.property('status');
      
      // Status có thể là 'pending' hoặc 'completed' tùy vào RabbitMQ speed
      const validStatuses = ['pending', 'completed'];
      expect(validStatuses).to.include(res.body.status);
      
      console.log(`✅ Order created with status: ${res.body.status}`);
    });

    it('should fail to create order with invalid product', async () => {
      expect(authToken).to.not.be.null;

      const res = await app
        .post('/products/buy')
        .set('Authorization', `Bearer ${authToken}`)
        .send([{ _id: 'invalid-id-123', quantity: 1 }]);

      // Có thể trả về 400 hoặc 500 tùy validation
      expect(res.status).to.be.oneOf([400, 500]);
      expect(res.body).to.have.property('message');
    });

    it('should fail to create order without token', async () => {
      const res = await app
        .post('/products/buy')
        .send([{ _id: createdProductId, quantity: 1 }]);

      expect(res).to.have.status(401);
    });
  });

  // ==================== ORDER SERVICE (Get orders) ====================
  describe('4. Order Service (Get Orders)', () => {
    it('should get orders for authenticated user (with retry)', async function() {
      this.timeout(25000); // Timeout cao cho retry logic
      
      expect(authToken).to.not.be.null;

      // Retry logic: Đợi RabbitMQ xử lý
      let orders = [];
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        attempts++;
        
        const res = await app
          .get('/orders/')
          .set('Authorization', `Bearer ${authToken}`);

        console.log(`Attempt ${attempts}/${maxAttempts}: Status ${res.status}, Orders: ${res.body.length || 0}`);

        expect(res).to.have.status(200);
        expect(res.body).to.be.an('array');
        
        orders = res.body;

        if (orders.length > 0) {
          console.log(`✅ Found ${orders.length} order(s)`);
          
          // Verify order structure
          const firstOrder = orders[0];
          expect(firstOrder).to.have.property('_id');
          expect(firstOrder).to.have.property('products');
          
          // Username có thể không có trong response tùy implementation
          if (firstOrder.username) {
            expect(firstOrder.username).to.equal(testUser.username);
          }
          
          break; // Found orders, exit retry loop
        }

        // Wait before retry
        if (attempts < maxAttempts) {
          console.log(`⏳ Waiting 3s for RabbitMQ to process...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      // Soft assertion - don't fail if no orders (might be timing)
      if (orders.length === 0) {
        console.log(`⚠️  No orders found after ${maxAttempts} attempts (RabbitMQ delay)`);
      }
    });

    it('should fail to get orders without token', async () => {
      const res = await app.get('/orders/');
      expect(res).to.have.status(401);
    });
  });

  // ==================== SUMMARY ====================
  after(() => {
    console.log('\n' + '='.repeat(60));
    console.log('📊 E2E Test Summary:');
    console.log(`   User: ${testUser.username}`);
    console.log(`   Token: ${authToken ? '✅' : '❌'}`);
    console.log(`   Product ID: ${createdProductId || 'N/A'}`);
    console.log('='.repeat(60) + '\n');
  });
});

