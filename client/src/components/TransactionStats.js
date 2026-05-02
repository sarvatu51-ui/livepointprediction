import React, { useState, useMemo } from 'react';
import './TransactionStats.css';

const TransactionStats = ({ transactions }) => {
  const [dateFilter, setDateFilter] = useState('today');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showHistory, setShowHistory] = useState(false);

  // Filter transactions based on selected date range
  const filtered = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const week = new Date(today);
    week.setDate(week.getDate() - 7);
    const month = new Date(today);
    month.setDate(1);

    return transactions.filter(t => {
      const tDate = new Date(t.createdAt);

      // Date filter
      let dateMatch = true;
      if (dateFilter === 'today') dateMatch = tDate >= today;
      else if (dateFilter === 'yesterday') dateMatch = tDate >= yesterday && tDate < today;
      else if (dateFilter === 'week') dateMatch = tDate >= week;
      else if (dateFilter === 'month') dateMatch = tDate >= month;

      // Type filter
      const typeMatch = typeFilter === 'all' || t.type === typeFilter;

      // Status filter
      const statusMatch = statusFilter === 'all' || t.status === statusFilter;

      return dateMatch && typeMatch && statusMatch;
    });
  }, [transactions, dateFilter, typeFilter, statusFilter]);

  // Calculate totals
  const stats = useMemo(() => {
    const approved = filtered.filter(t => t.status === 'approved');
    const pending = filtered.filter(t => t.status === 'pending');
    const rejected = filtered.filter(t => t.status === 'rejected');

    const totalDeposited = approved.filter(t => t.type === 'deposit').reduce((s, t) => s + t.points, 0);
    const totalWithdrawn = approved.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.points, 0);
    const pendingDeposits = pending.filter(t => t.type === 'deposit').reduce((s, t) => s + t.points, 0);
    const pendingWithdrawals = pending.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.points, 0);
    const netFlow = totalDeposited - totalWithdrawn;

    return {
      totalDeposited,
      totalWithdrawn,
      pendingDeposits,
      pendingWithdrawals,
      netFlow,
      totalCount: filtered.length,
      approvedCount: approved.length,
      pendingCount: pending.length,
      rejectedCount: rejected.length
    };
  }, [filtered]);

  const dateLabels = {
    today: "Today",
    yesterday: "Yesterday",
    week: "Last 7 Days",
    month: "This Month",
    all: "All Time"
  };

  return (
    <div className="txn-stats-wrap">
      {/* Filter Bar */}
      <div className="txn-filter-bar">
        <div className="filter-group">
          <label className="filter-label">📅 Period</label>
          <div className="filter-pills">
            {['today', 'yesterday', 'week', 'month', 'all'].map(d => (
              <button
                key={d}
                className={`filter-pill ${dateFilter === d ? 'active' : ''}`}
                onClick={() => setDateFilter(d)}
              >
                {dateLabels[d]}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-row-2">
          <div className="filter-group-sm">
            <label className="filter-label">Type</label>
            <div className="filter-pills">
              {['all', 'deposit', 'withdrawal'].map(t => (
                <button
                  key={t}
                  className={`filter-pill ${typeFilter === t ? 'active' : ''}`}
                  onClick={() => setTypeFilter(t)}
                >
                  {t === 'all' ? 'All' : t === 'deposit' ? '💰 Deposits' : '💸 Withdrawals'}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group-sm">
            <label className="filter-label">Status</label>
            <div className="filter-pills">
              {['all', 'pending', 'approved', 'rejected'].map(s => (
                <button
                  key={s}
                  className={`filter-pill ${statusFilter === s ? 'active' : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="txn-summary-grid">
        <div className="txn-summary-card deposit">
          <div className="summary-icon">💰</div>
          <div className="summary-content">
            <div className="summary-label">Total Deposited</div>
            <div className="summary-value green">{stats.totalDeposited.toLocaleString()}</div>
            <div className="summary-sub">pts (approved)</div>
          </div>
        </div>
        <div className="txn-summary-card withdrawal">
          <div className="summary-icon">💸</div>
          <div className="summary-content">
            <div className="summary-label">Total Withdrawn</div>
            <div className="summary-value red">{stats.totalWithdrawn.toLocaleString()}</div>
            <div className="summary-sub">pts (approved)</div>
          </div>
        </div>
        <div className="txn-summary-card pending-deps">
          <div className="summary-icon">⏳</div>
          <div className="summary-content">
            <div className="summary-label">Pending Deposits</div>
            <div className="summary-value amber">{stats.pendingDeposits.toLocaleString()}</div>
            <div className="summary-sub">pts awaiting</div>
          </div>
        </div>
        <div className="txn-summary-card pending-wds">
          <div className="summary-icon">⏳</div>
          <div className="summary-content">
            <div className="summary-label">Pending Withdrawals</div>
            <div className="summary-value amber">{stats.pendingWithdrawals.toLocaleString()}</div>
            <div className="summary-sub">pts awaiting</div>
          </div>
        </div>
        <div className={`txn-summary-card net ${stats.netFlow >= 0 ? 'positive' : 'negative'}`}>
          <div className="summary-icon">{stats.netFlow >= 0 ? '📈' : '📉'}</div>
          <div className="summary-content">
            <div className="summary-label">Net Flow</div>
            <div className={`summary-value ${stats.netFlow >= 0 ? 'green' : 'red'}`}>
              {stats.netFlow >= 0 ? '+' : ''}{stats.netFlow.toLocaleString()}
            </div>
            <div className="summary-sub">deposit - withdrawal</div>
          </div>
        </div>
        <div className="txn-summary-card count">
          <div className="summary-icon">📊</div>
          <div className="summary-content">
            <div className="summary-label">Transactions</div>
            <div className="summary-value">{stats.totalCount}</div>
            <div className="summary-sub">
              ✅{stats.approvedCount} ⏳{stats.pendingCount} ❌{stats.rejectedCount}
            </div>
          </div>
        </div>
      </div>

      {/* Period label */}
      <div className="period-label">
        Showing: <strong>{dateLabels[dateFilter]}</strong>
        {typeFilter !== 'all' && <> · <strong>{typeFilter === 'deposit' ? 'Deposits only' : 'Withdrawals only'}</strong></>}
        {statusFilter !== 'all' && <> · <strong>{statusFilter}</strong></>}
        <span className="period-count">{filtered.length} records</span>
      </div>

      {/* Toggle history */}
      <button
        className="toggle-history-btn"
        onClick={() => setShowHistory(!showHistory)}
      >
        {showHistory ? '▲ Hide Transaction History' : '▼ Show Transaction History'}
      </button>

      {/* Transaction History Table */}
      {showHistory && (
        <div className="txn-history-table">
          {filtered.length === 0 ? (
            <div className="empty-txn">No transactions found for this period.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Type</th>
                  <th>Points</th>
                  <th>Status</th>
                  <th>Reference</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(txn => (
                  <tr key={txn._id} className={`txn-tr ${txn.status}`}>
                    <td>
                      <div className="txn-user-mini">
                        <div className="txn-avatar-sm">{txn.userId?.name?.charAt(0)}</div>
                        <div>
                          <div className="txn-name-sm">{txn.userId?.name}</div>
                          <div className="txn-email-sm">{txn.userId?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`txn-type-badge ${txn.type}`}>
                        {txn.type === 'deposit' ? '💰 Deposit' : '💸 Withdrawal'}
                      </span>
                    </td>
                    <td className="txn-pts">{txn.points?.toLocaleString()}</td>
                    <td>
                      <span className={`result-badge ${txn.status === 'approved' ? 'won' : txn.status === 'rejected' ? 'lost' : 'pending'}`}>
                        {txn.status === 'approved' ? '✅ Approved' : txn.status === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                      </span>
                    </td>
                    <td className="txn-ref">{txn.reference || '—'}</td>
                    <td className="txn-date-sm">{new Date(txn.createdAt).toLocaleString()}</td>
                    <td>
                      {txn.status === 'pending' && txn.onApprove && txn.onReject && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-success btn-sm" onClick={() => txn.onApprove(txn._id)}>✅</button>
                          <button className="btn btn-danger btn-sm" onClick={() => txn.onReject(txn._id)}>❌</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default TransactionStats;
