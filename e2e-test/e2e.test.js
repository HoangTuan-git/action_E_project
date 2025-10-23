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
    it('should register and login to get JWT token', async () => {
      // Register
      const registerRes = await app
        .post('/auth/register')
        .send(testUser);
      
      console.log(`✅ Register response:`, registerRes.status);
      expect(registerRes).to.have.status(201);
      expect(registerRes.body).to.have.property('username', testUser.username);

      // Login
      const loginRes = await app
        .post('/auth/login')
        .send(testUser);
      
      expect(loginRes).to.have.status(200);
      expect(loginRes.body).to.have.property('token');
      
      authToken = loginRes.body.token;
      console.log(`✅ Token received: ${authToken.substring(0, 20)}...`);
    });
  });

  // ==================== PRODUCT SERVICE ====================
  describe('2. Product Service', () => {
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

      console.log(`✅ Product created:`, res.status, res.body._id);
      
      expect(res).to.have.status(201);
      expect(res.body).to.have.property('_id');
      expect(res.body).to.have.property('name', productData.name);
      
      createdProductId = res.body._id;
    });
  });

  // ==================== ORDER SERVICE (via Product /buy) ====================
  describe('3. Order Service', () => {
    it('should create order and verify in order service (with retry)', async function() {
      this.timeout(25000);
      
      expect(authToken).to.not.be.null;
      expect(createdProductId, 'Product ID must exist').to.not.be.null;

      // Step 1: Create order via Product service
      const orderData = [{ _id: createdProductId, quantity: 2 }];
      const createRes = await app
        .post('/products/buy')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData);

      console.log(`✅ Order created:`, createRes.status, createRes.body.status);
      expect(createRes).to.have.status(201);
      expect(createRes.body).to.have.property('_id');
      
      // Step 2: Verify order appears in Order service (with retry for RabbitMQ)
      let orders = [];
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        attempts++;
        
        const getRes = await app
          .get('/orders/')
          .set('Authorization', `Bearer ${authToken}`);

        console.log(`Attempt ${attempts}/${maxAttempts}: Orders found: ${getRes.body.length || 0}`);

        expect(getRes).to.have.status(200);
        orders = getRes.body;

        if (orders.length > 0) {
          console.log(`✅ Order verified in Order service`);
          expect(orders[0]).to.have.property('_id');
          expect(orders[0]).to.have.property('products').that.is.an('array');
          break;
        }

        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
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

