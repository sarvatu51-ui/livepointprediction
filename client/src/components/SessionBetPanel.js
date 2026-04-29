import React, { useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './SessionBetPanel.css';

const SessionBetPanel = ({ match, onBetPlaced }) => {
  const { user, updatePoints } = useAuth();
  const [activeBet, setActiveBet] = useState(null); // { session, prediction }
  const [points, setPoints] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [placedSessions, setPlacedSessions] = useState(new Set());

  if (!match.isCricket || !match.sessions || match.sessions.length === 0) return null;

  const openSessions = match.sessions.filter(s => s.isOpen && !s.result);

  if (openSessions.length === 0) return null;

  const handleSelectBet = (session, prediction) => {
    if (placedSessions.has(session.sessionType)) return;
    setActiveBet({ session, prediction });
    setPoints(100);
    setError('');
  };

  const handleConfirm = async () => {
    if (!activeBet) return;
    setError('');

    if (points < 10) return setError('Minimum bet is 10 points.');
    if (points > user.points) return setError('Not enough points!');

    const { session, prediction } = activeBet;
    const odds = prediction === 'over' ? session.oddsOver
      : prediction === 'under' ? session.oddsUnder
      : prediction === 'teamA' ? session.oddsTeamA
      : session.oddsTeamB;

    setLoading(true);
    try {
      const res = await api.post('/sessions/bet', {
        matchId: match._id,
        sessionType: session.sessionType,
        sessionLabel: session.label,
        prediction,
        line: session.line,
        pointsBet: parseInt(points),
        oddsAtTime: odds
      });

      updatePoints(res.data.newPoints);
      setPlacedSessions(prev => new Set([...prev, session.sessionType]));
      setActiveBet(null);
      onBetPlaced && onBetPlaced(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Bet failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="session-panel">
      <div className="session-panel-title">
        <span className="session-icon">🏏</span>
        Session Markets
      </div>

      <div className="sessions-list">
        {openSessions.map(session => {
          const alreadyBet = placedSessions.has(session.sessionType);
          const isToss = session.sessionType === 'toss';

          return (
            <div key={session.sessionType} className={`session-card ${alreadyBet ? 'bet-placed' : ''}`}>
              <div className="session-label">{session.label}</div>
              {session.line && (
                <div className="session-line">Line: <strong>{session.line}</strong> runs</div>
              )}

              <div className="session-odds-row">
                {isToss ? (
                  <>
                    <button
                      className={`session-odds-btn ${activeBet?.session.sessionType === session.sessionType && activeBet?.prediction === 'teamA' ? 'selected' : ''}`}
                      onClick={() => handleSelectBet(session, 'teamA')}
                      disabled={alreadyBet}
                    >
                      <span>{match.teamA}</span>
                      <span className="odds-value">{session.oddsTeamA?.toFixed(2)}x</span>
                    </button>
                    <button
                      className={`session-odds-btn ${activeBet?.session.sessionType === session.sessionType && activeBet?.prediction === 'teamB' ? 'selected' : ''}`}
                      onClick={() => handleSelectBet(session, 'teamB')}
                      disabled={alreadyBet}
                    >
                      <span>{match.teamB}</span>
                      <span className="odds-value">{session.oddsTeamB?.toFixed(2)}x</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className={`session-odds-btn over ${activeBet?.session.sessionType === session.sessionType && activeBet?.prediction === 'over' ? 'selected' : ''}`}
                      onClick={() => handleSelectBet(session, 'over')}
                      disabled={alreadyBet}
                    >
                      <span>Over {session.line}</span>
                      <span className="odds-value">{session.oddsOver?.toFixed(2)}x</span>
                    </button>
                    <button
                      className={`session-odds-btn under ${activeBet?.session.sessionType === session.sessionType && activeBet?.prediction === 'under' ? 'selected' : ''}`}
                      onClick={() => handleSelectBet(session, 'under')}
                      disabled={alreadyBet}
                    >
                      <span>Under {session.line}</span>
                      <span className="odds-value">{session.oddsUnder?.toFixed(2)}x</span>
                    </button>
                  </>
                )}
              </div>

              {alreadyBet && (
                <div className="session-bet-placed">✅ Bet placed on this session</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Inline bet confirmation */}
      {activeBet && (
        <div className="session-confirm-box">
          <div className="confirm-header">
            Confirm: <strong>{activeBet.session.label}</strong> →{' '}
            <span className="confirm-pick">
              {activeBet.prediction === 'over' ? `Over ${activeBet.session.line}`
                : activeBet.prediction === 'under' ? `Under ${activeBet.session.line}`
                : activeBet.prediction === 'teamA' ? match.teamA
                : match.teamB}
            </span>
          </div>

          <div className="confirm-row">
            <input
              type="number"
              className="form-input confirm-points-input"
              value={points}
              min="10"
              max={user.points}
              onChange={e => setPoints(Math.max(0, parseInt(e.target.value) || 0))}
            />
            <span className="confirm-potential">
              → {Math.floor(points * (
                activeBet.prediction === 'over' ? activeBet.session.oddsOver
                  : activeBet.prediction === 'under' ? activeBet.session.oddsUnder
                  : activeBet.prediction === 'teamA' ? activeBet.session.oddsTeamA
                  : activeBet.session.oddsTeamB
              ))} pts if win
            </span>
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 8, fontSize: 13 }}>{error}</div>}

          <div className="confirm-actions">
            <button className="btn btn-primary btn-sm" onClick={handleConfirm} disabled={loading}>
              {loading ? 'Placing...' : 'Confirm Bet'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveBet(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionBetPanel;
