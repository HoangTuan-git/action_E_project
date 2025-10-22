require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3001,
  mongoURI: process.env.MONGODB_PRODUCT_URI,
  rabbitMQURI: process.env.RABBITMQ_URI,
  queueNameProduct: process.env.RABBITMQ_QUEUE_PRODUCT,
  queueNameOrder: process.env.RABBITMQ_QUEUE_ORDER,
};
