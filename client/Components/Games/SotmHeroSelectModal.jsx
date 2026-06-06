/**
 * SotMDE SotmHeroSelectModal.jsx — hero selection modal for the pending game lobby.
 * Fetches /api/sotm/decks?type=hero on mount, greys out already-claimed heroes,
 * and emits addhero / removehero socket events.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Button, Spinner } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { sendSocketMessage } from '../../redux/actions';
import SotmDeckGrid from '../Decks/SotmDeckGrid.jsx';

/**
 * @param {{ onClose: function }} props
 */
const SotmHeroSelectModal = ({ onClose }) => {
    const dispatch = useDispatch();
    const currentGame = useSelector((state) => state.lobby.currentGame);
    const username = useSelector((state) => state.account.user?.username);

    const [heroDecks, setHeroDecks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchHeroes = async () => {
            try {
                const res = await fetch('/api/sotm/decks?type=hero');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                setHeroDecks(await res.json());
            } catch (err) {
                setError('Failed to load hero decks. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchHeroes();
    }, []);

    // Collect all claimed deckIds across all players
    const heroSelection = currentGame?.heroSelection || {};
    const claimedByOthers = Object.entries(heroSelection)
        .filter(([pName]) => pName !== username)
        .flatMap(([, deckIds]) => deckIds);

    // deckIds claimed by ME (to show Remove buttons)
    const myHeroes = heroSelection[username] || [];

    const handleSelect = (deck) => {
        if (myHeroes.includes(deck.id)) {
            // deselect
            dispatch(sendSocketMessage('removehero', { deckId: deck.id }));
        } else {
            dispatch(sendSocketMessage('addhero', { deckId: deck.id }));
        }
    };

    const handleRemove = (deckId) => {
        dispatch(sendSocketMessage('removehero', { deckId }));
    };

    return (
        <Modal show onHide={onClose} size='lg' className='select-deck-modal'>
            <Modal.Header closeButton>
                <Modal.Title>Select Hero</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {loading && (
                    <div className='text-center p-4'>
                        <Spinner animation='border' role='status' />
                        <div className='mt-2'>Loading heroes...</div>
                    </div>
                )}
                {error && <div className='alert alert-danger'>{error}</div>}
                {!loading && !error && (
                    <>
                        {myHeroes.length > 0 && (
                            <div className='mb-3'>
                                <strong>Your heroes:</strong>{' '}
                                {myHeroes.map((deckId) => {
                                    const deck = heroDecks.find((d) => d.id === deckId);
                                    return (
                                        <span
                                            key={deckId}
                                            className='badge bg-primary me-1'
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => handleRemove(deckId)}
                                            title='Click to remove'
                                        >
                                            {deck ? deck.name : deckId} &times;
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                        <SotmDeckGrid
                            decks={heroDecks}
                            onDeckSelected={handleSelect}
                            disabledDeckIds={claimedByOthers}
                        />
                    </>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant='secondary' onClick={onClose}>
                    Done
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

SotmHeroSelectModal.displayName = 'SotmHeroSelectModal';
export default SotmHeroSelectModal;
