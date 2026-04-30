const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
app.use(cors());
app.options('*', cors());
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.set('io', io);
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/bets', require('./routes/bets'));
app.use('/api/users', require('./routes/users'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/sessions', require('./routes/sessions'));

app.get('/api/health', (req, res) => res.json({ status: 'LivePointPredict running!' }));

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('joinUserRoom', (userId) => { socket.join(userId); });
  socket.on('disconnect', () => { console.log('Client disconnected:', socket.id); });
});

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
    console.log('✅ Admin created: admin@livepointpredict.com / admin123');
  } else {
    console.log('✅ Admin already exists');
  }

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('❌ MongoDB error:', err.message);
  process.exit(1);
});
