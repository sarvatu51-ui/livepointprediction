const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Bet = require('../models/Bet');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

// @route   GET /api/matches
// @desc    Get all matches (public)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const matches = await Match.find(filter).sort({ createdAt: -1 });
    res.json(matches);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/matches/:id
// @desc    Get single match
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Match not found' });
    res.json(match);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/matches
// @desc    Create a new match (Admin only)
// @access  Private/Admin
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const match = await Match.create(req.body);

    // Emit new match to all clients via socket
    const io = req.app.get('io');
    io.emit('matchCreated', match);

    res.status(201).json(match);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/matches/:id
// @desc    Update match (Admin only) - status, odds, result
// @access  Private/Admin
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { oddsTeamA, oddsTeamB, status, result, oddsDraw } = req.body;
    const match = await Match.findById(req.params.id);

    if (!match) return res.status(404).json({ message: 'Match not found' });

    // Track odds history if odds changed
    if (oddsTeamA || oddsTeamB) {
      match.oddsHistory.push({
        oddsTeamA: match.oddsTeamA,
        oddsTeamB: match.oddsTeamB
      });
    }

    // Update fields
    if (oddsTeamA) match.oddsTeamA = oddsTeamA;
    if (oddsTeamB) match.oddsTeamB = oddsTeamB;
    if (oddsDraw !== undefined) match.oddsDraw = oddsDraw;
    if (status) match.status = status;

    // If result is declared, settle all bets for this match
    if (result && match.result !== result) {
      match.result = result;
      match.status = 'ended';

      // Settle all pending bets for this match
      await settleBets(match._id, result);
    }

    await match.save();

    // Emit real-time update to all clients
    const io = req.app.get('io');
    io.emit('matchUpdated', match);

    res.json(match);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/matches/:id
// @desc    Delete match (Admin only)
// @access  Private/Admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Match.findByIdAndDelete(req.params.id);
    const io = req.app.get('io');
    io.emit('matchDeleted', { id: req.params.id });
    res.json({ message: 'Match deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Helper: Settle all bets for a match when result is declared
async function settleBets(matchId, result) {
  const bets = await Bet.find({ matchId, result: 'pending' });

  for (const bet of bets) {
    const won = bet.selectedTeam === result;

    if (won) {
      // User wins: add winnings to their points
      const winnings = Math.floor(bet.pointsBet * bet.oddsAtTime);
      const pointsChange = winnings - bet.pointsBet; // net gain

      await User.findByIdAndUpdate(bet.userId, {
        $inc: {
          points: winnings, // Add full winnings (original bet was already deducted)
          totalWins: 1,
          totalPointsWon: pointsChange
        }
      });

      bet.result = 'won';
      bet.pointsChange = pointsChange;
    } else {
      // User loses: points were already deducted when bet was placed
      await User.findByIdAndUpdate(bet.userId, {
        $inc: {
          totalLosses: 1,
          totalPointsLost: bet.pointsBet
        }
      });

      bet.result = 'lost';
      bet.pointsChange = -bet.pointsBet;
    }

    bet.settledAt = new Date();
    await bet.save();
  }
}

module.exports = router;
