const mongoose = require('mongoose');

// Tracks all deposit and withdrawal requests
const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal'],
    required: true
  },
  points: {
    type: Number,
    required: true,
    min: [100, 'Minimum transaction is 100 points']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  note: {
    type: String,
    default: '' // Admin can add a note when approving/rejecting
  },
  // For deposits: admin enters a reference (like UPI transaction ID)
  reference: {
    type: String,
    default: ''
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // Which admin processed this
  },
  processedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);
