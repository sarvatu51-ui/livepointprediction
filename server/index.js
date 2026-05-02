const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Open CORS for everything
app.use(cors());
app.options('*', cors());

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
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
app.use('/api/casino', require('./routes/casino')); // ← CASINO ADDED

app.get('/api/health', (req, res) => res.json({ status: 'LivePointPredict running!' }));

// ── Socket.io ─────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('joinUserRoom', (userId) => socket.join(userId));
});

// ── Auto odds simulation ──────────────────────────────────
const Match = require('./models/Match');

const simulateOdds = async () => {
  try {
    const liveMatches = await Match.find({ status: 'live', isCricket: false });
    for (const match of liveMatches) {
      const changeA = (Math.random() - 0.5) * 0.2;
      const changeB = (Math.random() - 0.5) * 0.2;
      match.oddsTeamA = parseFloat(Math.min(5.0, Math.max(1.1, match.oddsTeamA + changeA)).toFixed(2));
      match.oddsTeamB = parseFloat(Math.min(5.0, Math.max(1.1, match.oddsTeamB + changeB)).toFixed(2));
      await match.save();
      io.emit('oddsUpdated', { matchId: match._id, oddsTeamA: match.oddsTeamA, oddsTeamB: match.oddsTeamB });
    }
  } catch (err) { console.error(err.message); }
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
  const adminExists = await User.findOne({ email: 'admin@livepointpredict.com' });
  if (!adminExists) {
    await User.create({
      name: 'Admin',
      email: 'admin@livepointpredict.com',
      password: 'admin123',
      role: 'admin',
      points: 999999
    });
    console.log('✅ Admin created');
  }
  server.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
}).catch(err => { console.error(err.message); process.exit(1); });
