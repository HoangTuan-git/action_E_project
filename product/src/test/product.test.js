/**
 * Product Service - Unit Tests
 * 
 * Test coverage:
 * - Product CRUD operations
 * - Order creation with RabbitMQ integration (mocked)
 * - JWT authentication middleware
 * 
 * Test environment:
 * - MongoDB: In-memory (mongodb-memory-server)
 * - RabbitMQ: Mocked with Sinon stubs
 * - Auth: Mock JWT tokens (no real auth service)
 * 
 * IMPORTANT: Environment variables must be set BEFORE imports
 */

// ============================================================
// STEP 1: Set environment variables FIRST
// Must happen before any imports that use config
// ============================================================
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key_for_ci';
process.env.RABBITMQ_QUEUE_PRODUCT = 'products';
process.env.RABBITMQ_QUEUE_ORDER = 'orders';

// ============================================================
// STEP 2: Import dependencies
// ============================================================
const chai = require("chai");
const chaiHttp = require("chai-http");
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const sinon = require('sinon');

// ============================================================
// STEP 3: Import and stub MessageBroker BEFORE importing App
// Critical: Must stub before App loads to prevent real connections
// ============================================================
const MessageBroker = require('../utils/messageBroker');

// Create stubs for all MessageBroker methods
const messageBrokerStubs = {
  connect: sinon.stub(MessageBroker, 'connect').resolves(),
  publish: sinon.stub(MessageBroker, 'publishMessage').resolves(),
  consume: sinon.stub(MessageBroker, 'consumeMessage').resolves()
};

// ============================================================
// STEP 4: Now safe to import App (uses stubbed MessageBroker)
// ============================================================
const App = require("../app");
const { generateMockToken } = require('./authHelper');

chai.use(chaiHttp);
const { expect } = chai;

