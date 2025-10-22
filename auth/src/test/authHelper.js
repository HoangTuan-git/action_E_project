// File: product/src/test/authHelper.js
    const jwt = require('jsonwebtoken');
    const mongoose = require('mongoose');

    /**
     * Tạo ra một JWT token giả để sử dụng trong các bài test.
     * @returns {string} - Một chuỗi token hợp lệ.
     */
    const generateMockToken = () => {
      // 1. Tạo một payload giả.
      // Payload này nên có cấu trúc tương tự như token thật từ auth service.
      // Ví dụ: chứa một ID người dùng ngẫu nhiên.
      const payload = {
        id: new mongoose.Types.ObjectId().toHexString(),
        username: 'testuser'
      };

      // 2. Ký token với cùng một JWT_SECRET đã được định nghĩa trong file .env của CI.
      // Đảm bảo rằng process.env.JWT_SECRET đã được load.
      const token = jwt.sign(payload, process.env.JWT_SECRET);

      return token;
    };

    module.exports = { generateMockToken };
    