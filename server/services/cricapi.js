// cricapi.js — Cricket API integration
// Uses CricAPI (https://cricapi.com) to fetch live scores
// and auto-update match odds based on game situation

const axios = require('axios');
const Match = require('../models/Match');

const CRICAPI_KEY = process.env.CRICAPI_KEY || ''; // Set in .env

// ─────────────────────────────────────────────────────────
// Fetch live score from CricAPI for a specific match
// ─────────────────────────────────────────────────────────
const fetchLiveScore = async (cricApiMatchId) => {
  if (!CRICAPI_KEY || !cricApiMatchId) return null;

  try {
    const res = await axios.get(
      `https://api.cricapi.com/v1/match_info?apikey=${CRICAPI_KEY}&id=${cricApiMatchId}`,
      { timeout: 5000 }
    );

    if (res.data?.status === 'success') {
      return res.data.data;
    }
    return null;
  } catch (err) {
    console.error('CricAPI fetch error:', err.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────
// Calculate new odds based on live cricket situation
// Logic:
//   - Run rate vs required rate → favours one team
//   - Wickets fallen → disfavours batting team
//   - Overs remaining → pressure factor
// ─────────────────────────────────────────────────────────
const calculateCricketOdds = (score, match) => {
  // Default: equal odds
  let oddsA = match.oddsTeamA;
  let oddsB = match.oddsTeamB;

  const scoreA = score?.teamA;
  const scoreB = score?.teamB;

  if (!scoreA || !scoreB) return { oddsA, oddsB };

  // Simple example: if team batting second, calculate chase odds
  // More wickets = higher odds for bowling team
  const wicketPenalty = (scoreA.wickets || 0) * 0.05;
  const overFactor = scoreA.overs > 0 ? (scoreA.runs / scoreA.overs) / 8 : 1;

  // Adjust odds slightly based on match situation
  const adjustment = Math.min(0.4, Math.max(-0.4, overFactor - 1 + wicketPenalty));

  oddsA = parseFloat(Math.min(4.5, Math.max(1.15, (oddsA - adjustment))).toFixed(2));
  oddsB = parseFloat(Math.min(4.5, Math.max(1.15, (oddsB + adjustment))).toFixed(2));

  return { oddsA, oddsB };
};

// ─────────────────────────────────────────────────────────
// Main sync function: called on interval
// Updates all live cricket matches with fresh scores + odds
// ─────────────────────────────────────────────────────────
const syncCricketMatches = async (io) => {
  try {
    // Only process live cricket matches that have a CricAPI ID
    const liveMatches = await Match.find({
      status: 'live',
      isCricket: true,
      cricApiMatchId: { $ne: null, $exists: true }
    });

    for (const match of liveMatches) {
      const liveData = await fetchLiveScore(match.cricApiMatchId);
      if (!liveData) continue;

      // Parse scores from API response
      const scores = liveData.score || [];
      let updatedScore = { ...match.score };

      for (const s of scores) {
        if (s.inning?.toLowerCase().includes(match.teamA.toLowerCase())) {
          updatedScore.teamA = {
            runs: s.r || 0,
            wickets: s.w || 0,
            overs: parseFloat(s.o) || 0
          };
        } else if (s.inning?.toLowerCase().includes(match.teamB.toLowerCase())) {
          updatedScore.teamB = {
            runs: s.r || 0,
            wickets: s.w || 0,
            overs: parseFloat(s.o) || 0
          };
        }
      }

      // Recalculate odds based on live score
      const { oddsA, oddsB } = calculateCricketOdds(updatedScore, match);

      // Save to DB
      match.score = updatedScore;
      match.oddsHistory.push({ oddsTeamA: match.oddsTeamA, oddsTeamB: match.oddsTeamB });
      match.oddsTeamA = oddsA;
      match.oddsTeamB = oddsB;
      if (match.oddsHistory.length > 20) match.oddsHistory = match.oddsHistory.slice(-20);
      await match.save();

      // Emit to all clients
      io.emit('matchUpdated', match);
      io.emit('oddsUpdated', {
        matchId: match._id,
        oddsTeamA: oddsA,
        oddsTeamB: oddsB,
        score: updatedScore
      });
    }
  } catch (err) {
    console.error('Cricket sync error:', err.message);
  }
};

// ─────────────────────────────────────────────────────────
// Search available matches from CricAPI
// Used by admin to find and link a match
// ─────────────────────────────────────────────────────────
const searchCricMatches = async () => {
  if (!CRICAPI_KEY) return [];
  try {
    const res = await axios.get(
      `https://api.cricapi.com/v1/currentMatches?apikey=${CRICAPI_KEY}&offset=0`,
      { timeout: 5000 }
    );
    if (res.data?.status === 'success') {
      return res.data.data || [];
    }
    return [];
  } catch (err) {
    console.error('CricAPI search error:', err.message);
    return [];
  }
};

module.exports = { syncCricketMatches, searchCricMatches, fetchLiveScore };