describe("Product Service - API Tests", () => {
  // Test fixtures
  let app;
  let mongoServer;
  let authToken;

  /**
   * SETUP - Runs once before all tests
   * 1. Start in-memory MongoDB
   * 2. Connect Mongoose
   * 3. Generate mock JWT token
   * 4. Start Express app (with mocked RabbitMQ)
   */
  before(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ In-memory MongoDB connected');

    // Generate mock JWT token (bypasses Auth service)
    authToken = generateMockToken();
    console.log('✅ Mock JWT token generated');

    // Start app with mocked MessageBroker
    app = new App();
    app.start();
    console.log('✅ Product service started (RabbitMQ mocked)');
  });

  /**
   * TEARDOWN - Runs once after all tests
   * Clean up in reverse order of setup
   */
  after(async () => {
    // Close app server
    if (app?.server) {
      app.server.close();
    }

    // Disconnect MongoDB
    await mongoose.disconnect();
    await mongoServer.stop();

    // Restore all Sinon stubs
    sinon.restore();
    
    console.log('✅ Test environment cleaned up');
  });

  /**
   * BEFORE EACH TEST
   * 1. Clear all MongoDB collections
   * 2. Reset stub call history (for fresh assertions)
   */
  beforeEach(async () => {
    // Clear database
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }

    // Reset stub history
    messageBrokerStubs.publish.resetHistory();
    messageBrokerStubs.consume.resetHistory();
  });

  /**
   * TEST SUITE: POST / (Create Product)
   * 
   * Tests product creation with RabbitMQ message publishing
   * Verifies:
   * - Product saved to MongoDB
   * - RabbitMQ message published with correct data
   * - HTTP 201 response with product details
   */
  describe("POST / - Create Product", () => {
    it("should create a new product and publish message to RabbitMQ", async () => {
      const newProduct = { 
        name: "Laptop", 
        description: "A powerful laptop", 
        price: 1200 
      };

      const res = await chai
        .request(app.app)
        .post("/")
        .set("Authorization", `Bearer ${authToken}`)
        .send(newProduct);

      // Verify HTTP response
      expect(res).to.have.status(201);
      expect(res.body).to.have.property("_id");
      expect(res.body).to.have.property("name", newProduct.name);
      expect(res.body).to.have.property("price", newProduct.price);

      // Verify RabbitMQ message was published
      expect(messageBrokerStubs.publish.calledOnce).to.be.true;
    });
  });

  /**
   * TEST SUITE: GET / (List Products)
   * 
   * Tests product listing functionality
   * Verifies:
   * - Products can be retrieved from database
   * - Response contains array of products
   * - Protected route requires valid JWT token
   */
  describe("GET / - List Products", () => {
    // Create a product before each test for consistent test data
    beforeEach(async () => {
      const testProduct = { 
        name: "Keyboard", 
        description: "Mechanical keyboard", 
        price: 75 
      };
      
      await chai
        .request(app.app)
        .post("/")
        .set("Authorization", `Bearer ${authToken}`)
        .send(testProduct);
    });

    it("should get all products with valid authentication", async () => {
      const res = await chai
        .request(app.app)
        .get("/")
        .set("Authorization", `Bearer ${authToken}`);

      // Verify response
      expect(res).to.have.status(200);
      expect(res.body).to.be.an("array");
      expect(res.body.length).to.equal(1);
      expect(res.body[0]).to.have.property("name", "Keyboard");
    });
  });

  /**
   * TEST SUITE: POST /buy (Create Order)
   * 
   * Most complex test suite - validates order creation with RabbitMQ integration
   * 
   * Flow:
   * 1. Create a test product (in beforeEach)
   * 2. Send order request with product ID and quantity
   * 3. Verify order created in database
   * 4. Verify RabbitMQ message published to 'orders' queue
   * 5. Verify message contains correct order details
   * 
   * Important: Uses publishStub.resetHistory() to ensure clean state
   */
  describe("POST /buy - Create Order", () => {
    let createdProduct;

    // Setup: Create a test product before each test
    beforeEach(async () => {
      const testProduct = { 
        name: "Webcam", 
        description: "HD Webcam", 
        price: 50 
      };
      
      const res = await chai
        .request(app.app)
        .post("/")
        .set("Authorization", `Bearer ${authToken}`)
        .send(testProduct);
      
      createdProduct = res.body;
      
      // IMPORTANT: Reset stub history after product creation
      // This ensures our order tests only count the BUY operation's publish call
      messageBrokerStubs.publish.resetHistory();
    });

    it("should create an order and publish message to RabbitMQ", async () => {
      const orderData = [
        { 
          _id: createdProduct._id, 
          quantity: 2 
        }
      ];

      const res = await chai
        .request(app.app)
        .post("/buy")
        .set("Authorization", `Bearer ${authToken}`)
        .send(orderData);

      // Step 1: Verify HTTP response
      expect(res).to.have.status(201);
      expect(res.body).to.have.property("_id");
      expect(res.body).to.have.property("products").that.is.an("array");
      expect(res.body).to.have.property("status", "pending");
      expect(res.body).to.have.property("username", "testuser");
      
      // Verify product ID in order (handle ObjectId conversion)
      const responseProductId = res.body.products[0]._id;
      expect(responseProductId.toString()).to.equal(createdProduct._id);

      // Step 2: Verify RabbitMQ publish was called once
      expect(messageBrokerStubs.publish.calledOnce).to.be.true;

      // Step 3: Extract published message details
      const publishCallArgs = messageBrokerStubs.publish.firstCall.args;
      const queueName = publishCallArgs[0];
      const publishedMessage = publishCallArgs[1];
      
      // Step 4: Verify queue name
      expect(queueName).to.equal('orders');
      
      // Step 5: Verify message structure
      expect(publishedMessage).to.have.property('username', 'testuser'); 
      expect(publishedMessage).to.have.property('orderId');
      expect(publishedMessage.products).to.be.an('array');
      expect(publishedMessage.products).to.have.lengthOf(1);
      
      // Step 6: Verify product details in message (convert ObjectId to string for comparison)
      expect(publishedMessage.products[0]._id.toString()).to.equal(createdProduct._id);
      expect(publishedMessage.products[0]).to.have.property('quantity', 2);
      expect(publishedMessage.products[0]).to.have.property('name', 'Webcam');
      expect(publishedMessage.products[0]).to.have.property('price', 50);
    });

    it("should return 400 error for empty products array", async () => {
      const res = await chai
        .request(app.app)
        .post("/buy")
        .set("Authorization", `Bearer ${authToken}`)
        .send([]);

      // Verify error response
      expect(res).to.have.status(400);
      
      // Verify RabbitMQ publish was NOT called (invalid request)
      expect(messageBrokerStubs.publish.called).to.be.false;
    });
  });
});

