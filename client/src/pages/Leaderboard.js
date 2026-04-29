import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './Leaderboard.css';

const Leaderboard = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users/leaderboard')
      .then(res => setUsers(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="leaderboard-page">
      <div className="container">
        <div className="lb-header">
          <h1 className="lb-title">🏆 Leaderboard</h1>
          <p className="lb-sub">Top predictors ranked by points</p>
        </div>

        {/* Top 3 podium */}
        {!loading && users.length >= 3 && (
          <div className="podium">
            {[users[1], users[0], users[2]].map((u, idx) => {
              const rank = idx === 1 ? 1 : idx === 0 ? 2 : 3;
              return (
                <div key={u._id} className={`podium-spot rank-${rank}`}>
                  <div className="podium-avatar">{u.name?.charAt(0)}</div>
                  <div className="podium-name">{u.name}</div>
                  <div className="podium-points">{u.points?.toLocaleString()}</div>
                  <div className="podium-block">
                    <span className="podium-medal">{medals[rank-1]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Full table */}
        <div className="lb-table card">
          {loading ? (
            <div className="skeleton" style={{ height: 300 }} />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Points</th>
                  <th>Wins</th>
                  <th>Losses</th>
                  <th>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, index) => {
                  const total = u.totalWins + u.totalLosses;
                  const winRate = total > 0 ? Math.round((u.totalWins / total) * 100) : 0;
                  const isMe = user && u._id === user.id;

                  return (
                    <tr key={u._id} className={`lb-row ${isMe ? 'is-me' : ''}`}>
                      <td className="rank-cell">
                        {index < 3 ? (
                          <span className="medal">{medals[index]}</span>
                        ) : (
                          <span className="rank-num">#{index + 1}</span>
                        )}
                      </td>
                      <td className="player-cell">
                        <div className="player-avatar">{u.name?.charAt(0)}</div>
                        <span className="player-name">{u.name}{isMe && <span className="you-tag">You</span>}</span>
                      </td>
                      <td className="points-cell">{u.points?.toLocaleString()}</td>
                      <td className="win-cell">{u.totalWins}</td>
                      <td className="loss-cell">{u.totalLosses}</td>
                      <td>
                        <div className="win-rate-bar">
                          <div className="win-rate-fill" style={{ width: `${winRate}%` }} />
                          <span>{winRate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
