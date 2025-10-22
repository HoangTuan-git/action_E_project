const express = require("express");
const httpProxy = require("http-proxy");
const dotenv = require("dotenv");
dotenv.config();
const proxy = httpProxy.createProxyServer();
const app = express();
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:3000";
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || "http://localhost:3001";
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || "http://localhost:3002";

// Route requests to the auth service
app.use("/auth", (req, res) => {
  req.url = req.url.replace(/^\/auth/, '') || '/';
  proxy.web(req, res, { target: AUTH_SERVICE_URL });
});

// Route requests to the product service
app.use("/products", (req, res) => {
  req.url = req.url.replace(/^\/products/, '') || '/';
  proxy.web(req, res, { target: PRODUCT_SERVICE_URL });
});

// Route requests to the order service
app.use("/orders", (req, res) => {
  req.url = req.url.replace(/^\/orders/, '') || '/';
  proxy.web(req, res, { target: ORDER_SERVICE_URL });
});

// Start the server
const port = process.env.PORT || 3003;
app.listen(port, () => {
  console.log(`API Gateway listening on port ${port}`);
});
