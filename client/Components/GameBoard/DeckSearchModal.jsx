// SotMDE DeckSearchModal component (Phase 5, Step 5.7).
// Triggered by "Search Deck" button on any deck pile.
// Displays all cards in the deck as a scrollable list, in true deck order
// (position 1 = top of deck = next card drawn).
// Note: server currently broadcasts deck contents to all players — known limitation from Phase 3.

import React, { useState } from 'react';
import { Modal, Button, Form, ListGroup, Badge, Dropdown, DropdownButton } from 'react-bootstrap';

/**
 * `heroes` lists the hand destinations the player may move a card to
 * ({ deckId, name }). Empty list hides the Move to Hand option (the server
 * rejects hand moves for controllers without a hand zone).
 *
 * @param {{
 *   show: boolean,
 *   deckCards: object[],
 *   controllerId: string,
 *   zoneId: string,
 *   heroes?: { deckId: string, name: string }[],
 *   onMoveToHand: (cardId: string, destControllerId: string, zoneId: string) => void,
 *   onPlay: (cardId: string, controllerId: string, zoneId: string) => void,
 *   onClose: () => void
 * }} props
 */
const DeckSearchModal = ({
    show,
    deckCards = [],
    controllerId,
    zoneId = 'deck',
    heroes = [],
    onMoveToHand,
    onPlay,
    onClose
}) => {
    const [selectedCardId, setSelectedCardId] = useState(null);
    const [filter, setFilter] = useState('');

    // Attach 1-based deck position before filtering so positions stay
    // meaningful (and the TOP badge stays on the real top card) while filtered.
    const filteredCards = deckCards
        .map((card, index) => ({ card, position: index + 1 }))
        .filter(({ card }) => {
            if (!filter) return true;
            const q = filter.toLowerCase();
            return (
                (card.name && card.name.toLowerCase().includes(q)) ||
                (card.type && card.type.toLowerCase().includes(q)) ||
                (card.keywords && card.keywords.some((k) => k.toLowerCase().includes(q)))
            );
        });

    const handleMoveToHand = (destControllerId) => {
        if (selectedCardId) {
            onMoveToHand(selectedCardId, destControllerId, zoneId);
            onClose();
        }
    };

    const handlePlay = () => {
        if (selectedCardId) {
            onPlay(selectedCardId, controllerId, zoneId);
            onClose();
        }
    };

    return (
        <Modal show={show} onHide={onClose} size='lg' scrollable>
            <Modal.Header closeButton>
                <Modal.Title>Search Deck</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div
                    style={{
                        backgroundColor: '#fff3cd',
                        border: '1px solid #ffc107',
                        borderRadius: '4px',
                        padding: '6px 10px',
                        marginBottom: '10px',
                        fontSize: '0.8rem',
                        color: '#664d03'
                    }}
                >
                    Note: Deck contents are currently visible to all players (known Phase 3
                    limitation).
                </div>
                <div className='text-muted' style={{ fontSize: '0.8rem', marginBottom: '6px' }}>
                    Cards are shown in deck order — #1 is the top of the deck (next card drawn).
                </div>
                <Form.Control
                    type='text'
                    placeholder='Filter by name, type, or keyword…'
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className='mb-2'
                />
                <ListGroup style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {filteredCards.length === 0 && (
                        <ListGroup.Item className='text-muted'>No cards found.</ListGroup.Item>
                    )}
                    {filteredCards.map(({ card, position }) => (
                        <ListGroup.Item
                            key={card.id}
                            action
                            active={selectedCardId === card.id}
                            onClick={() =>
                                setSelectedCardId(card.id === selectedCardId ? null : card.id)
                            }
                            style={{ cursor: 'pointer' }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <span>
                                    <span
                                        className='text-muted me-2'
                                        style={{
                                            fontSize: '0.8rem',
                                            display: 'inline-block',
                                            minWidth: '2.2em',
                                            textAlign: 'right'
                                        }}
                                    >
                                        #{position}
                                    </span>
                                    <strong>{card.name}</strong>
                                    {position === 1 && (
                                        <Badge bg='info' className='ms-2'>
                                            TOP
                                        </Badge>
                                    )}
                                    {card.type && (
                                        <span
                                            className='text-muted ms-2'
                                            style={{ fontSize: '0.8rem' }}
                                        >
                                            {card.type}
                                        </span>
                                    )}
                                </span>
                                {card.keywords && card.keywords.length > 0 && (
                                    <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                                        {card.keywords.join(', ')}
                                    </span>
                                )}
                            </div>
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            </Modal.Body>
            <Modal.Footer>
                <Button variant='success' disabled={!selectedCardId} onClick={handlePlay}>
                    Play
                </Button>
                {heroes.length === 1 && (
                    <Button
                        variant='primary'
                        disabled={!selectedCardId}
                        onClick={() => handleMoveToHand(heroes[0].deckId)}
                    >
                        Move to Hand
                    </Button>
                )}
                {heroes.length > 1 && (
                    <DropdownButton
                        drop='up'
                        variant='primary'
                        title='Move to Hand of…'
                        disabled={!selectedCardId}
                    >
                        {heroes.map((h) => (
                            <Dropdown.Item
                                key={h.deckId}
                                onClick={() => handleMoveToHand(h.deckId)}
                            >
                                {h.name || h.deckId}
                            </Dropdown.Item>
                        ))}
                    </DropdownButton>
                )}
                <Button variant='secondary' onClick={onClose}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default DeckSearchModal;
