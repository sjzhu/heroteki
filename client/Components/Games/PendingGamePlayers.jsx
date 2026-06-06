/**
 * SotMDE PendingGamePlayers.jsx — player rows in the pending game lobby.
 * Replaced Ashes deck-selection UI with SotMDE hero selection badges and
 * the [+ Add Hero] button that opens SotmHeroSelectModal.
 * Removed: Chimera/solo controls, DeckStatus, selectdeck socket message.
 */
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { sendSocketMessage } from '../../redux/actions';
import { Button } from 'react-bootstrap';

import './PendingGamePlayer.scss';
import PlayerName from '../Site/PlayerName';
import SotmHeroSelectModal from './SotmHeroSelectModal';

/**
 * @param {{ currentGame: object, user: object }} props
 */
const PendingGamePlayers = ({ currentGame, user }) => {
    const [showModal, setShowModal] = useState(false);
    const dispatch = useDispatch();

    const userIsSpectator = !!currentGame?.spectators?.find((s) => s.name === user?.username);
    const heroSelection = currentGame?.heroSelection || {};

    return (
        <div className='pending-game-players'>
            <h3>Players:</h3>
            {Object.values(currentGame.players).map((player) => {
                const isMe = player && player.name === user?.username;
                const myHeroIds = heroSelection[player.name] || [];

                return (
                    <div className='player-row mb-2' key={player.name}>
                        <div className='form-row' style={{ flexWrap: 'wrap', gap: '8px' }}>
                            <PlayerName player={player} />

                            {/* Hero badges */}
                            {myHeroIds.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                                    {myHeroIds.map((deckId) => (
                                        <span key={deckId} className='badge bg-info text-dark'>
                                            {deckId}
                                            {isMe && !userIsSpectator && (
                                                <button
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        padding: '0 0 0 4px',
                                                        cursor: 'pointer',
                                                        color: 'inherit',
                                                        fontWeight: 'bold'
                                                    }}
                                                    onClick={() =>
                                                        dispatch(
                                                            sendSocketMessage('removehero', {
                                                                deckId
                                                            })
                                                        )
                                                    }
                                                    title='Remove hero'
                                                >
                                                    &times;
                                                </button>
                                            )}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                isMe && !userIsSpectator && (
                                    <span style={{ color: '#888', fontSize: '0.9em' }}>
                                        No heroes selected
                                    </span>
                                )
                            )}

                            {/* Add hero button — only for this player */}
                            {isMe && !userIsSpectator && (
                                <Button
                                    size='sm'
                                    variant='outline-primary'
                                    onClick={() => setShowModal(true)}
                                >
                                    + Add Hero
                                </Button>
                            )}
                        </div>
                    </div>
                );
            })}

            {showModal && (
                <SotmHeroSelectModal onClose={() => setShowModal(false)} />
            )}
        </div>
    );
};

export default PendingGamePlayers;
