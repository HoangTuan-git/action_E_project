const express = require("express");
const mongoose = require("mongoose");
const config = require("./config");
const messageBroker = require("./utils/messageBroker");
const orderRoutes = require("./routes/orderRoutes");
const OrderService = require("./services/orderService");
class App {
  constructor() {
    this.app = express();
    this.connectDB();
    this.setupOrderConsumer();
    this.setMiddlewares();
    this.setRoutes();
  }

  async connectDB() {
    await mongoose.connect(config.mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected");
  }

  async disconnectDB() {
    await mongoose.disconnect();
    console.log("MongoDB disconnected");
  }
   setMiddlewares() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: false }));
  }

  setRoutes() {
    this.app.use("/", orderRoutes);
  }

  
// set up the message broker to consume messages from the orders queue
  async setupOrderConsumer() {
    try {
      await messageBroker.connect();
      
      // Set up order processing callback
      const orderService = new OrderService();
      
      messageBroker.consumeOrderMessages(async (orderData) => {
        try {
          console.log("Processing order:", orderData);
          await orderService.createOrder(orderData);
        } catch (error) {
          console.error("Failed to process order:", error);
        }
      });
      console.log("Order consumer setup completed");
    } catch (error) {
      console.error("Failed to setup order consumer:", error);
    }
  }

  start() {
    this.server = this.app.listen(config.port, () =>
      console.log(`Server started on port ${config.port}`)
    );
  }

  async stop() {
    await messageBroker.disconnect();
    await mongoose.disconnect();
    this.server.close();
    console.log("Server stopped");
  }
}

module.exports = App;
