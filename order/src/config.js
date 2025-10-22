require('dotenv').config();

module.exports = {
    mongoURI: process.env.MONGODB_ORDER_URI,
    rabbitMQURI: process.env.RABBITMQ_URI,
    queueNameOrder: process.env.RABBITMQ_QUEUE_ORDER,
    queueNameProduct: process.env.RABBITMQ_QUEUE_PRODUCT,
    port: 3002,
    jwtSecret: process.env.JWT_SECRET
};
