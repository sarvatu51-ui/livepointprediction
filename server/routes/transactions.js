const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

// ─────────────────────────────────────────
// USER ROUTES
// ─────────────────────────────────────────

// @route   POST /api/transactions/deposit
// @desc    User requests a deposit (admin will approve & add points)
// @access  Private
router.post('/deposit', protect, async (req, res) => {
  try {
    const { points, reference } = req.body;

    if (!points || points < 100) {
      return res.status(400).json({ message: 'Minimum deposit is 100 points.' });
    }

    // Check if user already has a pending deposit
    const existing = await Transaction.findOne({
      userId: req.user._id,
      type: 'deposit',
      status: 'pending'
    });

    if (existing) {
      return res.status(400).json({ message: 'You already have a pending deposit request. Wait for admin to process it.' });
    }

    const transaction = await Transaction.create({
      userId: req.user._id,
      type: 'deposit',
      points,
      reference: reference || ''
    });

    // Notify admin via socket
    const io = req.app.get('io');
    io.emit('newTransactionRequest', { type: 'deposit', userId: req.user._id, points });

    res.status(201).json({ message: 'Deposit request submitted! Admin will review and add points.', transaction });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   POST /api/transactions/withdraw
// @desc    User requests a withdrawal (redeem points)
// @access  Private
router.post('/withdraw', protect, async (req, res) => {
  try {
    const { points } = req.body;

    if (!points || points < 100) {
      return res.status(400).json({ message: 'Minimum withdrawal is 100 points.' });
    }

    const user = await User.findById(req.user._id);

    if (user.points < points) {
      return res.status(400).json({ message: `Not enough points. You have ${user.points} points.` });
    }

    // Check for existing pending withdrawal
    const existing = await Transaction.findOne({
      userId: req.user._id,
      type: 'withdrawal',
      status: 'pending'
    });

    if (existing) {
      return res.status(400).json({ message: 'You already have a pending withdrawal request.' });
    }

    // Lock the points immediately (deduct when request is made)
    user.points -= points;
    await user.save();

    const transaction = await Transaction.create({
      userId: req.user._id,
      type: 'withdrawal',
      points
    });

    // Notify admin via socket
    const io = req.app.get('io');
    io.emit('newTransactionRequest', { type: 'withdrawal', userId: req.user._id, points });
    // Also update user's points in their room
    io.to(req.user._id.toString()).emit('pointsUpdated', { points: user.points });

    res.status(201).json({
      message: 'Withdrawal request submitted! Admin will review it.',
      transaction,
      newPoints: user.points
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   GET /api/transactions/my
// @desc    Get current user's transactions
// @access  Private
router.get('/my', protect, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────

// @route   GET /api/transactions/all
// @desc    Admin: get all transactions
// @access  Private/Admin
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const { status, type } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const transactions = await Transaction.find(filter)
      .populate('userId', 'name email points')
      .populate('processedBy', 'name')
      .sort({ createdAt: -1 });

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   PUT /api/transactions/:id/approve
// @desc    Admin: approve a transaction
// @access  Private/Admin
router.put('/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    const { note } = req.body;
    const transaction = await Transaction.findById(req.params.id).populate('userId');

    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    if (transaction.status !== 'pending') return res.status(400).json({ message: 'Transaction already processed' });

    transaction.status = 'approved';
    transaction.note = note || '';
    transaction.processedBy = req.user._id;
    transaction.processedAt = new Date();
    await transaction.save();

    // For DEPOSITS: add points to user account
    if (transaction.type === 'deposit') {
      await User.findByIdAndUpdate(transaction.userId._id, {
        $inc: { points: transaction.points }
      });
    }
    // For WITHDRAWALS: points were already deducted when request was made
    // So we just mark as approved (admin pays the user outside the app)

    // Notify the user in real-time
    const io = req.app.get('io');
    const updatedUser = await User.findById(transaction.userId._id);
    io.to(transaction.userId._id.toString()).emit('transactionProcessed', {
      type: transaction.type,
      status: 'approved',
      points: transaction.points,
      newPoints: updatedUser.points
    });

    res.json({ message: `${transaction.type} approved!`, transaction });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   PUT /api/transactions/:id/reject
// @desc    Admin: reject a transaction
// @access  Private/Admin
router.put('/:id/reject', protect, adminOnly, async (req, res) => {
  try {
    const { note } = req.body;
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    if (transaction.status !== 'pending') return res.status(400).json({ message: 'Transaction already processed' });

    transaction.status = 'rejected';
    transaction.note = note || '';
    transaction.processedBy = req.user._id;
    transaction.processedAt = new Date();
    await transaction.save();

    // For WITHDRAWALS: refund points back since we deducted on request
    if (transaction.type === 'withdrawal') {
      await User.findByIdAndUpdate(transaction.userId, {
        $inc: { points: transaction.points }
      });
      const updatedUser = await User.findById(transaction.userId);
      const io = req.app.get('io');
      io.to(transaction.userId.toString()).emit('transactionProcessed', {
        type: 'withdrawal',
        status: 'rejected',
        points: transaction.points,
        newPoints: updatedUser.points,
        note: note || 'Request rejected by admin'
      });
    } else {
      const io = req.app.get('io');
      io.to(transaction.userId.toString()).emit('transactionProcessed', {
        type: 'deposit',
        status: 'rejected',
        note: note || 'Deposit request rejected'
      });
    }

    res.json({ message: 'Transaction rejected', transaction });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
