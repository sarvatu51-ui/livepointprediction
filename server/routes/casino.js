const crypto = require('crypto');
const express = require('express');
const { protect: auth } = require('../middleware/auth');
const User = require('../models/User');
const CasinoBet = require('../models/CasinoBet');

const router = express.Router();

const GAMES = {
  aviator: { label: 'Aviator', minBet: 10, maxBet: 20000, rtp: 0.96 },
  mines: { label: 'Mines', minBet: 10, maxBet: 15000, rtp: 0.95 },
  teen_patti: { label: 'Teen Patti', minBet: 20, maxBet: 25000, rtp: 0.94 },
  rummy: { label: 'Rummy', minBet: 20, maxBet: 25000, rtp: 0.93 }
};

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

const randomFloat = (serverSeed, clientSeed, nonce, game) => {
  const digest = hash(`${serverSeed}:${clientSeed}:${nonce}:${game}`);
  const slice = digest.slice(0, 13);
  const intVal = Number.parseInt(slice, 16);
  return intVal / 0x1fffffffffffff;
};

const round2 = (value) => Number(value.toFixed(2));

const resolveOutcome = (game, stake, rtp, rnd) => {
  if (game === 'aviator') {
    // Crash distribution with capped multiplier, then scaled by RTP.
    const crash = Math.min(30, Math.max(1.01, 0.99 / (1 - rnd)));
    const cashout = Math.min(10, Math.max(1.1, crash * rtp));
    const targetWinChance = Math.min(0.8, 0.97 / cashout);
    const won = rnd < targetWinChance;
    const multiplier = won ? cashout : 0;
    return { won, multiplier: round2(multiplier), payout: round2(stake * multiplier) };
  }

  if (game === 'mines') {
    const profile = [
      { chance: 0.38, fair: 1.4 },
      { chance: 0.28, fair: 2.0 },
      { chance: 0.16, fair: 3.1 },
      { chance: 0.1, fair: 5.2 },
      { chance: 0.08, fair: 8.0 }
    ];
    let running = 0;
    let fairMultiplier = 0;
    for (const p of profile) {
      running += p.chance;
      if (rnd < running) {
        fairMultiplier = p.fair;
        break;
      }
    }
    const won = fairMultiplier > 0;
    const multiplier = won ? fairMultiplier * rtp : 0;
    return { won, multiplier: round2(multiplier), payout: round2(stake * multiplier) };
  }

  if (game === 'teen_patti') {
    const won = rnd < 0.45;
    const fairMultiplier = won ? 2 : 0;
    const multiplier = fairMultiplier * rtp;
    return { won, multiplier: round2(multiplier), payout: round2(stake * multiplier) };
  }

  const won = rnd < 0.43; // rummy
  const fairMultiplier = won ? 2 : 0;
  const multiplier = fairMultiplier * rtp;
  return { won, multiplier: round2(multiplier), payout: round2(stake * multiplier) };
};

router.get('/games', auth, (_req, res) => {
  const games = Object.entries(GAMES).map(([key, value]) => ({
    key,
    name: value.label,
    minBet: value.minBet,
    maxBet: value.maxBet,
    rtp: Number((value.rtp * 100).toFixed(2))
  }));

  res.json(games);
});

router.post('/play/:game', auth, async (req, res) => {
  try {
    const game = req.params.game;
    const gameConfig = GAMES[game];

    if (!gameConfig) {
      return res.status(404).json({ message: 'Game not found' });
    }

    const stake = Number(req.body.stake);
    if (!Number.isFinite(stake) || stake < gameConfig.minBet || stake > gameConfig.maxBet) {
      return res.status(400).json({
        message: `Stake must be between ${gameConfig.minBet} and ${gameConfig.maxBet}`
      });
    }

    const clientSeedRaw = String(req.body.clientSeed || 'default-client-seed');
    const clientSeed = clientSeedRaw.trim().slice(0, 64) || 'default-client-seed';

    const [user, lastBet] = await Promise.all([
      User.findById(req.user.userId),
      CasinoBet.findOne({ userId: req.user.userId }).sort({ createdAt: -1 })
    ]);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.points < stake) {
      return res.status(400).json({ message: 'Insufficient points' });
    }

    const nonce = (lastBet?.nonce || 0) + 1;
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = hash(serverSeed);
    const rnd = randomFloat(serverSeed, clientSeed, nonce, game);
    const outcome = resolveOutcome(game, stake, gameConfig.rtp, rnd);

    user.points = round2(user.points - stake + outcome.payout);
    await user.save();

    const bet = await CasinoBet.create({
      userId: user._id,
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

    return res.status(201).json({
      message: outcome.won ? `You won on ${gameConfig.label}!` : `You lost on ${gameConfig.label}.`,
      bet: {
        id: bet._id,
        game: bet.game,
        stake: bet.stake,
        payout: bet.payout,
        multiplier: bet.multiplier,
        result: bet.result,
        nonce: bet.nonce,
        clientSeed: bet.clientSeed,
        serverSeedHash: bet.serverSeedHash,
        serverSeed: bet.serverSeed,
        createdAt: bet.createdAt
      },
      pointsLeft: user.points
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to play casino game', error: error.message });
  }
});

router.get('/history', auth, async (req, res) => {
  try {
    const game = req.query.game;
    const query = { userId: req.user.userId };

    if (game && GAMES[game]) {
      query.game = game;
    }

    const history = await CasinoBet.find(query).sort({ createdAt: -1 }).limit(50);
    return res.json(history);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch casino history', error: error.message });
  }
});

module.exports = router;
