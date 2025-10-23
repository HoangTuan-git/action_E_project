// --- FIX: SET ENVIRONMENT VARIABLES FOR TEST ---
process.env.NODE_ENV = 'test'; // Quan trọng: Để skip long polling
process.env.JWT_SECRET = 'test_secret_key_for_ci';
process.env.RABBITMQ_QUEUE_PRODUCT = 'products'; // Đúng tên biến trong config.js
process.env.RABBITMQ_QUEUE_ORDER = 'orders';     // Đúng tên biến trong config.js
// ----------------------------------------------

const chai = require("chai");
const chaiHttp = require("chai-http");
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const sinon = require('sinon');

// 1. IMPORT MessageBroker TRƯỚC TIÊN (Đúng đường dẫn!)
const MessageBroker = require('../utils/messageBroker');

// 2. TẠO STUBS (HÀM GIẢ)
// MessageBroker là singleton instance, nên stub trực tiếp trên instance
const connectStub = sinon.stub(MessageBroker, 'connect').resolves();
const publishStub = sinon.stub(MessageBroker, 'publishMessage').resolves();
const consumeStub = sinon.stub(MessageBroker, 'consumeMessage').resolves();

// 3. BÂY GIỜ MỚI IMPORT APP CLASS
const App = require("../app"); 
const { generateMockToken } = require('./authHelper');

chai.use(chaiHttp);
const expect = chai.expect;

describe("Product Service API (Unit/Integration)", () => {
  let app; 
  let mongoServer;
  let authToken;

  // Hook này chạy MỘT LẦN trước tất cả các test
  before(async () => {
    // 1. Khởi tạo MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('In-memory MongoDB connected for product tests.');

    // 2. Tạo mock token
    authToken = generateMockToken();
    console.log('Generated mock auth token for tests.');
    
    // 3. KHỞI ĐỘNG APP
    app = new App();
    
    // Không cần gọi setupMessageBroker vì đã mock rồi
    // app.start() chỉ khởi động server
    app.start();
    console.log(`Server started on port ${app.port || 3001}`);
  });

  // Hook chạy MỘT LẦN sau khi tất cả các test kết thúc
  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    if (app && app.server) {
      app.server.close();
    }
    sinon.restore(); // Phục hồi lại tất cả stubs
    console.log('In-memory MongoDB stopped and disconnected.');
  });

  // Hook chạy TRƯỚC MỖI bài test để dọn dẹp dữ liệu
  beforeEach(async () => {
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      await collection.deleteMany({});
    }
    publishStub.resetHistory(); // Reset lịch sử của stub
    consumeStub.resetHistory(); // Reset lịch sử của consumeStub
  });

  // ... (describe "POST /" và "GET /" không thay đổi) ...
  
  describe("POST /", () => {
    it("should create a new product with a valid token and data", async () => {
      const productData = { name: "Laptop", description: "A powerful laptop", price: 1200 };
      const res = await chai
        .request(app.app)
        .post("/")
        .set("Authorization", `Bearer ${authToken}`)
        .send(productData);

      expect(res).to.have.status(201);
      expect(res.body).to.have.property("_id");
      expect(res.body).to.have.property("name", productData.name);
    });
  });

  describe("GET /", () => {
    beforeEach(async () => {
        const productData = { name: "Keyboard", description: "Mechanical keyboard", price: 75 };
        await chai.request(app.app)
            .post("/")
            .set("Authorization", `Bearer ${authToken}`)
            .send(productData);
    });

    it("should get all products with a valid token", async () => {
      const res = await chai
        .request(app.app)
        .get("/")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res).to.have.status(200);
      expect(res.body).to.be.an("array");
      expect(res.body.length).to.equal(1);
    });
  });

  // Test block cho việc mua hàng
  describe("POST /buy", () => {
    let createdProduct;

    beforeEach(async () => {
      const productData = { name: "Webcam", description: "HD Webcam", price: 50 };
      const res = await chai
        .request(app.app)
        .post("/")
        .set("Authorization", `Bearer ${authToken}`)
        .send(productData);
      createdProduct = res.body;
      
      publishStub.resetHistory();
    });

    it("should create an order AND send a message to RabbitMQ", async () => {
      const orderData = [{ _id: createdProduct._id, quantity: 2 }];

      const res = await chai
        .request(app.app)
        .post("/buy")
        .set("Authorization", `Bearer ${authToken}`)
        .send(orderData);

      // 1. Kiểm tra response từ API
      expect(res).to.have.status(201);
      expect(res.body).to.have.property("_id");
      expect(res.body).to.have.property("products").that.is.an("array");
      expect(res.body).to.have.property("status", "pending");
      expect(res.body).to.have.property("username", "testuser");
      
      // So sánh _id trong response (có thể là ObjectId hoặc string)
      const responseProductId = res.body.products[0]._id;
      expect(responseProductId.toString()).to.equal(createdProduct._id);

      // 2. Kiểm tra xem mock MessageBroker.publishMessage có được gọi không
      console.log('publishStub.callCount:', publishStub.callCount);
      console.log('publishStub.called:', publishStub.called);
      if (publishStub.firstCall) {
        console.log('publishStub.firstCall.args:', publishStub.firstCall.args);
      }
      
      expect(publishStub.calledOnce).to.be.true;

      // 3. Lấy nội dung đã được gửi
      const callArgs = publishStub.firstCall.args;
      
      const queueName = callArgs[0];
      const message = callArgs[1];
      
      // Debug: In ra để xem structure
      console.log('createdProduct._id:', createdProduct._id, typeof createdProduct._id);
      console.log('message.products[0]._id:', message.products[0]._id, typeof message.products[0]._id);

      // 4. Kiểm tra TÊN QUEUE và NỘI DUNG MESSAGE
      expect(queueName).to.equal('orders');
      
      expect(message).to.have.property('username', 'testuser'); 
      expect(message).to.have.property('orderId');
      expect(message.products).to.be.an('array');
      expect(message.products).to.have.lengthOf(1);
      
      // So sánh _id: convert ObjectId thành string
      expect(message.products[0]._id.toString()).to.equal(createdProduct._id);
      expect(message.products[0]).to.have.property('quantity', 2);
      expect(message.products[0]).to.have.property('name', 'Webcam');
      expect(message.products[0]).to.have.property('price', 50);
    });

    it("should return an error for an empty products array", async () => {
      const res = await chai
        .request(app.app)
        .post("/buy")
        .set("Authorization", `Bearer ${authToken}`)
        .send([]);

      expect(res).to.have.status(400);
      
      expect(publishStub.called).to.be.false;
    });
  });
});

