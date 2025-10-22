const mongoose = require('mongoose');
const orderProductsSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
  }, 
  productName: {
    type: String,
    required: true,
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  }
}, { _id : false });


const orderSchema = new mongoose.Schema({
  orderMapId: {
    type: String,
    required: true,
    unique: true,
  },
  user: {
    type: String,
    required: true,
    trim: true,
  },
  products: [{
    type: [orderProductsSchema],
    required: true,
  }],
  
  totalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  }
}, { collection : 'orders' });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
