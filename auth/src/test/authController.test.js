/**
 * Auth Service - Unit Tests
 * 
 * Test coverage:
 * - User registration (POST /register)
 * - User login (POST /login)
 * - Dashboard access with JWT (GET /dashboard)
 * 
 * Test environment:
 * - MongoDB: In-memory (mongodb-memory-server)
 * - Auth: JWT tokens generated on login
 */

const chai = require("chai");
const chaiHttp = require("chai-http");
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const App = require("../app");
require("dotenv").config();

chai.use(chaiHttp);
const { expect } = chai;

describe("Auth Service - User Authentication API", () => {
  // Test fixtures
  let app;
  let mongoServer;
  let authToken;

  /**
   * SETUP - Runs once before all tests
   * 1. Start in-memory MongoDB
   * 2. Connect Mongoose to test database
   * 3. Start Express app
   */
  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ In-memory MongoDB connected');

    // Start app (uses existing Mongoose connection)
    app = new App();
    app.start();
    console.log('✅ Auth service started');
  });

  /**
   * TEARDOWN - Runs once after all tests
   * Clean up resources in reverse order
   */
  after(async () => {
    app.stop();
    await mongoose.disconnect();
    await mongoServer.stop();
    console.log('✅ Test environment cleaned up');
  });

  /**
   * BEFORE EACH TEST
   * Clear all collections to ensure test isolation
   */
  beforeEach(async () => {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  });

  /**
   * TEST SUITE: User Registration
   */
  describe("POST /register - User Registration", () => {
    
    it("should register a new user successfully", async () => {
      const newUser = { 
        username: "testuser", 
        password: "password" 
      };

      const res = await chai
        .request(app.app)
        .post("/register")
        .send(newUser);

      expect(res).to.have.status(201);
      expect(res.body).to.be.an('object');
      expect(res.body).to.have.property("username", newUser.username);
      // Password should NOT be in response
      expect(res.body).to.not.have.property("password");
    });

    it("should reject duplicate username", async () => {
      const user = { 
        username: "testuser", 
        password: "password" 
      };

      // Register first time - should succeed
      await chai.request(app.app).post("/register").send(user);

      // Register second time with same username - should fail
      const res = await chai
        .request(app.app)
        .post("/register")
        .send(user);

      expect(res).to.have.status(400);
      expect(res.body).to.have.property("message", "Username already taken");
    });
  });

  /**
   * TEST SUITE: User Login
   */
  describe("POST /login - User Login", () => {
    
    // Create test user before each login test
    beforeEach(async () => {
      await chai
        .request(app.app)
        .post("/register")
        .send({ username: "testuser", password: "password" });
    });

    it("should return JWT token for valid credentials", async () => {
      const credentials = { 
        username: "testuser", 
        password: "password" 
      };

      const res = await chai
        .request(app.app)
        .post("/login")
        .send(credentials);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property("token");
      expect(res.body.token).to.be.a('string');
      
      // Save token for dashboard tests
      authToken = res.body.token;
    });

    it("should reject invalid username", async () => {
      const res = await chai
        .request(app.app)
        .post("/login")
        .send({ username: "invaliduser", password: "password" });

      expect(res).to.have.status(400);
      expect(res.body).to.have.property("message", "Invalid username or password");
    });

    it("should reject invalid password", async () => {
      const res = await chai
        .request(app.app)
        .post("/login")
        .send({ username: "testuser", password: "wrongpassword" });

      expect(res).to.have.status(400);
      expect(res.body).to.have.property("message", "Invalid username or password");
    });
  });

  /**
   * TEST SUITE: Dashboard Access (Protected Route)
   */
  describe("GET /dashboard - Protected Route", () => {
    
    // Setup: Register user and login to get fresh token
    beforeEach(async () => {
      await chai
        .request(app.app)
        .post("/register")
        .send({ username: "testuser", password: "password" });
      
      const loginRes = await chai
        .request(app.app)
        .post("/login")
        .send({ username: "testuser", password: "password" });
      
      authToken = loginRes.body.token;
    });

    it("should allow access with valid JWT token", async () => {
      const res = await chai
        .request(app.app)
        .get("/dashboard")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property("message", "Welcome to dashboard");
    });

    it("should reject request without token", async () => {
      const res = await chai
        .request(app.app)
        .get("/dashboard");

      expect(res).to.have.status(401);
    });

    it("should reject request with invalid token", async () => {
      const res = await chai
        .request(app.app)
        .get("/dashboard")
        .set("Authorization", "Bearer invalid.token.here");

      expect(res).to.have.status(401);
    });
  });
});
