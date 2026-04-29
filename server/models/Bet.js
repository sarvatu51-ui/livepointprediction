const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
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
  selectedTeam: {
    type: String,
    enum: ['teamA', 'teamB', 'draw'],
    required: true
  },
  pointsBet: {
    type: Number,
    required: true,
    min: [10, 'Minimum bet is 10 points'],
    max: [10000, 'Maximum bet is 10000 points']
  },
  oddsAtTime: {
    type: Number,
    required: true // Store the odds when the bet was placed (odds change over time)
  },
  potentialWin: {
    type: Number,
    required: true // pointsBet * oddsAtTime
  },
  result: {
    type: String,
    enum: ['pending', 'won', 'lost'],
    default: 'pending'
  },
  pointsChange: {
    type: Number,
    default: 0 // Positive = won, Negative = lost
  },
  createdAt: { type: Date, default: Date.now },
  settledAt: { type: Date }
});

// Prevent duplicate bets on same match by same user
betSchema.index({ userId: 1, matchId: 1 }, { unique: true });

module.exports = mongoose.model('Bet', betSchema);
