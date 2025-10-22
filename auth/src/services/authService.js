const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserRepository = require("../repositories/userRepository");
const config = require("../config");

/**
 * Class to hold the business logic for the auth service interacting with the user repository
 */
class AuthService {
  constructor() {
    this.userRepository = new UserRepository();
  }
  async login(username, password) {
    const user = await this.userRepository.getUserByUsername(username);

    if (!user) {
      return { success: false, message: "Invalid username or password" };
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return { success: false, message: "Invalid username or password" };
    }

    const token = jwt.sign({ id: user._id, username: user.username }, config.jwtSecret);

    return { success: true, token };
  }

  async register(user) {
    const existingUser = await this.userRepository.getUserByUsername(user.username);
    if (existingUser) {
      return { success: false, message: "Username already taken" };
    }
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
    const newuser = await this.userRepository.createUser(user);
    return { success: true, newuser };
  }
  
  async deleteTestUsers() {
    // Delete test users created during testing
    await this.userRepository.deleteUserByName("testuser");
    await this.userRepository.deleteUserByName("testuser2");
    console.log("Test users cleaned up");
  }
}

module.exports = AuthService;
