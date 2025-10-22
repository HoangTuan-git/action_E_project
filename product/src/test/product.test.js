const chai = require("chai");
const chaiHttp = require("chai-http");
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const App = require("../app"); // Đảm bảo đường dẫn này đúng
const { generateMockToken } = require('./authHelper'); // Import hàm mock token
require("dotenv").config();

chai.use(chaiHttp);
const expect = chai.expect;

describe("Product Service API", () => {
  let app;
  let mongoServer;
  let authToken; // Token sẽ được tạo một lần và dùng chung

  // Hook này chạy MỘT LẦN trước tất cả các test
  before(async () => {
    // 1. Khởi tạo MongoDB server trong bộ nhớ
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // 2. Kết nối Mongoose tới server ảo này
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('In-memory MongoDB connected for product tests.');

    // 3. Tạo mock token
    authToken = generateMockToken();
    console.log('Generated mock auth token for tests.');

    // 4. Khởi tạo và khởi động ứng dụng
    app = new App();
    // KHÔNG GỌI app.connectDB() nữa! Nó sẽ dùng kết nối Mongoose có sẵn.
    // Giả sử setupMessageBroker cũng nên được mock, ở đây tạm bỏ qua
    // await app.setupMessageBroker(); 
    app.start();
  });

  // Hook này chạy MỘT LẦN sau khi tất cả các test kết thúc
  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    app.stop();
    console.log('In-memory MongoDB stopped and disconnected.');
  });

  // Hook này chạy TRƯỚC MỖI bài test để dọn dẹp dữ liệu
  beforeEach(async () => {
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      await collection.deleteMany({});
    }
  });

  // Test block cho việc tạo sản phẩm
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

    it("should return 401 Unauthorized without a token", async () => {
      const productData = { name: "Mouse", price: 25 };
      const res = await chai
        .request(app.app)
        .post("/")
        .send(productData);

      expect(res).to.have.status(401);
    });

    it("should return 400 Bad Request if name is missing", async () => {
      const productData = { price: 25 };
      const res = await chai
        .request(app.app)
        .post("/")
        .set("Authorization", `Bearer ${authToken}`)
        .send(productData);

      expect(res).to.have.status(400);
    });
  });

  // Test block cho việc lấy danh sách sản phẩm
  describe("GET /", () => {
    // Tạo sẵn một sản phẩm trước khi chạy test trong block này
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
      expect(res.body[0]).to.have.property("name", "Keyboard");
    });
  });

  // Test block cho việc mua hàng
  describe("POST /buy", () => {
    let createdProduct; // Biến để lưu sản phẩm được tạo

    // Trước mỗi test trong block này, tạo một sản phẩm mới
    beforeEach(async () => {
      const productData = { name: "Webcam", description: "HD Webcam", price: 50 };
      const res = await chai
        .request(app.app)
        .post("/")
        .set("Authorization", `Bearer ${authToken}`)
        .send(productData);
      createdProduct = res.body;
    });

    it("should create an order with valid products", async () => {
      const orderData = [{ _id: createdProduct._id, quantity: 2 }];

      const res = await chai
        .request(app.app)
        .post("/buy")
        .set("Authorization", `Bearer ${authToken}`)
        .send(orderData);

      expect(res).to.have.status(201);
      expect(res.body).to.have.property("_id");
      expect(res.body).to.have.property("products").that.is.an("array");
      expect(res.body.products[0]).to.have.property('product_id', createdProduct._id);
    });

    it("should return an error for an empty products array", async () => {
      const res = await chai
        .request(app.app)
        .post("/buy")
        .set("Authorization", `Bearer ${authToken}`)
        .send([]);

      expect(res).to.have.status(400);
    });
  });
});