import React, { useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './TransactionModal.css';

const TransactionModal = ({ type, onClose, onSuccess }) => {
  const { user, updatePoints } = useAuth();
  const [points, setPoints] = useState(100);
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isWithdrawal = type === 'withdrawal';
  const quickAmounts = [100, 250, 500, 1000];

  const handleSubmit = async () => {
    setError('');
    if (points < 100) return setError('Minimum is 100 points.');
    if (isWithdrawal && points > user.points) return setError('Not enough points!');

    setLoading(true);
    try {
      const endpoint = isWithdrawal ? '/transactions/withdraw' : '/transactions/deposit';
      const payload = isWithdrawal ? { points } : { points, reference };
      const res = await api.post(endpoint, payload);

      if (res.data.newPoints !== undefined) {
        updatePoints(res.data.newPoints);
      }

      onSuccess(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Request failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box card" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title">
              {isWithdrawal ? '💸 Redeem Points' : '💰 Deposit Points'}
            </div>
            <div className="modal-subtitle">
              {isWithdrawal
                ? 'Request to withdraw your points'
                : 'Request admin to add points to your account'}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Info box */}
        <div className={`txn-info-box ${isWithdrawal ? 'withdrawal' : 'deposit'}`}>
          {isWithdrawal ? (
            <>
              <div className="txn-info-icon">ℹ️</div>
              <div className="txn-info-text">
                Points will be locked immediately. Admin will review and process your withdrawal request.
                Your current balance: <strong>{user?.points?.toLocaleString()} pts</strong>
              </div>
            </>
          ) : (
            <>
              <div className="txn-info-icon">ℹ️</div>
              <div className="txn-info-text">
                Submit a deposit request. Once admin verifies your payment, points will be added to your account.
              </div>
            </>
          )}
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
                disabled={isWithdrawal && amt > user.points}
              >
                {amt}
              </button>
            ))}
          </div>
        </div>

        {/* Points input */}
        <div className="modal-section">
          <label className="form-label">Points Amount</label>
          <div className="points-input-wrap">
            <span className="points-icon-input">🪙</span>
            <input
              type="number"
              className="form-input points-input"
              value={points}
              onChange={e => setPoints(Math.max(0, parseInt(e.target.value) || 0))}
              min="100"
              max={isWithdrawal ? user.points : 99999}
            />
          </div>
          {isWithdrawal && (
            <div className="available-points">
              Available: <span>{user?.points?.toLocaleString()} pts</span>
            </div>
          )}
        </div>

        {/* Reference (for deposits only) */}
        {!isWithdrawal && (
          <div className="modal-section">
            <label className="form-label">Payment Reference (optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="UPI txn ID, bank ref, etc."
              value={reference}
              onChange={e => setReference(e.target.value)}
            />
          </div>
        )}

        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

        <button
          className={`btn btn-lg confirm-bet-btn ${isWithdrawal ? 'btn-danger' : 'btn-success'}`}
          onClick={handleSubmit}
          disabled={loading || points < 100 || (isWithdrawal && points > user.points)}
        >
          {loading ? 'Submitting...' : isWithdrawal
            ? `Request Withdrawal – ${points.toLocaleString()} pts`
            : `Request Deposit – ${points.toLocaleString()} pts`}
        </button>

        <p className="modal-disclaimer">
          All transactions are reviewed by admin before processing.
        </p>
      </div>
    </div>
  );
};

export default TransactionModal;
