// SotMDE DeckSearchModal component (Phase 5, Step 5.7).
// Triggered by "Search Deck" button on any deck pile.
// Displays all cards in the deck as a scrollable list.
// Note: server currently broadcasts deck contents to all players — known limitation from Phase 3.

import React, { useState } from 'react';
import { Modal, Button, Form, ListGroup } from 'react-bootstrap';

/**
 * @param {{
 *   show: boolean,
 *   deckCards: object[],
 *   controllerId: string,
 *   zoneId: string,
 *   onMoveToHand: (cardId: string, controllerId: string) => void,
 *   onClose: () => void
 * }} props
 */
const DeckSearchModal = ({ show, deckCards = [], controllerId, zoneId = 'deck', onMoveToHand, onClose }) => {
    const [selectedCardId, setSelectedCardId] = useState(null);
    const [filter, setFilter] = useState('');

    const filteredCards = deckCards.filter((card) => {
        if (!filter) return true;
        const q = filter.toLowerCase();
        return (
            (card.name && card.name.toLowerCase().includes(q)) ||
            (card.type && card.type.toLowerCase().includes(q)) ||
            (card.keywords && card.keywords.some((k) => k.toLowerCase().includes(q)))
        );
    });

    const handleMoveToHand = () => {
        if (selectedCardId) {
            onMoveToHand(selectedCardId, controllerId, zoneId);
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
                        color: '#664d03',
                    }}
                >
                    Note: Deck contents are currently visible to all players (known Phase 3 limitation).
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
                    {filteredCards.map((card) => (
                        <ListGroup.Item
                            key={card.id}
                            action
                            active={selectedCardId === card.id}
                            onClick={() => setSelectedCardId(card.id === selectedCardId ? null : card.id)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>
                                    <strong>{card.name}</strong>
                                    {card.type && (
                                        <span className='text-muted ms-2' style={{ fontSize: '0.8rem' }}>
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
                <Button
                    variant='primary'
                    disabled={!selectedCardId}
                    onClick={handleMoveToHand}
                >
                    Move to Hand
                </Button>
                <Button variant='secondary' onClick={onClose}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default DeckSearchModal;
