/**
 * SotMDE Card Library page (replaces Ashes Decks page).
 * Fetches cards from /api/sotm/cards with filtering by source and deck.
 * Official and manual cards visible to all authenticated users.
 * User-source cards visible only to their owner (enforced server-side).
 *
 * Route: /decks  (kept at /decks to avoid AppRoutes.jsx changes)
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Col, Form, Row, Badge, Spinner, Button } from 'react-bootstrap';
import Panel from '../Components/Site/Panel';
import './Decks.scss';

const CardLibrary = () => {
    const user = useSelector((state) => state.account.user);

    const [cards, setCards] = useState([]);
    const [decks, setDecks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [filterDeck, setFilterDeck] = useState('');
    const [filterSource, setFilterSource] = useState('');
    const [filterName, setFilterName] = useState('');

    // Load available decks for filter dropdown
    useEffect(() => {
        const fetchDecks = async () => {
            try {
                const res = await fetch('/api/sotm/decks');
                if (res.ok) setDecks(await res.json());
            } catch (_) {
                // non-fatal
            }
        };
        fetchDecks();
    }, []);

    const fetchCards = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (filterDeck) params.set('deckId', filterDeck);
            if (filterSource) params.set('source', filterSource);
            const res = await fetch(`/api/sotm/cards?${params.toString()}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setCards(data);
        } catch (err) {
            setError('Failed to load cards. The card library API may not be available yet.');
            setCards([]);
        } finally {
            setLoading(false);
        }
    }, [filterDeck, filterSource]);

    useEffect(() => {
        fetchCards();
    }, [fetchCards]);

    const filteredCards = filterName
        ? cards.filter((c) => c.name?.toLowerCase().includes(filterName.toLowerCase()))
        : cards;

    const sourceColor = (source) => {
        switch (source) {
            case 'official': return 'primary';
            case 'manual': return 'warning';
            case 'user': return 'secondary';
            default: return 'light';
        }
    };

    return (
        <div className='decks-container full-height'>
            <div className='lobby-card'>
                <h2>Card Library</h2>

                {/* Filters */}
                <Row className='mb-3'>
                    <Col md={4}>
                        <Form.Control
                            type='text'
                            placeholder='Search by name...'
                            value={filterName}
                            onChange={(e) => setFilterName(e.target.value)}
                        />
                    </Col>
                    <Col md={3}>
                        <Form.Select value={filterDeck} onChange={(e) => setFilterDeck(e.target.value)}>
                            <option value=''>All Decks</option>
                            {decks.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name} ({d.deckType})
                                </option>
                            ))}
                        </Form.Select>
                    </Col>
                    <Col md={3}>
                        <Form.Select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
                            <option value=''>All Sources</option>
                            <option value='official'>Official</option>
                            <option value='manual'>Manual (admin)</option>
                            {user && <option value='user'>My Uploads</option>}
                        </Form.Select>
                    </Col>
                    <Col md={2}>
                        <Button variant='outline-secondary' onClick={fetchCards} disabled={loading}>
                            Refresh
                        </Button>
                    </Col>
                </Row>

                {loading && (
                    <div className='text-center p-4'>
                        <Spinner animation='border' />
                        <div className='mt-2'>Loading cards...</div>
                    </div>
                )}

                {error && (
                    <div className='alert alert-warning'>{error}</div>
                )}

                {!loading && !error && filteredCards.length === 0 && (
                    <div className='text-muted p-3'>
                        No cards found. Use the import script to load official cards, or{' '}
                        <a href='/decks/upload'>upload a deck</a>.
                    </div>
                )}

                {!loading && filteredCards.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                        <table className='table table-dark table-striped table-hover'>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Type</th>
                                    <th>Deck</th>
                                    <th>Keywords</th>
                                    <th>HP</th>
                                    <th>Version</th>
                                    <th>Source</th>
                                    {user?.permissions?.isAdmin && <th>Image</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCards.map((card) => (
                                    <tr key={card.id}>
                                        <td>
                                            {card.imageUrl ? (
                                                <a
                                                    href={card.imageUrl}
                                                    target='_blank'
                                                    rel='noopener noreferrer'
                                                    title='View card image'
                                                >
                                                    {card.name}
                                                </a>
                                            ) : (
                                                card.name
                                            )}
                                        </td>
                                        <td>
                                            <code style={{ fontSize: '0.8em' }}>{card.type}</code>
                                        </td>
                                        <td>{card.deckId}</td>
                                        <td>
                                            {(card.keywords || []).map((kw) => (
                                                <Badge key={kw} bg='info' className='me-1' style={{ fontSize: '0.75em' }}>
                                                    {kw}
                                                </Badge>
                                            ))}
                                        </td>
                                        <td>{card.hp ?? '—'}</td>
                                        <td>
                                            {card.version && (
                                                <Badge bg='secondary' style={{ fontSize: '0.75em' }}>
                                                    v{card.version}
                                                </Badge>
                                            )}
                                        </td>
                                        <td>
                                            <Badge bg={sourceColor(card.source)} style={{ fontSize: '0.75em' }}>
                                                {card.source}
                                            </Badge>
                                        </td>
                                        {user?.permissions?.isAdmin && (
                                            <td>
                                                {card.imageUrl ? (
                                                    <a href='/admin/upload-image' style={{ fontSize: '0.8em' }}>
                                                        Replace
                                                    </a>
                                                ) : (
                                                    <a href='/admin/upload-image' style={{ fontSize: '0.8em' }}>
                                                        Upload
                                                    </a>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

CardLibrary.displayName = 'CardLibrary';
export default CardLibrary;
