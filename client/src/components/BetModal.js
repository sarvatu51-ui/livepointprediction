import React, { useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './BetModal.css';

const BetModal = ({ match, selectedTeam, onClose, onSuccess }) => {
  const { user, updatePoints } = useAuth();
  const [points, setPoints] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const odds = selectedTeam === 'teamA' ? match.oddsTeamA
    : selectedTeam === 'teamB' ? match.oddsTeamB
    : match.oddsDraw;

  const teamName = selectedTeam === 'teamA' ? match.teamA
    : selectedTeam === 'teamB' ? match.teamB
    : 'Draw';

  const potentialWin = Math.floor(points * odds);
  const netGain = potentialWin - points;

  const quickAmounts = [50, 100, 250, 500];

  const handleBet = async () => {
    setError('');
    if (points < 10) return setError('Minimum bet is 10 points.');
    if (points > user.points) return setError('Not enough points!');

    setLoading(true);
    try {
      const res = await api.post('/bets', {
        matchId: match._id,
        selectedTeam,
        pointsBet: parseInt(points)
      });
      updatePoints(res.data.newPoints);
      onSuccess(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place bet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title">Place Prediction</div>
            <div className="modal-subtitle">{match.teamA} vs {match.teamB}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Selection Info */}
        <div className="bet-selection">
          <div className="selection-label">Your Pick</div>
          <div className="selection-team">{teamName}</div>
          <div className="selection-odds">{odds?.toFixed(2)}x</div>
        </div>

        {/* Quick amounts */}
        <div className="modal-section">
          <label className="form-label">Quick Select</label>
          <div className="quick-amounts">
            {quickAmounts.map(amt => (
              <button
                key={amt}
                className={`quick-btn ${points === amt ? 'active' : ''}`}
                onClick={() => setPoints(amt)}
                disabled={amt > user.points}
              >
                {amt}
              </button>
            ))}
            <button
              className="quick-btn"
              onClick={() => setPoints(Math.floor(user.points / 2))}
            >
              ½ All
            </button>
          </div>
        </div>

        {/* Points input */}
        <div className="modal-section">
          <label className="form-label">Points to Bet</label>
          <div className="points-input-wrap">
            <span className="points-icon-input">🪙</span>
            <input
              type="number"
              className="form-input points-input"
              value={points}
              onChange={(e) => setPoints(Math.max(0, parseInt(e.target.value) || 0))}
              min="10"
              max={user.points}
            />
          </div>
          <div className="available-points">Available: <span>{user.points?.toLocaleString()} pts</span></div>
        </div>

        {/* Payout preview */}
        <div className="payout-preview">
          <div className="payout-row">
            <span>Bet Amount</span>
            <span className="payout-val">{points.toLocaleString()} pts</span>
          </div>
          <div className="payout-row">
            <span>Odds</span>
            <span className="payout-val">{odds?.toFixed(2)}x</span>
          </div>
          <div className="payout-divider" />
          <div className="payout-row payout-win">
            <span>If You Win</span>
            <span className="payout-big">+{netGain.toLocaleString()} pts</span>
          </div>
          <div className="payout-row payout-lose">
            <span>If You Lose</span>
            <span className="payout-loss">-{points.toLocaleString()} pts</span>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <button
          className="btn btn-primary btn-lg confirm-bet-btn"
          onClick={handleBet}
          disabled={loading || points < 10 || points > user.points}
        >
          {loading ? 'Placing...' : `Confirm Bet – ${points.toLocaleString()} pts`}
        </button>

        <p className="modal-disclaimer">Virtual points only. No real money involved.</p>
      </div>
    </div>
  );
};

export default BetModal;
