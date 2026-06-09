// SotMDE StatsPage — admin-role-gated statistics and event log viewer.
// Phase 8.5.7.
// Gated via user.permissions?.isAdmin (same pattern as CardStatsAdmin).
// Routes: /admin/stats
//
// Three views:
//   1. Overview   — total games, win rate by villain/hero (with version breakdown)
//   2. Game list  — paginated, each row links to event log
//   3. Event log  — per-game event log with eventType filter

import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';

const API_BASE = '/api/admin/stats';

// ---- Overview Tab ----
const OverviewTab = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setLoading(true);
        fetch(API_BASE + '/outcomes', { credentials: 'include' })
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then((d) => { setData(d); setLoading(false); })
            .catch((e) => { setError(e.message); setLoading(false); });
    }, []);

    if (loading) return <div style={loadingStyle}>Loading overview…</div>;
    if (error) return <div style={errorStyle}>Error: {error}</div>;
    if (!data) return null;

    const { totalGames = 0, avgDurationMinutes = 0, villainStats = [], heroStats = [] } = data;

    return (
        <div>
            <div style={summaryRowStyle}>
                <StatCard label='Total Games' value={totalGames} />
                <StatCard label='Avg Duration' value={`${Math.round(avgDurationMinutes)} min`} />
            </div>

            <h4 style={sectionTitleStyle}>Win Rate by Villain Deck</h4>
            <table style={tableStyle}>
                <thead>
                    <tr style={theadStyle}>
                        <th style={thStyle}>Villain Deck</th>
                        <th style={thStyle}>Version</th>
                        <th style={thStyle}>Games</th>
                        <th style={thStyle}>Hero Wins</th>
                        <th style={thStyle}>Villain Wins</th>
                        <th style={thStyle}>Win Rate (Heroes)</th>
                    </tr>
                </thead>
                <tbody>
                    {villainStats.length === 0 ? (
                        <tr><td colSpan={6} style={tdCenterStyle}>No data yet</td></tr>
                    ) : villainStats.map((row, i) => (
                        <tr key={i} style={i % 2 === 0 ? rowEvenStyle : rowOddStyle}>
                            <td style={tdStyle}>{row.villainDeckId}</td>
                            <td style={tdStyle}>{row.villainDeckVersion || '—'}</td>
                            <td style={tdStyle}>{row.count}</td>
                            <td style={tdStyle}>{row.heroWins}</td>
                            <td style={tdStyle}>{row.villainWins}</td>
                            <td style={tdStyle}>
                                {row.count > 0
                                    ? `${Math.round((row.heroWins / row.count) * 100)}%`
                                    : '—'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <h4 style={sectionTitleStyle}>Win Rate by Hero Deck</h4>
            <table style={tableStyle}>
                <thead>
                    <tr style={theadStyle}>
                        <th style={thStyle}>Hero Deck</th>
                        <th style={thStyle}>Version</th>
                        <th style={thStyle}>Games</th>
                        <th style={thStyle}>Wins</th>
                        <th style={thStyle}>Win Rate</th>
                    </tr>
                </thead>
                <tbody>
                    {heroStats.length === 0 ? (
                        <tr><td colSpan={5} style={tdCenterStyle}>No data yet</td></tr>
                    ) : heroStats.map((row, i) => (
                        <tr key={i} style={i % 2 === 0 ? rowEvenStyle : rowOddStyle}>
                            <td style={tdStyle}>{row.heroDeckId}</td>
                            <td style={tdStyle}>{row.heroDeckVersion || '—'}</td>
                            <td style={tdStyle}>{row.count}</td>
                            <td style={tdStyle}>{row.wins}</td>
                            <td style={tdStyle}>
                                {row.count > 0
                                    ? `${Math.round((row.wins / row.count) * 100)}%`
                                    : '—'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// ---- Game List Tab ----
const GameListTab = ({ onSelectGame }) => {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const PAGE_SIZE = 20;

    const loadGames = useCallback((p) => {
        setLoading(true);
        fetch(`${API_BASE}/games?page=${p}&limit=${PAGE_SIZE}`, { credentials: 'include' })
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then((d) => {
                const rows = Array.isArray(d) ? d : (d.games || []);
                setGames(rows);
                setHasMore(rows.length >= PAGE_SIZE);
                setLoading(false);
            })
            .catch((e) => { setError(e.message); setLoading(false); });
    }, []);

    useEffect(() => { loadGames(page); }, [page, loadGames]);

    if (loading) return <div style={loadingStyle}>Loading games…</div>;
    if (error) return <div style={errorStyle}>Error: {error}</div>;

    const formatDate = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleString();
    };

    const formatDecks = (game) => {
        const parts = [];
        if (game.villainDeckId) parts.push(`Villain: ${game.villainDeckId}@${game.villainDeckVersion || '?'}`);
        if (game.heroes && game.heroes.length > 0) {
            parts.push('Heroes: ' + game.heroes.map(h => `${h.heroDeckId}@${h.heroDeckVersion || '?'}`).join(', '));
        }
        return parts.join(' | ') || '—';
    };

    return (
        <div>
            <table style={tableStyle}>
                <thead>
                    <tr style={theadStyle}>
                        <th style={thStyle}>Date</th>
                        <th style={thStyle}>Result</th>
                        <th style={thStyle}>Rounds</th>
                        <th style={thStyle}>Duration</th>
                        <th style={thStyle}>Decks</th>
                        <th style={thStyle}>Event Log</th>
                    </tr>
                </thead>
                <tbody>
                    {games.length === 0 ? (
                        <tr><td colSpan={6} style={tdCenterStyle}>No games recorded yet</td></tr>
                    ) : games.map((game, i) => (
                        <tr key={game.gameId || i} style={i % 2 === 0 ? rowEvenStyle : rowOddStyle}>
                            <td style={tdStyle}>{formatDate(game.endedAt)}</td>
                            <td style={{ ...tdStyle, fontWeight: 'bold', color: game.result === 'heroVictory' ? '#28a745' : game.result === 'villainVictory' ? '#dc3545' : '#6c757d' }}>
                                {game.result || '—'}
                            </td>
                            <td style={tdStyle}>{game.rounds || '—'}</td>
                            <td style={tdStyle}>{game.durationMinutes != null ? `${game.durationMinutes} min` : '—'}</td>
                            <td style={{ ...tdStyle, fontSize: '0.75rem' }}>{formatDecks(game)}</td>
                            <td style={tdStyle}>
                                <button
                                    style={linkBtnStyle}
                                    onClick={() => onSelectGame(game.gameId)}
                                >
                                    View Log
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div style={paginationStyle}>
                <button
                    style={pageBtnStyle}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                >
                    ← Prev
                </button>
                <span style={{ color: '#8b949e', padding: '0 12px' }}>Page {page}</span>
                <button
                    style={pageBtnStyle}
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!hasMore}
                >
                    Next →
                </button>
            </div>
        </div>
    );
};

// ---- Event Log Tab ----
const EventLogTab = ({ gameId: initialGameId }) => {
    const [gameId, setGameId] = useState(initialGameId || '');
    const [inputGameId, setInputGameId] = useState(initialGameId || '');
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [eventTypeFilter, setEventTypeFilter] = useState('');

    const loadEvents = useCallback((gid, filter) => {
        if (!gid) return;
        setLoading(true);
        let url = `${API_BASE}/games/${encodeURIComponent(gid)}/events`;
        if (filter) url += `?eventType=${encodeURIComponent(filter)}`;
        fetch(url, { credentials: 'include' })
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then((d) => {
                setEvents(Array.isArray(d) ? d : (d.events || []));
                setLoading(false);
            })
            .catch((e) => { setError(e.message); setLoading(false); });
    }, []);

    useEffect(() => {
        if (initialGameId) loadEvents(initialGameId, eventTypeFilter);
    }, [initialGameId, loadEvents]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = (e) => {
        e.preventDefault();
        setGameId(inputGameId);
        setError(null);
        loadEvents(inputGameId, eventTypeFilter);
    };

    const handleFilterChange = (e) => {
        const val = e.target.value;
        setEventTypeFilter(val);
        if (gameId) loadEvents(gameId, val);
    };

    return (
        <div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
                <input
                    style={inputStyle}
                    type='text'
                    placeholder='Game ID…'
                    value={inputGameId}
                    onChange={(e) => setInputGameId(e.target.value)}
                />
                <button type='submit' style={pageBtnStyle}>Load Events</button>
                <input
                    style={{ ...inputStyle, maxWidth: '180px' }}
                    type='text'
                    placeholder='Filter by eventType…'
                    value={eventTypeFilter}
                    onChange={handleFilterChange}
                />
            </form>

            {loading && <div style={loadingStyle}>Loading events…</div>}
            {error && <div style={errorStyle}>Error: {error}</div>}

            {!loading && events.length === 0 && gameId && (
                <div style={{ color: '#8b949e', padding: '12px' }}>No events found for this game.</div>
            )}

            {events.length > 0 && (
                <table style={tableStyle}>
                    <thead>
                        <tr style={theadStyle}>
                            <th style={thStyle}>Round</th>
                            <th style={thStyle}>Phase</th>
                            <th style={thStyle}>Actor</th>
                            <th style={thStyle}>Event Type</th>
                            <th style={thStyle}>Payload</th>
                            <th style={thStyle}>Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        {events.map((evt, i) => (
                            <tr key={evt._id || i} style={i % 2 === 0 ? rowEvenStyle : rowOddStyle}>
                                <td style={tdStyle}>{evt.round}</td>
                                <td style={tdStyle}>{evt.phase}</td>
                                <td style={tdStyle}>{evt.actorName || evt.actorId || '—'}</td>
                                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.8rem' }}>{evt.eventType}</td>
                                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: '300px', wordBreak: 'break-all' }}>
                                    {evt.payload ? JSON.stringify(evt.payload) : '—'}
                                </td>
                                <td style={{ ...tdStyle, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                    {evt.timestamp ? new Date(evt.timestamp).toLocaleString() : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

// ---- Small helper components ----
const StatCard = ({ label, value }) => (
    <div style={statCardStyle}>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f0f6fc' }}>{value}</div>
        <div style={{ fontSize: '0.8rem', color: '#8b949e', marginTop: '2px' }}>{label}</div>
    </div>
);

// ---- Main StatsPage ----
const StatsPage = () => {
    const user = useSelector((state) => state.auth.user);
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedGameId, setSelectedGameId] = useState(null);

    if (!user?.permissions?.isAdmin) {
        return (
            <div style={pageStyle}>
                <div style={errorStyle}>Access denied: admin role required.</div>
            </div>
        );
    }

    const handleSelectGame = (gameId) => {
        setSelectedGameId(gameId);
        setActiveTab('eventlog');
    };

    return (
        <div style={pageStyle}>
            <h2 style={{ color: '#f0f6fc', marginBottom: '16px' }}>SotMDE Game Statistics</h2>

            <div style={tabBarStyle}>
                {['overview', 'gamelist', 'eventlog'].map((tab) => (
                    <button
                        key={tab}
                        style={activeTab === tab ? activeTabStyle : tabStyle}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab === 'overview' ? 'Overview' : tab === 'gamelist' ? 'Game List' : 'Event Log'}
                    </button>
                ))}
            </div>

            <div style={tabContentStyle}>
                {activeTab === 'overview' && <OverviewTab />}
                {activeTab === 'gamelist' && <GameListTab onSelectGame={handleSelectGame} />}
                {activeTab === 'eventlog' && <EventLogTab gameId={selectedGameId} />}
            </div>
        </div>
    );
};

// ---- Styles ----
const pageStyle = {
    padding: '20px',
    backgroundColor: '#0d1117',
    minHeight: '100vh',
    color: '#f0f6fc',
};

const tabBarStyle = {
    display: 'flex',
    gap: '4px',
    marginBottom: '16px',
    borderBottom: '1px solid #30363d',
    paddingBottom: '8px',
};

const tabStyle = {
    backgroundColor: '#21262d',
    border: '1px solid #30363d',
    color: '#8b949e',
    borderRadius: '4px',
    padding: '6px 16px',
    cursor: 'pointer',
    fontSize: '0.9rem',
};

const activeTabStyle = {
    ...tabStyle,
    backgroundColor: '#388bfd',
    color: '#fff',
    borderColor: '#388bfd',
};

const tabContentStyle = {
    backgroundColor: '#161b22',
    borderRadius: '6px',
    padding: '16px',
    border: '1px solid #30363d',
};

const summaryRowStyle = {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '20px',
};

const statCardStyle = {
    backgroundColor: '#21262d',
    border: '1px solid #30363d',
    borderRadius: '6px',
    padding: '12px 20px',
    minWidth: '120px',
};

const sectionTitleStyle = {
    color: '#8b949e',
    fontSize: '0.9rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginTop: '20px',
    marginBottom: '8px',
};

const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
};

const theadStyle = {
    backgroundColor: '#21262d',
};

const thStyle = {
    padding: '8px 12px',
    textAlign: 'left',
    color: '#8b949e',
    fontWeight: 'normal',
    borderBottom: '1px solid #30363d',
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
};

const tdStyle = {
    padding: '6px 12px',
    color: '#f0f6fc',
    borderBottom: '1px solid #21262d',
};

const tdCenterStyle = {
    ...tdStyle,
    textAlign: 'center',
    color: '#8b949e',
    padding: '20px',
};

const rowEvenStyle = { backgroundColor: '#0d1117' };
const rowOddStyle = { backgroundColor: '#161b22' };

const paginationStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '12px',
};

const pageBtnStyle = {
    backgroundColor: '#21262d',
    border: '1px solid #30363d',
    color: '#f0f6fc',
    borderRadius: '4px',
    padding: '5px 14px',
    cursor: 'pointer',
    fontSize: '0.85rem',
};

const linkBtnStyle = {
    backgroundColor: 'transparent',
    border: '1px solid #30363d',
    color: '#388bfd',
    borderRadius: '4px',
    padding: '3px 10px',
    cursor: 'pointer',
    fontSize: '0.8rem',
};

const loadingStyle = {
    color: '#8b949e',
    padding: '20px',
    textAlign: 'center',
};

const errorStyle = {
    color: '#f85149',
    padding: '12px',
    backgroundColor: '#1c1c1c',
    borderRadius: '4px',
    border: '1px solid #f85149',
};

const inputStyle = {
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    color: '#f0f6fc',
    borderRadius: '4px',
    padding: '5px 10px',
    fontSize: '0.85rem',
    outline: 'none',
    flex: 1,
};

StatsPage.displayName = 'StatsPage';

export default StatsPage;
