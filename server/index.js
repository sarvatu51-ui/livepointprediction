const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Allow requests from Vercel frontend AND localhost
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'https://livepoint-prediction.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(o => origin.includes('vercel.app') || origin === o)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.some(o => origin.includes('vercel.app') || origin === o)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.set('io', io);
app.use(express.json());

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/bets', require('./routes/bets'));
app.use('/api/users', require('./routes/users'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/sessions', require('./routes/sessions'));

app.get('/api/health', (req, res) => res.json({ status: 'LivePointPredict running!' }));

// ── Socket.io ─────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('joinUserRoom', (userId) => { socket.join(userId); });
  socket.on('disconnect', () => { console.log('Client disconnected:', socket.id); });
});

// ── Auto odds simulation ──────────────────────────────────
const Match = require('./models/Match');

const simulateOdds = async () => {
  try {
    const liveMatches = await Match.find({ status: 'live', isCricket: false });
    for (const match of liveMatches) {
      const changeA = (Math.random() - 0.5) * 0.2;
      const changeB = (Math.random() - 0.5) * 0.2;
      const newOddsA = parseFloat(Math.min(5.0, Math.max(1.1, match.oddsTeamA + changeA)).toFixed(2));
      const newOddsB = parseFloat(Math.min(5.0, Math.max(1.1, match.oddsTeamB + changeB)).toFixed(2));
      match.oddsHistory.push({ oddsTeamA: match.oddsTeamA, oddsTeamB: match.oddsTeamB });
      match.oddsTeamA = newOddsA;
      match.oddsTeamB = newOddsB;
      if (match.oddsHistory.length > 20) match.oddsHistory = match.oddsHistory.slice(-20);
      await match.save();
      io.emit('oddsUpdated', { matchId: match._id, oddsTeamA: newOddsA, oddsTeamB: newOddsB });
    }
  } catch (err) {
    console.error('Odds simulation error:', err.message);
  }
};

const { syncCricketMatches } = require('./services/cricapi');
setInterval(simulateOdds, 7000);
setInterval(() => syncCricketMatches(io), 30000);

// ── Start server ──────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/livepointpredict';

mongoose.connect(MONGO_URI).then(async () => {
  console.log('✅ MongoDB connected');

  const User = require('./models/User');
  const bcrypt = require('bcryptjs');

  // Always recreate admin with fresh hash on startup
  await User.deleteOne({ email: 'admin@livepointpredict.com' });
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await User.create({
    name: 'Admin',
    email: 'admin@livepointpredict.com',
    password: hashedPassword,
    role: 'admin',
    points: 999999
  });
  console.log('✅ Admin ready: admin@livepointpredict.com / admin123');

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('❌ MongoDB error:', err.message);
  process.exit(1);
});
