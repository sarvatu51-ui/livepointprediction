import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './MatchCard.css';

const MatchCard = ({ match, onBetClick, userBet }) => {
  const navigate = useNavigate();

  // Track previous odds to animate when they change
  const [oddsA, setOddsA] = useState(match.oddsTeamA);
  const [oddsB, setOddsB] = useState(match.oddsTeamB);
  const [oddsAClass, setOddsAClass] = useState('');
  const [oddsBClass, setOddsBClass] = useState('');
  const prevOddsA = useRef(match.oddsTeamA);
  const prevOddsB = useRef(match.oddsTeamB);

  // Animate when odds change from parent (socket update)
  useEffect(() => {
    if (match.oddsTeamA !== prevOddsA.current) {
      const direction = match.oddsTeamA > prevOddsA.current ? 'odds-up' : 'odds-down';
      setOddsAClass(direction);
      setOddsA(match.oddsTeamA);
      prevOddsA.current = match.oddsTeamA;
      // Remove class after animation
      setTimeout(() => setOddsAClass(''), 700);
    }
    if (match.oddsTeamB !== prevOddsB.current) {
      const direction = match.oddsTeamB > prevOddsB.current ? 'odds-up' : 'odds-down';
      setOddsBClass(direction);
      setOddsB(match.oddsTeamB);
      prevOddsB.current = match.oddsTeamB;
      setTimeout(() => setOddsBClass(''), 700);
    }
  }, [match.oddsTeamA, match.oddsTeamB]);

  const statusBadge = {
    live: <span className="badge badge-live">Live</span>,
    upcoming: <span className="badge badge-upcoming">Upcoming</span>,
    ended: <span className="badge badge-ended">Ended</span>,
  };

  const resultLabel = (team) => {
    if (match.status !== 'ended' || !match.result) return null;
    const won = match.result === team;
    return <span className={`result-chip ${won ? 'won' : 'lost'}`}>{won ? '🏆 Winner' : 'Lost'}</span>;
  };

  return (
    <div className={`match-card card animate-in ${match.status}`} onClick={() => navigate(`/match/${match._id}`)}>
      {/* Header */}
      <div className="match-card-header">
        <div className="match-sport">{match.sport || 'Football'}</div>
        <div className="header-right">
          {statusBadge[match.status]}
          {userBet && <span className="your-bet-badge">Your bet: {userBet.selectedTeam === 'teamA' ? match.teamA : match.teamB}</span>}
        </div>
      </div>

      {/* Teams */}
      <div className="match-teams">
        {/* Team A */}
        <div className="team">
          <div className="team-logo">{match.teamALogo || match.teamA.charAt(0)}</div>
          <div className="team-name">{match.teamA}</div>
          {resultLabel('teamA')}
        </div>

        {/* VS / Score */}
        <div className="match-vs">
          <span className="vs-text">VS</span>
          {match.status === 'live' && <div className="live-pulse" />}
        </div>

        {/* Team B */}
        <div className="team team-right">
          <div className="team-logo">{match.teamBLogo || match.teamB.charAt(0)}</div>
          <div className="team-name">{match.teamB}</div>
          {resultLabel('teamB')}
        </div>
      </div>

      {/* Odds */}
      {match.status !== 'ended' && (
        <div className="odds-row">
          <button
            className={`odds-btn ${userBet?.selectedTeam === 'teamA' ? 'selected' : ''}`}
            onClick={(e) => { e.stopPropagation(); onBetClick && onBetClick(match, 'teamA'); }}
            disabled={!onBetClick || !!userBet}
          >
            <span className="odds-team">{match.teamA}</span>
            <span className={`odds-value ${oddsAClass}`}>{oddsA.toFixed(2)}x</span>
          </button>

          {match.oddsDraw && (
            <button
              className={`odds-btn draw-btn ${userBet?.selectedTeam === 'draw' ? 'selected' : ''}`}
              onClick={(e) => { e.stopPropagation(); onBetClick && onBetClick(match, 'draw'); }}
              disabled={!onBetClick || !!userBet}
            >
              <span className="odds-team">Draw</span>
              <span className="odds-value">{match.oddsDraw?.toFixed(2)}x</span>
            </button>
          )}

          <button
            className={`odds-btn ${userBet?.selectedTeam === 'teamB' ? 'selected' : ''}`}
            onClick={(e) => { e.stopPropagation(); onBetClick && onBetClick(match, 'teamB'); }}
            disabled={!onBetClick || !!userBet}
          >
            <span className="odds-team">{match.teamB}</span>
            <span className={`odds-value ${oddsBClass}`}>{oddsB.toFixed(2)}x</span>
          </button>
        </div>
      )}

      {/* Bet info for ended match */}
      {match.status === 'ended' && userBet && (
        <div className={`bet-result-bar ${userBet.result}`}>
          {userBet.result === 'won'
            ? `✅ You won +${userBet.pointsChange} pts`
            : userBet.result === 'lost'
            ? `❌ You lost ${Math.abs(userBet.pointsChange)} pts`
            : '⏳ Pending result'}
        </div>
      )}

      {/* Popularity bar */}
      {(match.totalBetsTeamA > 0 || match.totalBetsTeamB > 0) && (
        <div className="popularity-bar">
          <div
            className="pop-a"
            style={{ width: `${(match.totalBetsTeamA / (match.totalBetsTeamA + match.totalBetsTeamB)) * 100}%` }}
          />
          <div className="pop-b" />
        </div>
      )}
    </div>
  );
};

export default MatchCard;
