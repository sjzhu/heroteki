// SotMDE EnvironmentArea component (Phase 5, Step 5.3).
// Renders the environment play area, deck pile, and trash pile.
// No character card or HP. Play-area cards still show token badges and HP dials.
// Props: { environment: EnvironmentState, isActiveTurn: bool, onAction: fn, isGameOver: bool }
//
// EnvironmentState shape (from server getState()):
//   { deckId, deck: SotmCardSummary[], trash: SotmCardSummary[], playArea: SotmCardSummary[], auxiliaryZones: [] }

import React, { useState } from 'react';
import HpDial from './HpDial';
import CardContextMenu from './CardContextMenu';
import AuxZone from './AuxZone';
import DeckSearchModal from './DeckSearchModal';

// Token badge renderer
const TokenBadges = ({ tokens }) => {
    if (!tokens || Object.keys(tokens).length === 0) return null;
    return (
        <span style={{ display: 'inline-flex', gap: '3px', flexWrap: 'wrap' }}>
            {Object.entries(tokens).map(([label, count]) => (
                <span
                    key={label}
                    style={{
                        backgroundColor: '#6f42c1',
                        color: '#fff',
                        borderRadius: '3px',
                        padding: '1px 5px',
                        fontSize: '0.7rem',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {label} ×{count}
                </span>
            ))}
        </span>
    );
};

/**
 * @param {{
 *   environment: object,
 *   isActiveTurn: boolean,
 *   onAction: (event: string, payload: object) => void,
 *   isGameOver?: boolean
 * }} props
 */
const EnvironmentArea = ({
    environment,
    isActiveTurn,
    onAction,
    isGameOver = false,
    allHeroes = [],
    playAreaTargets = []
}) => {
    const [contextMenu, setContextMenu] = useState(null);
    const [deckSearchOpen, setDeckSearchOpen] = useState(false);

    if (!environment) {
        return (
            <div style={areaStyle(isActiveTurn)}>
                <span style={{ color: '#6c757d', fontSize: '0.85rem' }}>No environment loaded</span>
            </div>
        );
    }

    const controllerId = environment.deckId || 'environment';
    const deck = environment.deck || [];
    const trash = environment.trash || [];
    const playArea = environment.playArea || [];
    const auxZones = environment.auxiliaryZones || [];

    const handleContextMenu = (e, card, zone) => {
        if (isGameOver) return;
        e.preventDefault();
        setContextMenu({ card, zone, x: e.clientX, y: e.clientY });
    };

    const handleAction = (event, payload) => {
        onAction(event, payload);
        setContextMenu(null);
    };

    return (
        <div style={areaStyle(isActiveTurn)}>
            <div style={headerStyle}>
                <span style={titleStyle}>ENVIRONMENT</span>
                {environment.deckId && <span style={deckIdStyle}>{environment.deckId}</span>}
                {isActiveTurn && <span style={activeBadgeStyle}>ACTIVE</span>}
            </div>

            <div style={contentRowStyle}>
                {/* Play Area */}
                <div style={playAreaStyle}>
                    <div style={zoneHeaderStyle}>Play Area ({playArea.length})</div>
                    <div style={cardRowStyle}>
                        {playArea.map((card) => (
                            <div
                                key={card.id}
                                style={playCardStyle}
                                onContextMenu={(e) => handleContextMenu(e, card, 'playArea')}
                                title={`${card.name} — right-click for options`}
                            >
                                {card.imageUrl ? (
                                    <img
                                        src={card.imageUrl}
                                        alt={card.name}
                                        style={{
                                            width: '56px',
                                            height: '78px',
                                            objectFit: 'cover',
                                            borderRadius: '3px'
                                        }}
                                    />
                                ) : (
                                    <div style={cardPlaceholderStyle}>{card.name}</div>
                                )}
                                <div style={{ padding: '2px 4px' }}>
                                    <div style={{ fontSize: '0.65rem', color: '#f8f9fa' }}>
                                        {card.name}
                                    </div>
                                    {card.maxHp !== null && (
                                        <HpDial
                                            hp={card.hp}
                                            maxHp={card.maxHp}
                                            onAdjust={(delta) =>
                                                onAction('modifyCard', {
                                                    cardId: card.id,
                                                    controllerId,
                                                    updates: { hp: (card.hp || 0) + delta }
                                                })
                                            }
                                            disabled={isGameOver}
                                        />
                                    )}
                                    <TokenBadges tokens={card.tokens} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Deck + Trash */}
                <div style={pileColumnStyle}>
                    <div style={pileBoxStyle}>
                        <div style={zoneHeaderStyle}>Deck ({deck.length})</div>
                        <button
                            style={actionBtnStyle}
                            onClick={() => !isGameOver && onAction('playTopCard', { controllerId })}
                            disabled={isGameOver || deck.length === 0}
                        >
                            Play Top
                        </button>
                        <button
                            style={actionBtnStyle}
                            onClick={() =>
                                !isGameOver &&
                                onAction('shuffleDeck', { controllerId, zoneId: 'deck' })
                            }
                            disabled={isGameOver}
                        >
                            Shuffle
                        </button>
                        <button
                            style={actionBtnStyle}
                            onClick={() => setDeckSearchOpen(true)}
                            disabled={isGameOver}
                        >
                            Search
                        </button>
                    </div>
                    <div style={pileBoxStyle}>
                        <div style={zoneHeaderStyle}>Trash ({trash.length})</div>
                    </div>
                </div>
            </div>

            {/* Auxiliary Zones */}
            {auxZones.map((zone) => (
                <AuxZone
                    key={zone.id}
                    zone={zone}
                    label={zone.name}
                    controllerId={controllerId}
                    onAction={onAction}
                />
            ))}

            {/* Context Menu */}
            {contextMenu && (
                <CardContextMenu
                    card={contextMenu.card}
                    zone={contextMenu.zone}
                    controllerId={controllerId}
                    isVillain={false}
                    playAreaTargets={playAreaTargets.filter((t) => t.deckId !== 'environment')}
                    onAction={handleAction}
                    onClose={() => setContextMenu(null)}
                    position={{ x: contextMenu.x, y: contextMenu.y }}
                />
            )}

            {/* Deck Search Modal */}
            <DeckSearchModal
                show={deckSearchOpen}
                deckCards={deck}
                controllerId={controllerId}
                zoneId='deck'
                heroes={allHeroes}
                onMoveToHand={(cardId, cid, zoneId) =>
                    onAction('moveCard', {
                        cardId,
                        fromZone: zoneId,
                        toZone: 'hand',
                        controllerId: cid
                    })
                }
                onPlay={(cardId, cid, zoneId) =>
                    onAction('moveCard', {
                        cardId,
                        fromZone: zoneId,
                        toZone: 'playArea',
                        controllerId: cid
                    })
                }
                onClose={() => setDeckSearchOpen(false)}
            />
        </div>
    );
};

// Styles
const areaStyle = (isActive) => ({
    border: `2px solid ${isActive ? '#20c997' : '#343a40'}`,
    borderRadius: '6px',
    padding: '8px',
    backgroundColor: '#212529',
    marginBottom: '4px'
});

const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px'
};

const titleStyle = {
    fontSize: '0.7rem',
    fontWeight: 'bold',
    color: '#adb5bd',
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
};

const deckIdStyle = {
    fontSize: '0.8rem',
    color: '#f8f9fa'
};

const activeBadgeStyle = {
    backgroundColor: '#20c997',
    color: '#000',
    borderRadius: '3px',
    padding: '1px 6px',
    fontSize: '0.7rem',
    fontWeight: 'bold'
};

const contentRowStyle = {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
    flexWrap: 'wrap'
};

const playAreaStyle = {
    flex: 1,
    minWidth: '120px'
};

const cardRowStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px'
};

const playCardStyle = {
    cursor: 'context-menu',
    border: '1px solid #495057',
    borderRadius: '4px',
    backgroundColor: '#1a1d20',
    width: '72px'
};

const cardPlaceholderStyle = {
    width: '100%',
    height: '80px',
    backgroundColor: '#343a40',
    borderRadius: '3px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.6rem',
    color: '#adb5bd',
    textAlign: 'center',
    padding: '4px'
};

const pileColumnStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: '80px'
};

const pileBoxStyle = {
    border: '1px solid #495057',
    borderRadius: '4px',
    padding: '6px',
    backgroundColor: '#1a1d20'
};

const zoneHeaderStyle = {
    fontSize: '0.7rem',
    color: '#adb5bd',
    marginBottom: '4px'
};

const actionBtnStyle = {
    display: 'block',
    width: '100%',
    backgroundColor: '#343a40',
    border: 'none',
    color: '#f8f9fa',
    borderRadius: '3px',
    padding: '3px 0',
    cursor: 'pointer',
    fontSize: '0.7rem',
    marginBottom: '2px'
};

export default EnvironmentArea;
