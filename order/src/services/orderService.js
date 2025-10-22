const messageBroker = require("../utils/messageBroker");
const OrderRepository = require("../repositories/orderRepository");
const config = require("../config");
const Order = require("../models/order");

class OrderService {
    constructor() {
        this.orderRepository = OrderRepository;
    }

    async createOrder(orderData) {
        try {
            // orderData is already parsed JSON from messageBroker
            const { products, username, orderId } = orderData;
            //map products data matching Order model
            const listProducts = products.map(p => ({
                productId: p._id,
                productName: p.name,
                quantity: p.quantity,
                price: p.price
            }));
            if (!listProducts || !username || !orderId ) {
                throw new Error("Missing required order data: products, username, or orderId");
            }
            //kiểm tra từng sản phẩm trong listProducts
            for (const prod of listProducts) {
                if (!prod.productId || !prod.productName || !prod.quantity || !prod.price) {
                    throw new Error("Each product must have id, name, quantity, and price");
                }
            }
            // Calculate total price
            const totalPrice = listProducts.reduce((total, prod) => {
                return total + (prod.price * prod.quantity);
            }, 0);

            const newOrder = {
                "orderMapId": orderId,
                "user": username,
                "products": listProducts,
                "totalPrice": totalPrice,
                "status": "completed"
            };

            // Save order to DB
            const savedOrder = await OrderRepository.create(newOrder);
            console.log("Order saved to database:", savedOrder);

            // Send fulfilled order back to PRODUCTS service
            const responseData = {
                orderId,
                //send back original products format
                products: products,
                totalPrice: totalPrice,
                status: 'completed',
                createdAt: new Date().toISOString()
            };

            await messageBroker.publishMessage(config.queueNameProduct, responseData);
            console.log("Order completion message sent to product service");

            return { success: true, order: savedOrder };
        } catch (err) {
            console.error("Failed to create order:", err.message);
            // Phản hồi lỗi về cho Product Service
            const errorResponse = {
                orderId: orderData?.orderId,
                status: 'failed',
                message: err.message,
                timestamp: new Date().toISOString()
            };
            
            try {
                await messageBroker.publishMessage(config.queueNameProduct, errorResponse);
                console.log("Error message sent to product service");
            } catch (pubErr) {
                console.error("Failed to send error message:", pubErr.message);
            }
            return { success: false, message: err.message };
        }
    }

    async getOrderById(orderId) {
        try {
            const order = await OrderRepository.findOne({ _id: orderId });
            return { success: true, order };
        } catch (err) {
            console.error("Failed to get order:", err.message);
            return { success: false, message: err.message };
        }
    }

    async getAllOrders() {
        try {
            const orders = await OrderRepository.findAll();
            return { success: true, orders };
        } catch (err) {
            console.error("Failed to get orders:", err.message);
            return { success: false, message: err.message };
        }
    }
}

module.exports = OrderService;

