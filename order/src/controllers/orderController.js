const OrderService = require("../services/orderService");
const orderService = require("../services/orderService");

class OrderController {
  constructor() {
    this.orderService = new OrderService(); 
    this.getAllOrders = this.getAllOrders.bind(this);
    this.getOrderById = this.getOrderById.bind(this);
  }
   async getAllOrders(req, res) {
    try {
      const result = await this.orderService.getAllOrders();
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      res.status(200).json(result.orders);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
   }

  async getOrderById(req, res) {
    const { id } = req.params;
    try {
      const result = await this.orderService.getOrderById(id);
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      res.status(200).json(result.order);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
}

module.exports = new OrderController();