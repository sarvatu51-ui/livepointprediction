import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import MatchCard from '../components/MatchCard';
import BetModal from '../components/BetModal';
import './Home.css';

const Home = () => {
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();

  const [matches, setMatches] = useState([]);
  const [userBets, setUserBets] = useState({}); // { matchId: bet }
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [betModal, setBetModal] = useState(null); // { match, selectedTeam }
  const [toast, setToast] = useState(null);

  // Load matches on mount
  useEffect(() => {
    fetchMatches();
    if (user) fetchUserBets();
  }, [user]);

  // Real-time: listen for socket events
  useEffect(() => {
    if (!socket) return;

    // When admin changes odds
    socket.on('oddsUpdated', ({ matchId, oddsTeamA, oddsTeamB }) => {
      setMatches(prev => prev.map(m =>
        m._id === matchId ? { ...m, oddsTeamA, oddsTeamB } : m
      ));
    });

    // When admin creates/updates/deletes a match
    socket.on('matchCreated', (match) => {
      setMatches(prev => [match, ...prev]);
    });

    socket.on('matchUpdated', (match) => {
      setMatches(prev => prev.map(m => m._id === match._id ? match : m));
    });

    socket.on('matchDeleted', ({ id }) => {
      setMatches(prev => prev.filter(m => m._id !== id));
    });

    return () => {
      socket.off('oddsUpdated');
      socket.off('matchCreated');
      socket.off('matchUpdated');
      socket.off('matchDeleted');
    };
  }, [socket]);

  const fetchMatches = async () => {
    try {
      const res = await api.get('/matches');
      setMatches(res.data);
    } catch (err) {
      console.error('Failed to fetch matches');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserBets = async () => {
    try {
      const res = await api.get('/bets/my-bets');
      const betsMap = {};
      res.data.forEach(bet => {
        betsMap[bet.matchId._id || bet.matchId] = bet;
      });
      setUserBets(betsMap);
    } catch (err) {
      console.error('Failed to fetch user bets');
    }
  };

  const handleBetClick = (match, team) => {
    if (!user) return navigate('/login');
    if (userBets[match._id]) return showToast('You already bet on this match!', 'error');
    setBetModal({ match, selectedTeam: team });
  };

  const handleBetSuccess = (data) => {
    setBetModal(null);
    fetchUserBets();
    showToast(`Bet placed! Potential win: ${data.bet.potentialWin} pts 🎯`, 'success');
  };

  const showToast = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const filtered = matches.filter(m => {
    if (filter === 'all') return true;
    return m.status === filter;
  });

  const liveCount = matches.filter(m => m.status === 'live').length;

  return (
    <div className="home-page">
      <div className="container">
        {/* Hero */}
        <div className="home-hero">
          <div className="hero-text">
            <h1 className="hero-title">
              Predict. Win.<br />
              <span className="hero-accent">Dominate.</span>
            </h1>
            <p className="hero-sub">Make live predictions on matches. Earn virtual points. Climb the leaderboard.</p>
          </div>
          {!user && (
            <div className="hero-cta">
              <button className="btn btn-primary btn-lg" onClick={() => navigate('/register')}>
                Start with 1000 Points →
              </button>
              <p className="hero-note">Free to play. Virtual points only.</p>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="filter-bar">
          <div className="filter-tabs">
            {['all', 'live', 'upcoming', 'ended'].map(tab => (
              <button
                key={tab}
                className={`filter-tab ${filter === tab ? 'active' : ''}`}
                onClick={() => setFilter(tab)}
              >
                {tab === 'live' && liveCount > 0 && <span className="live-dot" />}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'live' && liveCount > 0 && <span className="live-count">{liveCount}</span>}
              </button>
            ))}
          </div>
          <div className="match-count">{filtered.length} match{filtered.length !== 1 ? 'es' : ''}</div>
        </div>

        {/* Matches Grid */}
        {loading ? (
          <div className="matches-grid">
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 220 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏟️</div>
            <div className="empty-title">No {filter !== 'all' ? filter : ''} matches right now</div>
            <div className="empty-sub">Check back soon for upcoming events</div>
          </div>
        ) : (
          <div className="matches-grid">
            {filtered.map(match => (
              <MatchCard
                key={match._id}
                match={match}
                onBetClick={handleBetClick}
                userBet={userBets[match._id]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bet Modal */}
      {betModal && (
        <BetModal
          match={betModal.match}
          selectedTeam={betModal.selectedTeam}
          onClose={() => setBetModal(null)}
          onSuccess={handleBetSuccess}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`toast alert alert-${toast.type === 'error' ? 'error' : 'success'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default Home;
