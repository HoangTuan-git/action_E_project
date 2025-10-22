const AuthService = require("../services/authService");

/**
 * Class to encapsulate the logic for the auth routes
 */

class AuthController {
  constructor() {
    this.authService = new AuthService();
    // Bind all methods to maintain context
    this.login = this.login.bind(this);
    this.register = this.register.bind(this);
    this.dashboard = this.dashboard.bind(this);
  }
  async dashboard(req, res) {
    res.json({ message: "Welcome to dashboard" });
  }
  async login(req, res) {
    try {
      const { username, password } = req.body;
      
      // Input validation
      if (!username || !password) {
        return res.status(400).json({ 
          message: !username ? "Username is required" : "Password is required" 
        });
      }

      const result = await this.authService.login(username, password);

      if (result.success) {
        res.json({ token: result.token });
      } else {
        res.status(400).json({ message: result.message });
      }
    } catch (err) {
      console.error('Error in login:', err);
      res.status(500).json({ message: "Server error" });
    }
  }

  async register(req, res) {
    try {
      const { username, password } = req.body;
      
      // Input validation
      if (!username || !password) {
        return res.status(400).json({ 
          message: !username ? "Username is required" : "Password is required" 
        });
      }
      
      const user = req.body;
      const result = await this.authService.register(user);
      if (result.success) {
        res.status(201).json(result.newuser);
      }
      else {
        res.status(400).json({ message: result.message });
      }
    } catch (err) {
      console.error('Error in register:', err);
      res.status(500).json({ message: "Server error" });
    }
  }
}

module.exports = AuthController;
