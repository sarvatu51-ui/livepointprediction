import { useEffect, useMemo, useState } from 'react';
import http from '../utils/api';
import { useAuth } from '../context/AuthContext';

const CasinoPage = () => {
  const { refreshUser } = useAuth();
  const [games, setGames] = useState([]);
  const [activeGame, setActiveGame] = useState('aviator');
  const [stake, setStake] = useState(50);
  const [clientSeed, setClientSeed] = useState('player-seed-1');
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);

  const loadGames = async () => {
    const { data } = await http.get('/casino/games');
    setGames(data);
    if (data.length > 0 && !data.find((g) => g.key === activeGame)) {
      setActiveGame(data[0].key);
    }
  };

  const loadHistory = async (gameKey) => {
    const { data } = await http.get('/casino/history', {
      params: gameKey ? { game: gameKey } : {}
    });
    setHistory(data);
  };

  useEffect(() => {
    loadGames();
    loadHistory(activeGame);
  }, []);

  useEffect(() => {
    loadHistory(activeGame);
  }, [activeGame]);

  const selectedGame = useMemo(() => games.find((g) => g.key === activeGame), [games, activeGame]);

  const handlePlay = async () => {
    setError('');
    setMessage('');
    setPlaying(true);

    try {
      const { data } = await http.post(`/casino/play/${activeGame}`, {
        stake: Number(stake),
        clientSeed
      });
      setMessage(
        `${data.message} Multiplier: ${data.bet.multiplier}x | Payout: ${data.bet.payout} | Balance: ${data.pointsLeft}`
      );
      await Promise.all([loadHistory(activeGame), refreshUser()]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to play');
    } finally {
      setPlaying(false);
    }
  };

  return (
    <section>
      <h2 className="section-title">Casino</h2>
      <p className="subtitle">Fair-engine mode with fixed RTP and verifiable seeds.</p>

      {message && <div className="success-box">{message}</div>}
      {error && <div className="error-box">{error}</div>}

      <div className="casino-layout">
        <div className="panel">
          <h3>Games</h3>
          <div className="casino-tabs">
            {games.map((game) => (
              <button
                type="button"
                key={game.key}
                className={`casino-tab ${activeGame === game.key ? 'active' : ''}`}
                onClick={() => setActiveGame(game.key)}
              >
                {game.name}
              </button>
            ))}
          </div>
          {selectedGame && (
            <div className="casino-meta">
              <p>
                Bet Range: <strong>{selectedGame.minBet}</strong> to <strong>{selectedGame.maxBet}</strong>
              </p>
              <p>
                RTP: <strong>{selectedGame.rtp}%</strong>
              </p>
            </div>
          )}
        </div>

        <div className="panel">
          <h3>Play {selectedGame?.name || ''}</h3>
          <label htmlFor="stake-input">Stake</label>
          <input
            id="stake-input"
            type="number"
            min={selectedGame?.minBet || 1}
            max={selectedGame?.maxBet || 99999}
            value={stake}
            onChange={(e) => setStake(e.target.value)}
          />
          <label htmlFor="seed-input">Client Seed</label>
          <input
            id="seed-input"
            type="text"
            value={clientSeed}
            onChange={(e) => setClientSeed(e.target.value)}
            maxLength={64}
          />
          <button type="button" className="btn" onClick={handlePlay} disabled={playing}>
            {playing ? 'Playing...' : 'Play Now'}
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginTop: '14px' }}>
        <h3>{selectedGame?.name || 'Game'} History</h3>
        <div className="list-wrap">
          {history.length ? (
            history.map((entry) => (
              <div className="list-item" key={entry._id}>
                <strong>
                  {entry.result.toUpperCase()} | {entry.multiplier}x
                </strong>
                <span>
                  Stake: {entry.stake} | Payout: {entry.payout} | Nonce: {entry.nonce}
                </span>
                <span>
                  Seed Hash: {entry.serverSeedHash.slice(0, 18)}... | Client Seed: {entry.clientSeed}
                </span>
              </div>
            ))
          ) : (
            <p>No casino rounds yet.</p>
          )}
        </div>
      </div>
    </section>
  );
};

export default CasinoPage;
