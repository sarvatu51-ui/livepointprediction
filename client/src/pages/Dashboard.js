import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import TransactionModal from '../components/TransactionModal';
import './Dashboard.css';

const Dashboard = () => {
  const { user, updatePoints } = useAuth();
  const socket = useSocket();
  const [bets, setBets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('bets');
  const [txnModal, setTxnModal] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => { fetchBets(); fetchTransactions(); }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('transactionProcessed', (data) => {
      if (data.newPoints !== undefined) updatePoints(data.newPoints);
      fetchTransactions();
      showToast(
        data.status === 'approved'
          ? `✅ Your ${data.type} of ${data.points} pts was approved!`
          : `❌ Your ${data.type} request was rejected. ${data.note || ''}`,
        data.status === 'approved' ? 'success' : 'error'
      );
    });
    socket.on('pointsUpdated', (data) => { updatePoints(data.points); });
    return () => { socket.off('transactionProcessed'); socket.off('pointsUpdated'); };
  }, [socket]);

  const fetchBets = async () => {
    try { const res = await api.get('/bets/my-bets'); setBets(res.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchTransactions = async () => {
    try { const res = await api.get('/transactions/my'); setTransactions(res.data); }
    catch (err) { console.error(err); }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const activeBets = bets.filter(b => b.result === 'pending');
  const wonBets = bets.filter(b => b.result === 'won');
  const lostBets = bets.filter(b => b.result === 'lost');
  const winRate = (wonBets.length + lostBets.length) > 0
    ? Math.round((wonBets.length / (wonBets.length + lostBets.length)) * 100) : 0;

  const pendingDeposit = transactions.find(t => t.type === 'deposit' && t.status === 'pending');
  const pendingWithdrawal = transactions.find(t => t.type === 'withdrawal' && t.status === 'pending');

  return (
    <div className="dashboard-page">
      <div className="container">
        <div className="dash-header">
          <div>
            <h1 className="dash-title">My Dashboard</h1>
            <p className="dash-sub">Manage predictions and your points wallet</p>
          </div>
          <div className="dash-header-right">
            <div className="points-big">
              <span className="points-label-sm">Balance</span>
              <span className="points-num">{user?.points?.toLocaleString()}</span>
              <span className="points-unit">pts</span>
            </div>
            <div className="wallet-actions">
              <button className="btn btn-success" onClick={() => setTxnModal('deposit')} disabled={!!pendingDeposit}>
                💰 Deposit {pendingDeposit && <span className="pending-dot" />}
              </button>
              <button className="btn btn-danger" onClick={() => setTxnModal('withdrawal')} disabled={!!pendingWithdrawal || user?.points < 100}>
                💸 Redeem {pendingWithdrawal && <span className="pending-dot" />}
              </button>
            </div>
          </div>
        </div>

        <div className="stats-grid">
          {[
            { icon: '🎯', val: bets.length, label: 'Total Bets', cls: '' },
            { icon: '⏳', val: activeBets.length, label: 'Active', cls: 'accent' },
            { icon: '✅', val: wonBets.length, label: 'Won', cls: 'green' },
            { icon: '❌', val: lostBets.length, label: 'Lost', cls: 'red' },
            { icon: '🏆', val: `${winRate}%`, label: 'Win Rate', cls: '' },
            { icon: '💳', val: transactions.filter(t => t.status === 'pending').length, label: 'Pending', cls: 'accent' },
          ].map(s => (
            <div key={s.label} className="stat-card card">
              <div className="stat-icon">{s.icon}</div>
              <div className={`stat-value ${s.cls}`}>{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="dash-tabs">
          <button className={`dash-tab ${activeTab === 'bets' ? 'active' : ''}`} onClick={() => setActiveTab('bets')}>🎯 Bet History</button>
          <button className={`dash-tab ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>
            💳 Transactions
            {transactions.filter(t => t.status === 'pending').length > 0 && (
              <span className="tab-badge">{transactions.filter(t => t.status === 'pending').length}</span>
            )}
          </button>
        </div>

        {activeTab === 'bets' && (
          <>
            {activeBets.length > 0 && (
              <div className="dash-section">
                <h2 className="section-title">⏳ Active Predictions</h2>
                <div className="bets-list">
                  {activeBets.map(bet => {
                    const m = bet.matchId;
                    const team = bet.selectedTeam === 'teamA' ? m?.teamA : bet.selectedTeam === 'teamB' ? m?.teamB : 'Draw';
                    return (
                      <div key={bet._id} className="active-bet card">
                        <div className="active-bet-match">{m?.teamA} vs {m?.teamB}</div>
                        <div className="active-bet-details">
                          <span>Pick: <strong>{team}</strong></span>
                          <span className="mono">{bet.pointsBet} pts @ {bet.oddsAtTime?.toFixed(2)}x</span>
                          <span className="potential">→ {bet.potentialWin} pts if win</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="dash-section">
              <h2 className="section-title">📜 All Bets</h2>
              {loading ? <div className="skeleton" style={{ height: 200 }} /> : bets.length === 0 ? (
                <div className="empty-bets">No bets yet. Go to Matches and start predicting!</div>
              ) : (
                <div className="bets-table card">
                  <table>
                    <thead><tr><th>Match</th><th>Pick</th><th>Bet</th><th>Odds</th><th>Potential</th><th>Result</th><th>P&L</th></tr></thead>
                    <tbody>
                      {bets.map(bet => {
                        const m = bet.matchId;
                        const team = bet.selectedTeam === 'teamA' ? m?.teamA : bet.selectedTeam === 'teamB' ? m?.teamB : 'Draw';
                        return (
                          <tr key={bet._id} className={`bet-row ${bet.result}`}>
                            <td className="match-cell">{m?.teamA} vs {m?.teamB}</td>
                            <td className="pick-cell">{team}</td>
                            <td className="mono">{bet.pointsBet?.toLocaleString()}</td>
                            <td className="mono cyan">{bet.oddsAtTime?.toFixed(2)}x</td>
                            <td className="mono">{bet.potentialWin?.toLocaleString()}</td>
                            <td><span className={`result-badge ${bet.result}`}>{bet.result === 'won' ? '✅ Won' : bet.result === 'lost' ? '❌ Lost' : '⏳ Pending'}</span></td>
                            <td className={`mono pnl ${bet.result}`}>{bet.result === 'won' ? `+${bet.pointsChange}` : bet.result === 'lost' ? `−${Math.abs(bet.pointsChange)}` : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'transactions' && (
          <div className="dash-section">
            <h2 className="section-title">💳 Transaction History</h2>
            {transactions.length === 0 ? (
              <div className="empty-bets">No transactions yet.</div>
            ) : (
              <div className="bets-table card">
                <table>
                  <thead><tr><th>Type</th><th>Points</th><th>Status</th><th>Reference</th><th>Note</th><th>Date</th></tr></thead>
                  <tbody>
                    {transactions.map(txn => (
                      <tr key={txn._id}>
                        <td><span className={`txn-type-badge ${txn.type}`}>{txn.type === 'deposit' ? '💰 Deposit' : '💸 Withdrawal'}</span></td>
                        <td className="mono amber">{txn.points?.toLocaleString()} pts</td>
                        <td><span className={`result-badge ${txn.status === 'approved' ? 'won' : txn.status === 'rejected' ? 'lost' : 'pending'}`}>{txn.status === 'approved' ? '✅ Approved' : txn.status === 'rejected' ? '❌ Rejected' : '⏳ Pending'}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{txn.reference || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{txn.note || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(txn.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {txnModal && <TransactionModal type={txnModal} onClose={() => setTxnModal(null)} onSuccess={(msg) => { setTxnModal(null); fetchTransactions(); showToast(msg); }} />}
      {toast && <div className={`toast alert alert-${toast.type === 'error' ? 'error' : 'success'}`}>{toast.msg}</div>}
    </div>
  );
};

export default Dashboard;
