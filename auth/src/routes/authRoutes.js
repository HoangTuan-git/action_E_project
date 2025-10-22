const express = require("express");
const AuthController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();
const authController = new AuthController();

router.post("/login", authController.login);
router.post("/register", authController.register);
router.get("/dashboard", authMiddleware, authController.dashboard);

module.exports = router;