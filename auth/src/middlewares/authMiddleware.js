const jwt = require("jsonwebtoken");
const config = require("../config");

/**
 * Middleware to verify the token
 */

module.exports = function (req, res, next) {
  let token = req.header("x-auth-token");

  if (!token) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "No authorization header, authorization denied" });
    }
    token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ message: "Token is not valid" });
  }
};
