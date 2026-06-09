// SotMDE HeroArea component (Phase 5, Step 5.4).
// One column per hero. Active hero column highlighted with coloured border.
// Props: { hero: HeroState, isMe: bool, isActiveTurn: bool, onAction: fn, isGameOver: bool }
//
// HeroState shape (from server getState()):
//   { id, name, deckId, controllerPlayerId, hand: [{faceDown:true}|SotmCardSummary],
//     deck: SotmCardSummary[], trash: SotmCardSummary[], playArea: SotmCardSummary[],
//     characterCard: SotmCardSummary, auxiliaryZones: [], hp, maxHp, isIncapacitated }

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
 *   hero: object,
 *   isMe: boolean,
 *   isActiveTurn: boolean,
 *   onAction: (event: string, payload: object) => void,
 *   isGameOver?: boolean
 * }} props
 */
const HeroArea = ({ hero, isMe, isActiveTurn, onAction, isGameOver = false }) => {
    const [contextMenu, setContextMenu] = useState(null);
    const [deckSearchOpen, setDeckSearchOpen] = useState(false);

    if (!hero) return null;

    const controllerId = hero.deckId;
    const hand = hero.hand || [];
    const deck = hero.deck || [];
    const trash = hero.trash || [];
    const playArea = hero.playArea || [];
    const auxZones = hero.auxiliaryZones || [];
    const charCard = hero.characterCard;

    const handleContextMenu = (e, card, zone) => {
        if (isGameOver) return;
        e.preventDefault();
        setContextMenu({ card, zone, x: e.clientX, y: e.clientY });
    };

    const handleAction = (event, payload) => {
        onAction(event, payload);
        setContextMenu(null);
    };

    const handlePlayCard = (cardId) => {
        if (!isMe || !isActiveTurn || isGameOver) return;
        onAction('playCard', { cardId });
    };

    const borderColor = isActiveTurn ? '#0d6efd' : hero.isIncapacitated ? '#6c757d' : '#343a40';

    return (
        <div style={areaStyle(borderColor)}>
            <div style={headerStyle}>
                <span style={titleStyle}>HERO</span>
                <span style={nameStyle}>{hero.name || hero.deckId}</span>
                {isMe && <span style={meBadgeStyle}>YOU</span>}
                {isActiveTurn && <span style={activeBadgeStyle}>ACTIVE</span>}
                {hero.isIncapacitated && <span style={incapBadgeStyle}>INCAP</span>}
            </div>

            <div style={contentColStyle}>
                {/* Character Card */}
                {charCard && (
                    <div style={charRowStyle}>
                        <div
                            style={{ ...charCardStyle, opacity: hero.isIncapacitated ? 0.5 : 1 }}
                            onContextMenu={(e) => handleContextMenu(e, charCard, 'character')}
                            title='Right-click for options'
                        >
                            {charCard.imageUrl ? (
                                <img
                                    src={charCard.imageUrl}
                                    alt={charCard.name}
                                    style={{
                                        width: '60px',
                                        height: '84px',
                                        objectFit: 'cover',
                                        borderRadius: '3px'
                                    }}
                                />
                            ) : (
                                <div style={cardPlaceholderStyle}>{charCard.name}</div>
                            )}
                            {hero.isIncapacitated && (
                                <div style={incapOverlayStyle}>INCAPACITATED</div>
                            )}
                        </div>
                        <div style={{ flex: 1, paddingLeft: '6px' }}>
                            <div
                                style={{
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    color: '#f8f9fa',
                                    marginBottom: '4px'
                                }}
                            >
                                {charCard.name}
                            </div>
                            <HpDial
                                hp={charCard.hp !== undefined ? charCard.hp : hero.hp}
                                maxHp={charCard.maxHp !== undefined ? charCard.maxHp : hero.maxHp}
                                onAdjust={(delta) => onAction('adjustHp', { controllerId, delta })}
                                isIncapacitated={hero.isIncapacitated}
                                disabled={isGameOver}
                            />
                            <div style={{ marginTop: '4px' }}>
                                <TokenBadges tokens={charCard.tokens} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Play Area */}
                <div style={{ marginBottom: '6px' }}>
                    <div style={zoneHeaderStyle}>Play Area ({playArea.length})</div>
                    <div style={cardRowStyle}>
                        {playArea.map((card) => (
                            <div
                                key={card.id}
                                style={{ ...playCardStyle, opacity: isGameOver ? 0.6 : 1 }}
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

                {/* Hand */}
                <div style={{ marginBottom: '6px' }}>
                    <div style={zoneHeaderStyle}>
                        Hand ({hand.length})
                        {isMe && isActiveTurn && !isGameOver && (
                            <span
                                style={{ marginLeft: '6px', fontSize: '0.65rem', color: '#0d6efd' }}
                            >
                                Click to play
                            </span>
                        )}
                    </div>
                    <div style={cardRowStyle}>
                        {hand.map((card, idx) => {
                            if (card.faceDown) {
                                // Show card back for other players' cards
                                return (
                                    <div
                                        key={idx}
                                        style={faceDownCardStyle}
                                        title='Card (face down)'
                                    >
                                        <div style={cardBackStyle}></div>
                                    </div>
                                );
                            }
                            return (
                                <div
                                    key={card.id}
                                    style={{
                                        ...handCardStyle,
                                        cursor:
                                            isMe && isActiveTurn && !isGameOver
                                                ? 'pointer'
                                                : 'context-menu',
                                        opacity: isGameOver ? 0.6 : 1
                                    }}
                                    onClick={() => handlePlayCard(card.id)}
                                    onContextMenu={(e) => handleContextMenu(e, card, 'hand')}
                                    title={
                                        isMe && isActiveTurn
                                            ? `${card.name} — click to play, right-click for options`
                                            : card.name
                                    }
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
                                        {card.keywords && card.keywords.length > 0 && (
                                            <div style={{ fontSize: '0.6rem', color: '#adb5bd' }}>
                                                {card.keywords.join(', ')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Deck + Trash row */}
                <div style={pileRowStyle}>
                    <div style={pileBoxStyle}>
                        <div style={zoneHeaderStyle}>Deck ({deck.length})</div>
                        <button
                            style={actionBtnStyle}
                            onClick={() =>
                                !isGameOver &&
                                onAction('drawCard', { heroId: controllerId, count: 1 })
                            }
                            disabled={isGameOver}
                        >
                            Draw 1
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
            </div>

            {/* Game over overlay on play areas */}
            {isGameOver && <div style={gameOverOverlayStyle} />}

            {/* Context Menu */}
            {contextMenu && (
                <CardContextMenu
                    card={contextMenu.card}
                    zone={contextMenu.zone}
                    controllerId={controllerId}
                    isVillain={false}
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
                onMoveToHand={(cardId, cid, zoneId) =>
                    onAction('moveCard', {
                        cardId,
                        fromZone: zoneId,
                        toZone: 'hand',
                        controllerId: cid
                    })
                }
                onClose={() => setDeckSearchOpen(false)}
            />
        </div>
    );
};

// Styles
const areaStyle = (borderColor) => ({
    border: `2px solid ${borderColor}`,
    borderRadius: '6px',
    padding: '8px',
    backgroundColor: '#212529',
    minWidth: '200px',
    maxWidth: '280px',
    position: 'relative',
    flexShrink: 0
});

const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '6px',
    flexWrap: 'wrap'
};

const titleStyle = {
    fontSize: '0.7rem',
    fontWeight: 'bold',
    color: '#adb5bd',
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
};

const nameStyle = {
    fontSize: '0.85rem',
    color: '#f8f9fa',
    fontWeight: '500'
};

const meBadgeStyle = {
    backgroundColor: '#0d6efd',
    color: '#fff',
    borderRadius: '3px',
    padding: '1px 6px',
    fontSize: '0.7rem',
    fontWeight: 'bold'
};

const activeBadgeStyle = {
    backgroundColor: '#0d6efd',
    color: '#fff',
    borderRadius: '3px',
    padding: '1px 6px',
    fontSize: '0.7rem',
    fontWeight: 'bold'
};

const incapBadgeStyle = {
    backgroundColor: '#6c757d',
    color: '#fff',
    borderRadius: '3px',
    padding: '1px 6px',
    fontSize: '0.7rem'
};

const contentColStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
};

const charRowStyle = {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
    marginBottom: '6px'
};

const charCardStyle = {
    cursor: 'context-menu',
    border: '1px solid #495057',
    borderRadius: '4px',
    backgroundColor: '#1a1d20',
    width: '68px',
    flexShrink: 0,
    position: 'relative'
};

const incapOverlayStyle = {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.55rem',
    fontWeight: 'bold',
    color: '#dc3545',
    borderRadius: '4px',
    textAlign: 'center',
    letterSpacing: '0.05em'
};

const zoneHeaderStyle = {
    fontSize: '0.7rem',
    color: '#adb5bd',
    marginBottom: '4px'
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
    width: '68px'
};

const handCardStyle = {
    border: '1px solid #495057',
    borderRadius: '4px',
    backgroundColor: '#1a1d20',
    width: '68px'
};

const faceDownCardStyle = {
    width: '68px',
    height: '102px',
    borderRadius: '4px',
    overflow: 'hidden'
};

const cardBackStyle = {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1d20',
    background:
        'repeating-linear-gradient(45deg, #2c3038 0px, #2c3038 4px, #1a1d20 4px, #1a1d20 8px)',
    borderRadius: '4px',
    border: '1px solid #495057'
};

const cardPlaceholderStyle = {
    width: '100%',
    height: '78px',
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

const pileRowStyle = {
    display: 'flex',
    gap: '4px'
};

const pileBoxStyle = {
    flex: 1,
    border: '1px solid #495057',
    borderRadius: '4px',
    padding: '6px',
    backgroundColor: '#1a1d20'
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

const gameOverOverlayStyle = {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: '6px',
    pointerEvents: 'none',
    zIndex: 10
};

export default HeroArea;
