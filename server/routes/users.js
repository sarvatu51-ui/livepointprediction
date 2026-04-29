const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

// @route   GET /api/users/leaderboard
// @desc    Get top users by points
// @access  Public
router.get('/leaderboard', async (req, res) => {
  try {
    const users = await User.find({ role: 'user' })
      .select('name points totalWins totalLosses')
      .sort({ points: -1 })
      .limit(20);
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/users/stats
// @desc    Get current user's full stats
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/users (Admin only)
// @desc    Get all users
// @access  Private/Admin
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ points: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
