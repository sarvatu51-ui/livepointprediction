const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Bet = require('../models/Bet');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

// @route   GET /api/matches
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
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const match = await Match.create(req.body);
    const io = req.app.get('io');
    io.emit('matchCreated', match);
    res.status(201).json(match);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/matches/:id - handles ALL fields including sessions
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const {
      oddsTeamA, oddsTeamB, status, result, oddsDraw,
      sessions, score, tossWinner, tossDecision, cricApiMatchId
    } = req.body;

    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Match not found' });

    // Track odds history if odds changed
    if (oddsTeamA || oddsTeamB) {
      match.oddsHistory.push({
        oddsTeamA: match.oddsTeamA,
        oddsTeamB: match.oddsTeamB
      });
    }

    // Update all fields
    if (oddsTeamA) match.oddsTeamA = oddsTeamA;
    if (oddsTeamB) match.oddsTeamB = oddsTeamB;
    if (oddsDraw !== undefined) match.oddsDraw = oddsDraw;
    if (status) match.status = status;
    if (tossWinner) match.tossWinner = tossWinner;
    if (tossDecision) match.tossDecision = tossDecision;
    if (cricApiMatchId) match.cricApiMatchId = cricApiMatchId;
    if (score) match.score = score;

    // ✅ Handle sessions update
    if (sessions !== undefined) {
      match.sessions = sessions;
    }

    // If result declared, settle all bets
    if (result && match.result !== result) {
      match.result = result;
      match.status = 'ended';
      await settleBets(match._id, result);
    }

    await match.save();

    const io = req.app.get('io');
    io.emit('matchUpdated', match);

    res.json(match);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/matches/:id
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

// Helper: Settle all bets when result declared
async function settleBets(matchId, result) {
  const bets = await Bet.find({ matchId, result: 'pending' });
  for (const bet of bets) {
    const won = bet.selectedTeam === result;
    if (won) {
      const winnings = Math.floor(bet.pointsBet * bet.oddsAtTime);
      const pointsChange = winnings - bet.pointsBet;
      await User.findByIdAndUpdate(bet.userId, {
        $inc: { points: winnings, totalWins: 1, totalPointsWon: pointsChange }
      });
      bet.result = 'won';
      bet.pointsChange = pointsChange;
    } else {
      await User.findByIdAndUpdate(bet.userId, {
        $inc: { totalLosses: 1, totalPointsLost: bet.pointsBet }
      });
      bet.result = 'lost';
      bet.pointsChange = -bet.pointsBet;
    }
    bet.settledAt = new Date();
    await bet.save();
  }
}

module.exports = router;
