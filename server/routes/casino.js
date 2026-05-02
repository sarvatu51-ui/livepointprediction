const crypto = require('crypto');
const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const CasinoBet = require('../models/CasinoBet');

const router = express.Router();

const GAMES = {
  aviator:    { label: 'Aviator',    minBet: 10,  maxBet: 20000, rtp: 0.96 },
  mines:      { label: 'Mines',      minBet: 10,  maxBet: 15000, rtp: 0.95 },
  teen_patti: { label: 'Teen Patti', minBet: 20,  maxBet: 25000, rtp: 0.94 },
  rummy:      { label: 'Rummy',      minBet: 20,  maxBet: 25000, rtp: 0.93 }
};

const hash = (v) => crypto.createHash('sha256').update(v).digest('hex');
const round2 = (v) => Number(v.toFixed(2));

const randomFloat = (serverSeed, clientSeed, nonce, game) => {
  const digest = hash(`${serverSeed}:${clientSeed}:${nonce}:${game}`);
  return Number.parseInt(digest.slice(0, 13), 16) / 0x1fffffffffffff;
};

const resolveOutcome = (game, stake, rtp, rnd) => {
  if (game === 'aviator') {
    const crash = Math.min(30, Math.max(1.01, 0.99 / (1 - rnd)));
    const cashout = Math.min(10, Math.max(1.1, crash * rtp));
    const won = rnd < Math.min(0.8, 0.97 / cashout);
    const multiplier = won ? cashout : 0;
    return { won, multiplier: round2(multiplier), payout: round2(stake * multiplier) };
  }
  if (game === 'mines') {
    const profile = [
      { chance: 0.38, fair: 1.4 }, { chance: 0.28, fair: 2.0 },
      { chance: 0.16, fair: 3.1 }, { chance: 0.1, fair: 5.2 }, { chance: 0.08, fair: 8.0 }
    ];
    let running = 0, fairMultiplier = 0;
    for (const p of profile) {
      running += p.chance;
      if (rnd < running) { fairMultiplier = p.fair; break; }
    }
    const won = fairMultiplier > 0;
    const multiplier = won ? fairMultiplier * rtp : 0;
    return { won, multiplier: round2(multiplier), payout: round2(stake * multiplier) };
  }
  if (game === 'teen_patti') {
    const won = rnd < 0.45;
    const multiplier = won ? round2(2 * rtp) : 0;
    return { won, multiplier, payout: round2(stake * multiplier) };
  }
  const won = rnd < 0.43;
  const multiplier = won ? round2(2 * rtp) : 0;
  return { won, multiplier, payout: round2(stake * multiplier) };
};

// GET /api/casino/games
router.get('/games', protect, (_req, res) => {
  res.json(Object.entries(GAMES).map(([key, v]) => ({
    key, name: v.label, minBet: v.minBet, maxBet: v.maxBet,
    rtp: Number((v.rtp * 100).toFixed(2))
  })));
});

// POST /api/casino/play/:game
router.post('/play/:game', protect, async (req, res) => {
  try {
    const game = req.params.game;
    const gameConfig = GAMES[game];
    if (!gameConfig) return res.status(404).json({ message: 'Game not found' });

    const stake = Number(req.body.stake);
    if (!Number.isFinite(stake) || stake < gameConfig.minBet || stake > gameConfig.maxBet) {
      return res.status(400).json({ message: `Stake must be between ${gameConfig.minBet} and ${gameConfig.maxBet}` });
    }

    const clientSeed = String(req.body.clientSeed || 'default-seed').trim().slice(0, 64) || 'default-seed';

    // Use req.user._id (our middleware sets _id not userId)
    const userId = req.user._id;

    const [user, lastBet] = await Promise.all([
      User.findById(userId),
      CasinoBet.findOne({ userId }).sort({ createdAt: -1 })
    ]);

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.points < stake) return res.status(400).json({ message: 'Not enough points!' });

    const nonce = (lastBet?.nonce || 0) + 1;
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = hash(serverSeed);
    const rnd = randomFloat(serverSeed, clientSeed, nonce, game);
    const outcome = resolveOutcome(game, stake, gameConfig.rtp, rnd);

    user.points = round2(user.points - stake + outcome.payout);
    await user.save();

    const bet = await CasinoBet.create({
      userId,
      game,
      stake,
      payout: outcome.payout,
      multiplier: outcome.multiplier,
      result: outcome.won ? 'won' : 'lost',
      nonce,
      clientSeed,
      serverSeedHash,
      serverSeed
    });

    // Real-time points update
    const io = req.app.get('io');
    if (io) io.to(userId.toString()).emit('pointsUpdated', { points: user.points });

    return res.status(201).json({
      message: outcome.won ? `🎉 You won on ${gameConfig.label}!` : `😔 You lost on ${gameConfig.label}.`,
      bet: {
        id: bet._id, game: bet.game, stake: bet.stake,
        payout: bet.payout, multiplier: bet.multiplier,
        result: bet.result, nonce: bet.nonce,
        serverSeedHash: bet.serverSeedHash,
        createdAt: bet.createdAt
      },
      pointsLeft: user.points
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to play', error: error.message });
  }
});

// GET /api/casino/history
router.get('/history', protect, async (req, res) => {
  try {
    const query = { userId: req.user._id };
    if (req.query.game && GAMES[req.query.game]) query.game = req.query.game;
    const history = await CasinoBet.find(query).sort({ createdAt: -1 }).limit(50);
    return res.json(history);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch history', error: error.message });
  }
});

module.exports = router;
