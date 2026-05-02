const mongoose = require('mongoose');

const casinoBetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  game: {
    type: String,
    enum: ['aviator', 'mines', 'teen_patti', 'rummy'],
    required: true
  },
  stake: { type: Number, required: true, min: 1 },
  payout: { type: Number, required: true, min: 0 },
  multiplier: { type: Number, required: true, min: 0 },
  result: { type: String, enum: ['won', 'lost'], required: true },
  nonce: { type: Number, required: true, min: 1 },
  clientSeed: { type: String, required: true },
  serverSeedHash: { type: String, required: true },
  serverSeed: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('CasinoBet', casinoBetSchema);

