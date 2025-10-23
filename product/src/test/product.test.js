const chai = require("chai");
const chaiHttp = require("chai-http");
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const sinon = require('sinon'); // 1. Import sinon
const App = require("../app"); // 2. Import App để khởi động dịch vụ
const MessageBroker = require('../utils/messageBroker'); // import MessageBroker singleton
const { generateMockToken } = require('./authHelper');
require("dotenv").config();

chai.use(chaiHttp);
const expect = chai.expect;

describe("Product Service API (Unit/Integration)", () => {
  let app;
  let mongoServer;
  let authToken;

  // Hook này chạy MỘT LẦN trước tất cả các test
  before(async () => {
    // 1. Khởi tạo MongoDB server trong bộ nhớ
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('In-memory MongoDB connected for product tests.');

    // 2. Tạo mock token
    authToken = generateMockToken();

    // 3. Khởi tạo App
    app = new App();

    //  Stub trực tiếp MessageBroker singleton
    // Ngăn nó cố gắng kết nối thật trong app.start()
    sinon.stub(MessageBroker, 'connect').callsFake(async () => {
      console.log('Mocked MessageBroker.connect: Bỏ qua kết nối RabbitMQ thật.');
      return Promise.resolve();
    });

    // 5. Stub hàm publishMessage
    // Chúng ta sẽ reset nó trong beforeEach
    sinon.stub(MessageBroker, 'publishMessage').resolves();


    // 6. Khởi động app
    // Khi hàm start() gọi MessageBroker.connect(), nó sẽ gọi hàm GIẢ
    app.start();
  });

  // Hook này chạy MỘT LẦN sau khi tất cả các test kết thúc
  after(async () => {
    sinon.restore(); // <-- Khôi phục lại tất cả các hàm đã bị stub (cả connect và publishMessage)
    await mongoose.disconnect();
    await mongoServer.stop();
    app.stop();
    console.log('In-memory MongoDB stopped and disconnected.');
  });

  // Hook này chạy TRƯỚC MỖI bài test
  beforeEach(async () => {
    // Dọn dẹp database
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      await collection.deleteMany({});
    }
    
    // <-- MỚI: Reset lại lịch sử của mock publishMessage
    // Rất quan trọng để các bài test không ảnh hưởng lẫn nhau
    MessageBroker.publishMessage.resetHistory();
  });

  // ... (Test block cho 'POST /' và 'GET /' không thay đổi) ...
  
  describe("POST /", () => {
    // ...
  });

  describe("GET /", () => {
    // ...
  });

  // Test block cho việc mua hàng
  describe("POST /buy", () => {
    let createdProduct;

    beforeEach(async () => {
      // Tạo một sản phẩm mẫu
      const productData = { name: "Webcam", description: "HD Webcam", price: 50 };
      const res = await chai
        .request(app.app)
        .post("/")
        .set("Authorization", `Bearer ${authToken}`)
        .send(productData);
      createdProduct = res.body;
      
      // <-- MỚI: Reset lại mock (để bỏ qua lần gọi publish khi tạo sp, nếu có)
      MessageBroker.publishMessage.resetHistory();
    });

    it("should create an order AND send a message to RabbitMQ", async () => {
      const orderData = [{ _id: createdProduct._id, quantity: 2 }];

      // Hành động: Gọi API /buy
      const res = await chai
        .request(app.app)
        .post("/buy")
        .set("Authorization", `Bearer ${authToken}`)
        .send(orderData);

      // --- BƯỚC 3: KIỂM TRA KẾT QUẢ ---

      // Kiểm tra 1: API response vẫn trả về đúng
      expect(res).to.have.status(201);
      expect(res.body).to.have.property("_id");

      // <-- MỚI: Kiểm tra 2: Hàm publishMessage đã được gọi 1 lần
      expect(MessageBroker.publishMessage.calledOnce).to.be.true;

      
      // Lấy các đối số mà hàm publishMessage đã được gọi
      const [queueName, message] = MessageBroker.publishMessage.firstCall.args;
      
      // <-- MỚI: Không cần parse message
      // vì hàm publishMessage của bạn nhận object, không phải Buffer
      expect(queueName).to.equal('orders'); 
      
      // Giả sử mock token của bạn có username là 'testuser'
      expect(message).to.have.property('username', 'testuser'); 
      expect(message.products[0]).to.have.property('_id', createdProduct._id);
    });
  });
});

