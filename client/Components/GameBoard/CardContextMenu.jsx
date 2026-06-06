// SotMDE CardContextMenu component (Phase 5, Step 5.6).
// Right-click / long-press popup that shows available actions per zone.
// Actions dispatch socket events via the onAction callback.
// onAction(eventName, payload) → dispatches sendGameMessage(eventName, payload)

import React, { useState, useRef, useEffect } from 'react';

/**
 * @param {{
 *   card: object,
 *   zone: string,
 *   controllerId: string,
 *   isVillain?: boolean,
 *   onAction: (event: string, payload: object) => void,
 *   onClose: () => void,
 *   position: { x: number, y: number }
 * }} props
 */
const CardContextMenu = ({ card, zone, controllerId, isVillain = false, onAction, onClose, position }) => {
    const [showKeywordInput, setShowKeywordInput] = useState(false);
    const [newKeyword, setNewKeyword] = useState('');
    const [showTokenInput, setShowTokenInput] = useState(false);
    const [newTokenLabel, setNewTokenLabel] = useState('');
    const [showMaxHpInput, setShowMaxHpInput] = useState(false);
    const [maxHpValue, setMaxHpValue] = useState('');
    const [showSetHpInput, setShowSetHpInput] = useState(false);
    const [setHpValue, setSetHpValue] = useState('');
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const act = (event, payload) => {
        onAction(event, payload);
        onClose();
    };

    const menuStyle = {
        position: 'fixed',
        left: position.x,
        top: position.y,
        backgroundColor: '#212529',
        border: '1px solid #495057',
        borderRadius: '4px',
        padding: '4px 0',
        zIndex: 9999,
        minWidth: '180px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        color: '#f8f9fa',
        fontSize: '0.85rem',
    };

    const itemStyle = {
        padding: '5px 12px',
        cursor: 'pointer',
        display: 'block',
        background: 'none',
        border: 'none',
        color: 'inherit',
        width: '100%',
        textAlign: 'left',
    };

    const dividerStyle = {
        borderTop: '1px solid #495057',
        margin: '4px 0',
    };

    const inputRowStyle = {
        display: 'flex',
        gap: '4px',
        padding: '4px 8px',
    };

    const inputStyle = {
        background: '#343a40',
        border: '1px solid #495057',
        color: '#f8f9fa',
        borderRadius: '3px',
        padding: '2px 6px',
        flex: 1,
        fontSize: '0.8rem',
    };

    const smallBtnStyle = {
        background: '#495057',
        border: 'none',
        color: '#f8f9fa',
        borderRadius: '3px',
        padding: '2px 6px',
        cursor: 'pointer',
        fontSize: '0.75rem',
    };

    const tokenLabels = card && card.tokens ? Object.keys(card.tokens) : [];
    const keywords = card && card.keywords ? card.keywords : [];

    const renderHandActions = () => (
        <>
            <button style={itemStyle} onClick={() =>
                act('playCard', { cardId: card.id })
            }>Play Card</button>
            <button style={itemStyle} onClick={() =>
                act('discardCard', { cardId: card.id, zone: 'hand' })
            }>Discard</button>
        </>
    );

    const renderPlayAreaActions = () => (
        <>
            <button style={itemStyle} onClick={() =>
                act('moveCard', { cardId: card.id, fromZone: 'playArea', toZone: 'trash', controllerId })
            }>Move to Trash</button>
            <button style={itemStyle} onClick={() =>
                act('moveCard', { cardId: card.id, fromZone: 'playArea', toZone: 'hand', controllerId })
            }>Return to Hand</button>
            <button style={itemStyle} onClick={() =>
                act('moveCard', { cardId: card.id, fromZone: 'playArea', toZone: 'deck', controllerId })
            }>Return to Deck</button>
            <div style={dividerStyle} />

            {/* HP actions */}
            {card.maxHp === null && (
                <>
                    {!showMaxHpInput ? (
                        <button style={itemStyle} onClick={() => setShowMaxHpInput(true)}>
                            Set Max HP
                        </button>
                    ) : (
                        <div style={inputRowStyle}>
                            <input
                                style={inputStyle}
                                type='number'
                                placeholder='Max HP'
                                value={maxHpValue}
                                onChange={(e) => setMaxHpValue(e.target.value)}
                                autoFocus
                            />
                            <button style={smallBtnStyle} onClick={() => {
                                const n = parseInt(maxHpValue, 10);
                                if (!isNaN(n) && n > 0) {
                                    act('modifyCard', { cardId: card.id, controllerId, updates: { hp: n, maxHp: n } });
                                }
                            }}>OK</button>
                        </div>
                    )}
                </>
            )}
            {card.maxHp !== null && card.hp !== null && (
                <>
                    <button style={itemStyle} onClick={() =>
                        act('modifyCard', { cardId: card.id, controllerId, updates: { hp: (card.hp || 0) + 1 } })
                    }>Adjust HP +1</button>
                    <button style={itemStyle} onClick={() =>
                        act('modifyCard', { cardId: card.id, controllerId, updates: { hp: (card.hp || 0) - 1 } })
                    }>Adjust HP −1</button>
                </>
            )}
            <div style={dividerStyle} />

            {/* Keyword actions */}
            {!showKeywordInput ? (
                <button style={itemStyle} onClick={() => setShowKeywordInput(true)}>
                    Add Keyword
                </button>
            ) : (
                <div style={inputRowStyle}>
                    <input
                        style={inputStyle}
                        type='text'
                        placeholder='keyword'
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        autoFocus
                    />
                    <button style={smallBtnStyle} onClick={() => {
                        if (newKeyword.trim()) {
                            act('modifyCard', { cardId: card.id, controllerId, updates: { addKeyword: newKeyword.trim() } });
                        }
                    }}>OK</button>
                </div>
            )}
            {keywords.length > 0 && (
                <div style={{ padding: '0 8px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#adb5bd', padding: '2px 0' }}>Remove Keyword:</div>
                    {keywords.map((kw) => (
                        <button key={kw} style={{ ...itemStyle, paddingLeft: '16px', fontSize: '0.8rem' }}
                            onClick={() => act('modifyCard', { cardId: card.id, controllerId, updates: { removeKeyword: kw } })}>
                            {kw}
                        </button>
                    ))}
                </div>
            )}
            <div style={dividerStyle} />

            {/* Token actions */}
            {!showTokenInput ? (
                <button style={itemStyle} onClick={() => setShowTokenInput(true)}>
                    Add Token
                </button>
            ) : (
                <div style={inputRowStyle}>
                    <input
                        style={inputStyle}
                        type='text'
                        placeholder='label'
                        value={newTokenLabel}
                        onChange={(e) => setNewTokenLabel(e.target.value)}
                        autoFocus
                    />
                    <button style={smallBtnStyle} onClick={() => {
                        if (newTokenLabel.trim()) {
                            act('modifyCard', { cardId: card.id, controllerId, updates: { token: { label: newTokenLabel.trim(), delta: 1 } } });
                        }
                    }}>OK</button>
                </div>
            )}
            {tokenLabels.length > 0 && (
                <div style={{ padding: '0 8px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#adb5bd', padding: '2px 0' }}>Remove Token:</div>
                    {tokenLabels.map((label) => (
                        <button key={label} style={{ ...itemStyle, paddingLeft: '16px', fontSize: '0.8rem' }}
                            onClick={() => act('modifyCard', { cardId: card.id, controllerId, updates: { token: { label, delta: -1 } } })}>
                            {label} ({card.tokens[label]})
                        </button>
                    ))}
                </div>
            )}
        </>
    );

    const renderDeckActions = () => (
        <>
            <button style={itemStyle} onClick={() =>
                act('searchDeck', { controllerId, zoneId: 'deck' })
            }>Search Deck</button>
            <button style={itemStyle} onClick={() =>
                act('shuffleDeck', { controllerId, zoneId: 'deck' })
            }>Shuffle Deck</button>
        </>
    );

    const renderTrashActions = () => (
        <>
            <button style={itemStyle} onClick={() =>
                act('moveCard', { cardId: card.id, fromZone: 'trash', toZone: 'deck', controllerId })
            }>Return to Deck</button>
            <button style={itemStyle} onClick={() =>
                act('moveCard', { cardId: card.id, fromZone: 'trash', toZone: 'playArea', controllerId })
            }>Return to Play</button>
        </>
    );

    const renderCharacterActions = () => (
        <>
            {!showSetHpInput ? (
                <>
                    <button style={itemStyle} onClick={() =>
                        act('adjustHp', { controllerId, delta: 1 })
                    }>Adjust HP +1</button>
                    <button style={itemStyle} onClick={() =>
                        act('adjustHp', { controllerId, delta: -1 })
                    }>Adjust HP −1</button>
                    <button style={itemStyle} onClick={() => setShowSetHpInput(true)}>
                        Set HP Value
                    </button>
                </>
            ) : (
                <div style={inputRowStyle}>
                    <input
                        style={inputStyle}
                        type='number'
                        placeholder='HP'
                        value={setHpValue}
                        onChange={(e) => setSetHpValue(e.target.value)}
                        autoFocus
                    />
                    <button style={smallBtnStyle} onClick={() => {
                        const n = parseInt(setHpValue, 10);
                        if (!isNaN(n)) {
                            act('adjustHp', { controllerId, delta: n - (card.hp || 0) });
                        }
                    }}>OK</button>
                </div>
            )}
            {isVillain && (
                <button style={itemStyle} onClick={() => act('flipVillain', {})}>
                    Flip Villain
                </button>
            )}
            <div style={dividerStyle} />
            {/* Token actions on character card */}
            {!showTokenInput ? (
                <button style={itemStyle} onClick={() => setShowTokenInput(true)}>Add Token</button>
            ) : (
                <div style={inputRowStyle}>
                    <input
                        style={inputStyle}
                        type='text'
                        placeholder='label'
                        value={newTokenLabel}
                        onChange={(e) => setNewTokenLabel(e.target.value)}
                        autoFocus
                    />
                    <button style={smallBtnStyle} onClick={() => {
                        if (newTokenLabel.trim()) {
                            act('modifyCard', { cardId: card.id, controllerId, updates: { token: { label: newTokenLabel.trim(), delta: 1 } } });
                        }
                    }}>OK</button>
                </div>
            )}
            {tokenLabels.length > 0 && (
                <div style={{ padding: '0 8px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#adb5bd', padding: '2px 0' }}>Remove Token:</div>
                    {tokenLabels.map((label) => (
                        <button key={label} style={{ ...itemStyle, paddingLeft: '16px', fontSize: '0.8rem' }}
                            onClick={() => act('modifyCard', { cardId: card.id, controllerId, updates: { token: { label, delta: -1 } } })}>
                            {label} ({card.tokens[label]})
                        </button>
                    ))}
                </div>
            )}
        </>
    );

    return (
        <div ref={menuRef} style={menuStyle} onContextMenu={(e) => e.preventDefault()}>
            {zone === 'hand' && renderHandActions()}
            {zone === 'playArea' && renderPlayAreaActions()}
            {zone === 'deck' && renderDeckActions()}
            {zone === 'trash' && renderTrashActions()}
            {zone === 'character' && renderCharacterActions()}
            <div style={dividerStyle} />
            <button style={{ ...itemStyle, color: '#adb5bd' }} onClick={onClose}>Cancel</button>
        </div>
    );
};

export default CardContextMenu;
