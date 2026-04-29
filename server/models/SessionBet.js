const mongoose = require('mongoose');

// Cricket session bets (per over totals, 6-over, 10-over, toss etc.)
const sessionBetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true
  },
  sessionType: {
    type: String,
    // e.g. 'toss', 'over_5', 'over_10', 'over_15', 'over_20', 'next_over'
    required: true
  },
  sessionLabel: {
    type: String,
    required: true // Human readable: "Runs in Over 5", "10-Over Total", etc.
  },
  prediction: {
    type: String,
    required: true // e.g. "over" (more than line), "under", "teamA" (toss), "teamB"
  },
  line: {
    type: Number,
    default: null // The over/under line, e.g. 7.5 runs in this over
  },
  pointsBet: {
    type: Number,
    required: true,
    min: 10
  },
  oddsAtTime: {
    type: Number,
    required: true
  },
  potentialWin: {
    type: Number,
    required: true
  },
  result: {
    type: String,
    enum: ['pending', 'won', 'lost', 'void'],
    default: 'pending'
  },
  actualValue: {
    type: Number,
    default: null // Actual runs scored in that over/session (filled by admin)
  },
  pointsChange: {
    type: Number,
    default: 0
  },
  createdAt: { type: Date, default: Date.now },
  settledAt: { type: Date }
});

module.exports = mongoose.model('SessionBet', sessionBetSchema);
