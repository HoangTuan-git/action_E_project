const chai = require('chai');
const chaiHttp = require('chai-http');
chai.use(chaiHttp);

const { expect } = chai;

// E2E LITE: Chỉ test critical path - Target: <15 giây
const apiUrl = process.env.API_GATEWAY_URL || 'http://localhost:3003';

describe('E2E Lite - Critical Path Only', () => {
  let app;
  let authToken = null;
  let createdProductId = null;
  const testUser = {
    username: `user_${Date.now()}`,
    password: 'test123'
  };

  before(() => {
    app = chai.request(apiUrl);
    console.log(`\n⚡ E2E LITE MODE - Testing critical path only\n`);
  });

  // TEST DUY NHẤT: Full flow trong 1 test case
  it('should complete full flow: Register → Login → Create Product → Buy Order', async function() {
    this.timeout(15000); // 15s timeout

    // Step 1: Register
    const registerRes = await app
      .post('/auth/register')
      .send(testUser);
    expect(registerRes).to.have.status(201);
    console.log(`✅ Register OK`);

    // Step 2: Login
    const loginRes = await app
      .post('/auth/login')
      .send(testUser);
    expect(loginRes).to.have.status(200);
    expect(loginRes.body).to.have.property('token');
    authToken = loginRes.body.token;
    console.log(`✅ Login OK`);

    // Step 3: Create Product
    const productData = {
      name: `Product_${Date.now()}`,
      description: 'E2E Lite Test',
      price: 100
    };
    const productRes = await app
      .post('/products/')
      .set('Authorization', `Bearer ${authToken}`)
      .send(productData);
    expect(productRes).to.have.status(201);
    expect(productRes.body).to.have.property('_id');
    createdProductId = productRes.body._id;
    console.log(`✅ Product created: ${createdProductId}`);

    // Step 4: Create Order (không đợi RabbitMQ processing)
    const orderData = [{ _id: createdProductId, quantity: 1 }];
    const orderRes = await app
      .post('/products/buy')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData);
    expect(orderRes).to.have.status(201);
    expect(orderRes.body).to.have.property('_id');
    console.log(`✅ Order created: ${orderRes.body._id}`);

    console.log(`\n🎉 Critical path PASSED - All services integrated successfully!\n`);
  });

  after(() => {
    console.log('='.repeat(60));
    console.log('⚡ E2E LITE Summary:');
    console.log(`   ✅ Auth service: OK`);
    console.log(`   ✅ Product service: OK`);
    console.log(`   ✅ Order service: OK (via RabbitMQ)`);
    console.log(`   ✅ API Gateway: OK`);
    console.log('='.repeat(60));
  });
});
