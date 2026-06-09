/**
 * SotMDE SotmDeckGrid.jsx — thin adaptation of DeckGrid for SotMDE decks.
 * Renders a character card image instead of the Ashes Phoenixborn div.
 * Reuses the same grid layout, click handler, and selection highlight.
 */
import classNames from 'classnames';
import React, { useState } from 'react';
import './DeckGrid.scss';

/**
 * @param {{ decks: object[], onDeckSelected: function, disabledDeckIds: string[] }} props
 * disabledDeckIds — list of deckIds already claimed by any player; shown greyed out.
 */
const SotmDeckGrid = ({ decks = [], onDeckSelected, disabledDeckIds = [] }) => {
    const [selectedDeckId, setSelectedDeckId] = useState(null);

    const doClick = (deck) => {
        if (disabledDeckIds.includes(deck.id)) return;
        setSelectedDeckId(deck.id);
        if (onDeckSelected) onDeckSelected(deck);
    };

    return (
        <div className='deck-grid'>
            {decks.map((d) => {
                const isSelected = selectedDeckId === d.id;
                const isDisabled = disabledDeckIds.includes(d.id);
                const cardClasses = classNames('deckgrid-card', {
                    'selected-deck': isSelected,
                    'deck-disabled': isDisabled
                });
                return (
                    <div
                        key={d.id}
                        className={cardClasses}
                        onClick={() => doClick(d)}
                        title={isDisabled ? 'Already claimed by another player' : d.name}
                        style={isDisabled ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
                    >
                        <div className='decklist-entry-image'>
                            {d.characterCard?.imageUrl ? (
                                <img
                                    src={d.characterCard.imageUrl}
                                    alt={d.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: '#333',
                                        color: '#ccc',
                                        fontSize: '12px',
                                        textAlign: 'center',
                                        padding: '4px'
                                    }}
                                >
                                    {d.name}
                                </div>
                            )}
                        </div>
                        <div className='deckgrid-entry'>
                            <div>
                                <button className='deckgrid-title' tabIndex={0}>
                                    {d.name}
                                </button>
                                {d.version && (
                                    <span
                                        className='badge bg-secondary ms-1'
                                        style={{ fontSize: '0.7em' }}
                                    >
                                        v{d.version}
                                    </span>
                                )}
                                {isDisabled && (
                                    <div style={{ fontSize: '0.75em', color: '#888' }}>Claimed</div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

SotmDeckGrid.displayName = 'SotmDeckGrid';
export default SotmDeckGrid;
