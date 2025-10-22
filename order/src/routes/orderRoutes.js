const express = require("express");
const OrderController = require("../controllers/orderController");
const isAuthenticated = require("../utils/isAuthenticated");
const router = express.Router();

router.get("/", isAuthenticated, OrderController.getAllOrders);
router.get("/:id", isAuthenticated, OrderController.getOrderById);
module.exports = router;