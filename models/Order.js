const mongoose = require('mongoose')

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  companiesCount: {
    type: Number,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  role: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  industries: [String],
  cvFile: {
    type: String, // file path or URL
  },
  coverLetterFile: {
    type: String,
  },
  paystackReference: {
    type: String,
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'sending', 'sent', 'failed'],
    default: 'pending',
  },
  emailsSent: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

module.exports = mongoose.model('Order', orderSchema)
