// SotMDE AuxZone component (Phase 5, Step 5.9).
// Reusable widget for one auxiliary zone (side deck).
// Props: { zone: AuxZoneState, label: string, onAction: fn }
// AuxZoneState shape: { id, name, deck: SotmCardSummary[], trash: SotmCardSummary[] }

import React from 'react';

/**
 * @param {{
 *   zone: { id: string, name: string, deck: object[], trash: object[] },
 *   label: string,
 *   controllerId: string,
 *   onAction: (event: string, payload: object) => void
 * }} props
 */
const AuxZone = ({ zone, label, controllerId, onAction }) => {
    if (!zone) return null;

    const deck = zone.deck || [];
    const trash = zone.trash || [];

    const containerStyle = {
        border: '1px solid #495057',
        borderRadius: '4px',
        padding: '6px 8px',
        marginTop: '6px',
        backgroundColor: '#1a1d20',
    };

    const labelStyle = {
        fontSize: '0.7rem',
        color: '#adb5bd',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '4px',
    };

    const rowStyle = {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        flexWrap: 'wrap',
    };

    const pileStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
    };

    const pileCountStyle = {
        backgroundColor: '#343a40',
        borderRadius: '3px',
        padding: '2px 8px',
        fontSize: '0.75rem',
        color: '#f8f9fa',
    };

    const smallBtnStyle = {
        fontSize: '0.7rem',
        padding: '2px 6px',
        backgroundColor: '#495057',
        border: 'none',
        color: '#f8f9fa',
        borderRadius: '3px',
        cursor: 'pointer',
    };

    return (
        <div style={containerStyle}>
            <div style={labelStyle}>{label || zone.name || 'Side Deck'}</div>
            <div style={rowStyle}>
                <div style={pileStyle}>
                    <span style={{ fontSize: '0.7rem', color: '#adb5bd' }}>Deck</span>
                    <span style={pileCountStyle}>{deck.length}</span>
                    <button
                        style={smallBtnStyle}
                        onClick={() => onAction('shuffleDeck', { controllerId, zoneId: zone.id })}
                    >
                        Shuffle
                    </button>
                    <button
                        style={smallBtnStyle}
                        onClick={() => onAction('searchDeck', { controllerId, zoneId: zone.id })}
                    >
                        Search
                    </button>
                </div>
                <div style={pileStyle}>
                    <span style={{ fontSize: '0.7rem', color: '#adb5bd' }}>Trash</span>
                    <span style={pileCountStyle}>{trash.length}</span>
                </div>
            </div>
        </div>
    );
};

export default AuxZone;
