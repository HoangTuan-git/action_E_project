const User = require("../models/user");

/**
 * Class to encapsulate the logic for the user repository
 */
class UserRepository {
  async createUser(user) {
    return await User.create(user);
  }

  async getUserByUsername(username) {
    return await User.findOne({ username });
  }
  async deleteUserByName(username) {
    return await User.deleteOne({ username });
  }
  async deleteUserById(userId) {
    // Delete a user by ID
    return await User.deleteOne(userId);
  }
}

module.exports = UserRepository;
