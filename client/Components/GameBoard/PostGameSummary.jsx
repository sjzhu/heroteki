// SotMDE PostGameSummary component (Phase 5, Step 5.11).
// Shown when isGameOver: true in Redux state.
// Displays result, decks, round count, final HP values, tags, and notes.

import React from 'react';
import { Badge, Button, Card, Table } from 'react-bootstrap';

/**
 * @param {{
 *   currentGame: object,
 *   onReturnToLobby: () => void
 * }} props
 */
const PostGameSummary = ({ currentGame, onReturnToLobby }) => {
    if (!currentGame) return null;

    const { round, H, heroes = [], villain, environment, chatLog = [] } = currentGame;

    // Try to derive result from chatLog system messages (fallback: unknown)
    const resultMsg = chatLog
        .slice()
        .reverse()
        .find((m) => m && m.text && (m.text.includes('heroVictory') || m.text.includes('villainVictory')));
    const result = resultMsg
        ? resultMsg.text.includes('heroVictory')
            ? 'Heroes Won'
            : 'Villain Won'
        : 'Game Over';

    const containerStyle = {
        backgroundColor: '#1a1d20',
        border: '2px solid #495057',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '700px',
        margin: '0 auto',
        color: '#f8f9fa',
    };

    const sectionStyle = {
        marginBottom: '16px',
    };

    const labelStyle = {
        fontSize: '0.75rem',
        color: '#adb5bd',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '4px',
    };

    return (
        <div style={containerStyle}>
            <h4 style={{ marginBottom: '20px', color: '#f8f9fa' }}>Game Over — Summary</h4>

            <div style={{ ...sectionStyle, display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                    <div style={labelStyle}>Result</div>
                    <Badge
                        bg={result === 'Heroes Won' ? 'success' : result === 'Villain Won' ? 'danger' : 'secondary'}
                        style={{ fontSize: '0.9rem', padding: '6px 12px' }}
                    >
                        {result}
                    </Badge>
                </div>
                <div>
                    <div style={labelStyle}>Rounds</div>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{round}</span>
                </div>
                <div>
                    <div style={labelStyle}>H Value</div>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{H}</span>
                </div>
            </div>

            {/* Villain */}
            {villain && (
                <div style={sectionStyle}>
                    <div style={labelStyle}>Villain</div>
                    <Card bg='dark' text='light' style={{ marginBottom: '6px' }}>
                        <Card.Body style={{ padding: '8px 12px' }}>
                            <strong>{villain.deckId}</strong>
                            {villain.deckVersion && (
                                <Badge bg='secondary' className='ms-2' style={{ fontSize: '0.7rem' }}>
                                    v{villain.deckVersion}
                                </Badge>
                            )}
                            {villain.hp !== undefined && villain.hp !== null && (
                                <span className='ms-3' style={{ fontSize: '0.85rem', color: '#adb5bd' }}>
                                    Final HP: {villain.hp} / {villain.maxHp}
                                </span>
                            )}
                            {villain.isFlipped && (
                                <Badge bg='warning' text='dark' className='ms-2' style={{ fontSize: '0.7rem' }}>
                                    FLIPPED
                                </Badge>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            )}

            {/* Environment */}
            {environment && (
                <div style={sectionStyle}>
                    <div style={labelStyle}>Environment</div>
                    <Card bg='dark' text='light' style={{ marginBottom: '6px' }}>
                        <Card.Body style={{ padding: '8px 12px' }}>
                            <strong>{environment.deckId}</strong>
                            {environment.deckVersion && (
                                <Badge bg='secondary' className='ms-2' style={{ fontSize: '0.7rem' }}>
                                    v{environment.deckVersion}
                                </Badge>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            )}

            {/* Heroes */}
            {heroes.length > 0 && (
                <div style={sectionStyle}>
                    <div style={labelStyle}>Heroes</div>
                    <Table variant='dark' size='sm' style={{ marginBottom: 0 }}>
                        <thead>
                            <tr>
                                <th>Hero</th>
                                <th>Controller</th>
                                <th>Final HP</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {heroes.map((hero) => (
                                <tr key={hero.id || hero.deckId}>
                                    <td>
                                        {hero.name || hero.deckId}
                                        {hero.deckVersion && (
                                            <Badge bg='secondary' className='ms-1' style={{ fontSize: '0.65rem' }}>
                                                v{hero.deckVersion}
                                            </Badge>
                                        )}
                                    </td>
                                    <td style={{ fontSize: '0.8rem', color: '#adb5bd' }}>
                                        {hero.controllerPlayerId}
                                    </td>
                                    <td style={{ fontSize: '0.85rem' }}>
                                        {hero.hp !== undefined && hero.hp !== null
                                            ? `${hero.hp} / ${hero.maxHp}`
                                            : '—'}
                                    </td>
                                    <td>
                                        {hero.isIncapacitated ? (
                                            <Badge bg='danger' style={{ fontSize: '0.7rem' }}>Incapacitated</Badge>
                                        ) : (
                                            <Badge bg='success' style={{ fontSize: '0.7rem' }}>Active</Badge>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            )}

            <div style={{ marginTop: '24px', display: 'flex', gap: '10px' }}>
                <Button variant='primary' onClick={onReturnToLobby}>
                    Return to Lobby
                </Button>
            </div>
        </div>
    );
};

export default PostGameSummary;
