// --- FIX: SET ENVIRONMENT VARIABLES FOR TEST ---
// Đặt các biến môi trường NÀY TRƯỚC khi require app
// Rất quan trọng để code config của bạn đọc đúng tên queue
process.env.JWT_SECRET = 'test_secret_key_for_ci';
process.env.QUEUE_NAME = 'products'; // Tên queue của product (nếu có)
process.env.RABBITMQ_QUEUE = 'orders'; // Tên queue của order (quan trọng)
// ----------------------------------------------

const chai = require("chai");
const chaiHttp = require("chai-http");
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const sinon = require('sinon');
const App = require("../app"); // Đảm bảo đường dẫn này đúng
const { generateMockToken } = require('./authHelper');


chai.use(chaiHttp);
const expect = chai.expect;

describe("Product Service API (Unit/Integration)", () => {
  let app;
  let mongoServer;
  let authToken;
  let fakeChannel; // Biến giữ kênh RabbitMQ giả

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
    // 4. MOCK RABBITMQ (Rất quan trọng)
    // Tạo channel giả
    fakeChannel = {
      sendToQueue: sinon.stub(),
      assertQueue: sinon.stub(),
      // Thêm bất kỳ hàm nào khác mà app.setupMessageBroker() có thể gọi
    };

    // 3. Khởi tạo app
    app = new App();

    
    // Stub (làm giả) hàm setupMessageBroker để sử dụng fakeChannel
    
    sinon.stub(app, 'setupMessageBroker').callsFake(() => {
      console.log('Mocked setupMessageBroker: Bỏ qua kết nối RabbitMQ thật.');
      app.brokerChannel = fakeChannel; 
      return Promise.resolve();
    });
    
    // 5. Khởi động app
    // KHÔNG GỌI app.connectDB()
    app.start();
    console.log(`Server started on port ${app.port || 3001}`); // Thêm log
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
    // Dọn dẹp lịch sử mock (nếu có)
    if (fakeChannel) {
        fakeChannel.sendToQueue.resetHistory();
    }
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
      
      // Reset mock *sau khi* tạo sản phẩm, phòng trường hợp POST / cũng trigger RabbitMQ
      fakeChannel.sendToQueue.resetHistory();
    });

    it("should create an order AND send a message to RabbitMQ", async () => {
      const orderData = [{ _id: createdProduct._id, quantity: 2 }];

      const res = await chai
        .request(app.app)
        .post("/buy")
        .set("Authorization", `Bearer ${authToken}`)
        .send(orderData);

      // --- SỬA LỖI BẮT ĐẦU TỪ ĐÂY ---

      // 1. Kiểm tra response từ API
      expect(res).to.have.status(201);
      expect(res.body).to.have.property("_id");
      expect(res.body).to.have.property("products").that.is.an("array");
      expect(res.body.products[0]).to.have.property("_id", createdProduct._id);

      // 2. Kiểm tra xem mock RabbitMQ (fakeChannel) có được gọi không
      expect(fakeChannel.sendToQueue.calledOnce).to.be.true;

      // 3. Lấy nội dung đã được gửi cho RabbitMQ
      // .firstCall.args là một mảng: [arg1, arg2, ...]
      const callArgs = fakeChannel.sendToQueue.firstCall.args;
      
      // Tham số đầu tiên (callArgs[0]) là TÊN QUEUE
      const queueName = callArgs[0];
      
      // Tham số thứ hai (callArgs[1]) là NỘI DUNG (dưới dạng Buffer)
      const messageBuffer = callArgs[1];
      
      // Chuyển Buffer thành JSON object để kiểm tra
      const message = JSON.parse(messageBuffer.toString());

      // 4. Kiểm tra TÊN QUEUE và NỘI DUNG MESSAGE
      // (Giả sử queue tên là 'orders' dựa trên file MessageBroker của bạn)
      expect(queueName).to.equal('orders');
      
      // (Giả sử mock token của bạn có username là 'testuser')
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
      
      // Đảm bảo RabbitMQ KHÔNG được gọi nếu request không hợp lệ
      expect(fakeChannel.sendToQueue.called).to.be.false;
    });
  });
});
