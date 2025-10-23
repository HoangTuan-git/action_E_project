// --- FIX: SET ENVIRONMENT VARIABLES FOR TEST ---
process.env.JWT_SECRET = 'test_secret_key_for_ci';
process.env.QUEUE_NAME = 'products';
process.env.RABBITMQ_QUEUE = 'orders';
// ----------------------------------------------

const chai = require("chai");
const chaiHttp = require("chai-http");
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const sinon = require('sinon');

// 1. IMPORT MessageBroker TRƯỚC TIÊN
const MessageBroker = require('../messageBroker'); // Giả định đường dẫn

// 2. TẠO STUBS (HÀM GIẢ) NGAY LẬP TỨC
// "Bẻ gãy" hàm connect thật, thay thế bằng một hàm giả vờ thành công
sinon.stub(MessageBroker, 'connect').resolves();

// "Bẻ gãy" hàm publish thật, thay thế bằng một stub để chúng ta theo dõi
const publishStub = sinon.stub(MessageBroker, 'publishMessage');

// 3. BÂY GIỜ MỚI IMPORT APP
// Khi app (hoặc các file con của nó) require('../messageBroker'),
// nó sẽ nhận được phiên bản đã bị "bẻ gãy" (stubbed)
const App = require("../app"); 
const { generateMockToken } = require('./authHelper');

chai.use(chaiHttp);
const expect = chai.expect;

describe("Product Service API (Unit/Integration)", () => {
  let app;
  let mongoServer;
  let authToken;
  // Bỏ fakeChannel, chúng ta không cần nó nữa

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

    // 3. Khởi tạo app
    app = new App();
    
    // 4. KHỞI ĐỘNG APP
    // Không cần mock app.setupMessageBroker nữa
    // vì MessageBroker.connect đã bị mock ở cấp toàn cục.
    // app.start() sẽ gọi MessageBroker.connect() (hàm giả) và thành công ngay.
    app.start();
    console.log(`Server started on port ${app.port || 3001}`);
  });

  // Hook chạy MỘT LẦN sau khi tất cả các test kết thúc
  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    app.stop();
    // Khôi phục lại các hàm thật (rất quan trọng)
    sinon.restore(); 
    console.log('In-memory MongoDB stopped and disconnected.');
  });

  // Hook chạy TRƯỚC MỖI bài test để dọn dẹp dữ liệu
  beforeEach(async () => {
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      await collection.deleteMany({});
    }
    // Dọn dẹp lịch sử mock
    publishStub.resetHistory();
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
        await chai.request(app.app).post("/").set("Authorization", `Bearer ${authToken}`).send(productData);
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
      
      // Reset mock
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
      expect(res.body.products[0]).to.have.property("_id", createdProduct._id);

      // 2. Kiểm tra xem mock MessageBroker.publishMessage có được gọi không
      expect(publishStub.calledOnce).to.be.true; // <-- SỬA Ở ĐÂY

      // 3. Lấy nội dung đã được gửi
      const callArgs = publishStub.firstCall.args;
      
      // Tham số đầu tiên (callArgs[0]) là TÊN QUEUE
      const queueName = callArgs[0];
      
      // Tham số thứ hai (callArgs[1]) là NỘI DUNG (đã là object)
      const message = callArgs[1];

      // 4. Kiểm tra TÊN QUEUE và NỘI DUNG MESSAGE
      expect(queueName).to.equal('orders');
      
      expect(message).to.have.property('username', 'testuser'); 
      expect(message.products[0]).to.have.property('_id', createdProduct._id);
      expect(message.products[0]).to.have.property('quantity', 2);
    });

    it("should return an error for an empty products array", async () => {
      const res = await chai
        .request(app.app)
        .post("/buy")
        .set("Authorization", `Bearer ${authToken}`)
        .send([]);

      expect(res).to.have.status(400);
      
      // Đảm bảo RabbitMQ KHÔNG được gọi
      expect(publishStub.called).to.be.false;
    });
  });
});

