const express = require('express');
const router = express.Router();
const SessionBet = require('../models/SessionBet');
const Match = require('../models/Match');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

// @route   GET /api/sessions/:matchId
// @desc    Get all active sessions for a match
// @access  Public
router.get('/:matchId', async (req, res) => {
  try {
    const match = await Match.findById(req.params.matchId);
    if (!match) return res.status(404).json({ message: 'Match not found' });
    // Return the sessions defined on the match
    res.json(match.sessions || []);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   GET /api/sessions/:matchId/my-bets
// @desc    Get current user's session bets for a match
// @access  Private
router.get('/:matchId/my-bets', protect, async (req, res) => {
  try {
    const bets = await SessionBet.find({
      matchId: req.params.matchId,
      userId: req.user._id
    }).sort({ createdAt: -1 });
    res.json(bets);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   POST /api/sessions/bet
// @desc    Place a session bet
// @access  Private
router.post('/bet', protect, async (req, res) => {
  try {
    const { matchId, sessionType, sessionLabel, prediction, line, pointsBet, oddsAtTime } = req.body;

    if (!pointsBet || pointsBet < 10) {
      return res.status(400).json({ message: 'Minimum bet is 10 points.' });
    }

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ message: 'Match not found' });
    if (match.status === 'ended') return res.status(400).json({ message: 'Match has ended.' });

    // Check if user already bet on this session
    const existing = await SessionBet.findOne({
      userId: req.user._id,
      matchId,
      sessionType
    });
    if (existing) return res.status(400).json({ message: 'You already bet on this session.' });

    const user = await User.findById(req.user._id);
    if (user.points < pointsBet) {
      return res.status(400).json({ message: 'Not enough points.' });
    }

    // Deduct points immediately
    user.points -= pointsBet;
    await user.save();

    const potentialWin = Math.floor(pointsBet * oddsAtTime);

    const bet = await SessionBet.create({
      userId: req.user._id,
      matchId,
      sessionType,
      sessionLabel,
      prediction,
      line: line || null,
      pointsBet,
      oddsAtTime,
      potentialWin
    });

    const io = req.app.get('io');
    io.to(req.user._id.toString()).emit('pointsUpdated', { points: user.points });

    res.status(201).json({
      bet,
      newPoints: user.points,
      message: `Session bet placed! Potential win: ${potentialWin} pts`
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   PUT /api/sessions/:matchId/settle
// @desc    Admin: settle a session (declare result)
// @access  Private/Admin
router.put('/:matchId/settle', protect, adminOnly, async (req, res) => {
  try {
    const { sessionType, actualValue, result } = req.body;
    // result: 'over' | 'under' | 'teamA' | 'teamB' (for toss)
    // actualValue: actual runs scored in the session (for over/under)

    const bets = await SessionBet.find({
      matchId: req.params.matchId,
      sessionType,
      result: 'pending'
    });

    let settled = 0;
    for (const bet of bets) {
      let won = false;

      if (bet.prediction === result) {
        won = true;
      }

      if (won) {
        const winnings = Math.floor(bet.pointsBet * bet.oddsAtTime);
        await User.findByIdAndUpdate(bet.userId, {
          $inc: { points: winnings, totalWins: 1, totalPointsWon: winnings - bet.pointsBet }
        });
        bet.result = 'won';
        bet.pointsChange = winnings - bet.pointsBet;
      } else {
        await User.findByIdAndUpdate(bet.userId, {
          $inc: { totalLosses: 1, totalPointsLost: bet.pointsBet }
        });
        bet.result = 'lost';
        bet.pointsChange = -bet.pointsBet;
      }

      bet.actualValue = actualValue || null;
      bet.settledAt = new Date();
      await bet.save();

      // Notify user
      const io = req.app.get('io');
      const updatedUser = await User.findById(bet.userId);
      io.to(bet.userId.toString()).emit('sessionSettled', {
        sessionType,
        result: bet.result,
        pointsChange: bet.pointsChange,
        newPoints: updatedUser?.points
      });

      settled++;
    }

    // Also update the session status on the match
    await Match.findByIdAndUpdate(req.params.matchId, {
      $set: { [`sessionResults.${sessionType}`]: { result, actualValue } }
    });

    res.json({ message: `Settled ${settled} bets for session: ${sessionType}` });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
