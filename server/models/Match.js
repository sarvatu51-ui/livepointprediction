const mongoose = require('mongoose');

// Schema for a single session market (e.g. "Runs in Over 5", "10-over total")
const sessionSchema = new mongoose.Schema({
  sessionType: { type: String, required: true },
  label: { type: String, required: true },
  line: { type: Number, default: null },
  oddsOver: { type: Number, default: 1.9 },
  oddsUnder: { type: Number, default: 1.9 },
  oddsTeamA: { type: Number, default: null },
  oddsTeamB: { type: Number, default: null },
  isOpen: { type: Boolean, default: true },
  result: { type: String, default: null },
  actualValue: { type: Number, default: null }
}, { _id: true });

const matchSchema = new mongoose.Schema({
  teamA: { type: String, required: true, trim: true },
  teamB: { type: String, required: true, trim: true },
  teamALogo: { type: String, default: '' },
  teamBLogo: { type: String, default: '' },
  sport: {
    type: String,
    default: 'Cricket',
    enum: ['Football', 'Cricket', 'Basketball', 'Tennis', 'Esports', 'Other']
  },
  oddsTeamA: { type: Number, required: true, default: 1.9, min: 1.01 },
  oddsTeamB: { type: Number, required: true, default: 1.9, min: 1.01 },
  oddsDraw: { type: Number, default: null },
  status: { type: String, enum: ['upcoming', 'live', 'ended'], default: 'upcoming' },
  result: { type: String, enum: ['teamA', 'teamB', 'draw', null], default: null },
  scheduledAt: { type: Date, default: Date.now },

  // Cricket specific
  isCricket: { type: Boolean, default: false },
  score: {
    teamA: { runs: { type: Number, default: 0 }, wickets: { type: Number, default: 0 }, overs: { type: Number, default: 0 } },
    teamB: { runs: { type: Number, default: 0 }, wickets: { type: Number, default: 0 }, overs: { type: Number, default: 0 } }
  },
  tossWinner: { type: String, default: null },
  tossDecision: { type: String, default: null },
  sessions: [sessionSchema],
  sessionResults: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  cricApiMatchId: { type: String, default: null },

  oddsHistory: [{
    oddsTeamA: Number,
    oddsTeamB: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  totalBetsTeamA: { type: Number, default: 0 },
  totalBetsTeamB: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Match', matchSchema);
