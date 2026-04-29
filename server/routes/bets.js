const express = require('express');
const router = express.Router();
const Bet = require('../models/Bet');
const Match = require('../models/Match');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// @route   POST /api/bets
// @desc    Place a bet on a match
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { matchId, selectedTeam, pointsBet } = req.body;

    // Validate bet amount
    if (!pointsBet || pointsBet < 10) {
      return res.status(400).json({ message: 'Minimum bet is 10 points.' });
    }

    // Get the match
    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ message: 'Match not found.' });

    // Can only bet on live or upcoming matches
    if (match.status === 'ended') {
      return res.status(400).json({ message: 'Cannot bet on an ended match.' });
    }

    // Get current user
    const user = await User.findById(req.user._id);

    // Check if user has enough points
    if (user.points < pointsBet) {
      return res.status(400).json({ message: 'Not enough points.' });
    }

    // Check if user already bet on this match
    const existingBet = await Bet.findOne({ userId: user._id, matchId });
    if (existingBet) {
      return res.status(400).json({ message: 'You already placed a bet on this match.' });
    }

    // Get the odds at the time of betting
    let oddsAtTime;
    if (selectedTeam === 'teamA') oddsAtTime = match.oddsTeamA;
    else if (selectedTeam === 'teamB') oddsAtTime = match.oddsTeamB;
    else if (selectedTeam === 'draw') oddsAtTime = match.oddsDraw;
    else return res.status(400).json({ message: 'Invalid team selection.' });

    if (!oddsAtTime) {
      return res.status(400).json({ message: 'Draw option not available for this match.' });
    }

    const potentialWin = Math.floor(pointsBet * oddsAtTime);

    // Deduct points immediately when bet is placed
    user.points -= pointsBet;
    await user.save();

    // Update match bet totals
    if (selectedTeam === 'teamA') match.totalBetsTeamA += pointsBet;
    else match.totalBetsTeamB += pointsBet;
    await match.save();

    // Create the bet
    const bet = await Bet.create({
      userId: user._id,
      matchId,
      selectedTeam,
      pointsBet,
      oddsAtTime,
      potentialWin
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(user._id.toString()).emit('betPlaced', { bet, newPoints: user.points });
    io.emit('matchUpdated', match); // Update bet totals for everyone

    res.status(201).json({
      bet,
      newPoints: user.points,
      message: `Bet placed! Potential win: ${potentialWin} points`
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You already placed a bet on this match.' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/bets/my-bets
// @desc    Get current user's bets
// @access  Private
router.get('/my-bets', protect, async (req, res) => {
  try {
    const bets = await Bet.find({ userId: req.user._id })
      .populate('matchId', 'teamA teamB status result oddsTeamA oddsTeamB sport')
      .sort({ createdAt: -1 });
    res.json(bets);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/bets/match/:matchId
// @desc    Get all bets for a match (Admin only visible to user as summary)
// @access  Private
router.get('/match/:matchId', protect, async (req, res) => {
  try {
    // Show user their own bets, or all bets if admin
    const filter = req.user.role === 'admin'
      ? { matchId: req.params.matchId }
      : { matchId: req.params.matchId, userId: req.user._id };

    const bets = await Bet.find(filter)
      .populate('userId', 'name')
      .sort({ createdAt: -1 });
    res.json(bets);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
