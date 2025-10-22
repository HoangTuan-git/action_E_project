const Order = require('../models/order');

class OrderRepository {
    async create(orderData) {
        const order = new Order(orderData);
        return await order.save();
    }
    async findOne(query) {
        return await Order.findById(query);
    }
    async findAll() {
        return await Order.find();
    }
}

module.exports = new OrderRepository();
