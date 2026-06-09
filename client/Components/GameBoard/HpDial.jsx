// SotMDE HpDial component (Phase 5, Step 5.8).
// Renders an HP display with +/- buttons. Gate on maxHp !== null (not hp !== null).
// hp can be 0 (damaged to zero) and must still show the dial.
// maxHp === null means no HP tracking for this card.
//
// Two usage contexts (same component, parent decides which event to dispatch):
//   1. Character card: isIncapacitated prop provided; shows overlay at hp <= 0
//   2. Play-area card: no isIncapacitated prop; shows hp / maxHp

import React from 'react';

/**
 * @param {{ hp: number, maxHp: number, onAdjust: (delta: number) => void, isIncapacitated?: boolean, disabled?: boolean }} props
 */
const HpDial = ({ hp, maxHp, onAdjust, isIncapacitated = false, disabled = false }) => {
    // Gate: only render when maxHp is not null/undefined
    if (maxHp === null || maxHp === undefined) {
        return null;
    }

    const pct = maxHp > 0 ? hp / maxHp : 0;
    const isLow = pct < 0.25;
    const isIncap = isIncapacitated || hp <= 0;

    const dialStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: isLow ? '#dc3545' : '#343a40',
        color: '#fff',
        borderRadius: '4px',
        padding: '2px 6px',
        fontSize: '0.8rem',
        position: 'relative'
    };

    const btnStyle = {
        background: 'none',
        border: '1px solid rgba(255,255,255,0.4)',
        color: '#fff',
        borderRadius: '2px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: '0 4px',
        lineHeight: '1.2',
        fontSize: '0.75rem'
    };

    return (
        <span style={dialStyle} title={`HP: ${hp} / ${maxHp}`}>
            <button
                style={btnStyle}
                onClick={() => !disabled && onAdjust(-1)}
                disabled={disabled}
                aria-label='Decrease HP'
            >
                −
            </button>
            <span style={{ minWidth: '36px', textAlign: 'center' }}>
                {hp} / {maxHp}
            </span>
            <button
                style={btnStyle}
                onClick={() => !disabled && onAdjust(1)}
                disabled={disabled}
                aria-label='Increase HP'
            >
                +
            </button>
            {isIncap && (
                <span
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        fontSize: '0.6rem',
                        fontWeight: 'bold',
                        letterSpacing: '0.05em'
                    }}
                >
                    INCAP
                </span>
            )}
        </span>
    );
};

export default HpDial;
