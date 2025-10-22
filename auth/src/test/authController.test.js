const chai = require("chai");
const chaiHttp = require("chai-http");
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const App = require("../app"); // Đảm bảo đường dẫn này đúng
require("dotenv").config();

// Sử dụng plugin chai-http
chai.use(chaiHttp);
const { expect } = chai;

// Bọc toàn bộ logic test trong một describe block chính
describe("User Authentication API", () => {
  let app;
  let mongoServer;
  let authToken;

  // Hook này chạy MỘT LẦN trước tất cả các test trong file này
  before(async () => {
    // 1. Khởi tạo MongoDB server trong bộ nhớ
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // 2. Kết nối Mongoose tới server ảo này
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('In-memory MongoDB connected for tests.');

    // 3. Khởi tạo và khởi động ứng dụng
    // Quan trọng: App sẽ sử dụng kết nối Mongoose đã có sẵn
    app = new App();
    // KHÔNG gọi app.connectDB() nữa vì đã kết nối ở trên
    app.start(); 
  });

  // Hook này chạy MỘT LẦN sau khi tất cả các test đã hoàn thành
  after(async () => {
    // 1. Ngắt kết nối Mongoose
    await mongoose.disconnect();
    
    // 2. Dừng server ảo
    await mongoServer.stop();
    
    // 3. Dừng ứng dụng
    app.stop();
    console.log('In-memory MongoDB stopped and disconnected.');
  });

  // Hook này chạy TRƯỚC MỖI bài test (mỗi "it" block)
  beforeEach(async () => {
    // Xóa tất cả dữ liệu trong collection 'users' để đảm bảo mỗi test đều sạch
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      await collection.deleteMany({});
    }
  });

  // Bắt đầu các bộ test
  describe("POST /register", () => {
    it("should register a new user successfully", async () => {
      const res = await chai
        .request(app.app)
        .post("/register")
        .send({ username: "testuser", password: "password" });

      expect(res).to.have.status(201);
      expect(res.body).to.be.an('object');
      expect(res.body).to.have.property("username", "testuser");
    });

    it("should return an error if the username is already taken", async () => {
      // Đầu tiên, tạo một user
      await chai.request(app.app).post("/register").send({ username: "testuser", password: "password" });

      // Sau đó, cố gắng tạo lại user với cùng tên
      const res = await chai
        .request(app.app)
        .post("/register")
        .send({ username: "testuser", password: "password" });

      expect(res).to.have.status(400);
      expect(res.body).to.have.property("message", "Username already taken");
    });
    
    // Các test khác cho /register (thiếu username, password...)
  });

  describe("POST /login", () => {
    // Chạy trước mỗi test trong block "POST /login"
    beforeEach(async () => {
      // Tạo sẵn một user để test login
      await chai.request(app.app).post("/register").send({ username: "testuser", password: "password" });
    });

    it("should return a JWT token for a valid user", async () => {
      const res = await chai
        .request(app.app)
        .post("/login")
        .send({ username: "testuser", password: "password" });

      expect(res).to.have.status(200);
      expect(res.body).to.have.property("token");
      authToken = res.body.token; // Lưu token để dùng cho test dashboard
    });

    it("should return an error for an invalid username", async () => {
      const res = await chai
        .request(app.app)
        .post("/login")
        .send({ username: "invaliduser", password: "password" });

      expect(res).to.have.status(400);
      expect(res.body).to.have.property("message", "Invalid username or password");
    });
    
    // Các test khác cho /login...
  });

  describe("GET /dashboard", () => {
    // Chạy trước mỗi test trong block "GET /dashboard"
    beforeEach(async () => {
      // Tạo user và login để lấy token mới cho mỗi test
      await chai.request(app.app).post("/register").send({ username: "testuser", password: "password" });
      const loginRes = await chai.request(app.app).post("/login").send({ username: "testuser", password: "password" });
      authToken = loginRes.body.token;
    });

    it("should access dashboard with a valid token", async () => {
      const res = await chai
        .request(app.app)
        .get("/dashboard")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property("message", "Welcome to dashboard");
    });

    it("should return unauthorized without a token", async () => {
      const res = await chai
        .request(app.app)
        .get("/dashboard");

      expect(res).to.have.status(401);
    });
  });
});
