// SotMDE TurnTracker component (Phase 5, Step 5.5).
// Fixed top bar above the board layout showing round, H value, phase, and controls.
// "Advance Phase" button: enabled for all players on villain/env phases; only active
//   hero controller during hero phases.
// "End Game" button always visible, emits initiateGameOver → server broadcasts gameOverPrompt.

import React from 'react';
import { useDispatch } from 'react-redux';
import { sendGameMessage } from '../../redux/actions';

// Phases where any player may advance (villain and environment phases)
const COOP_PHASES = new Set([
    'villain_start',
    'villain_play',
    'villain_end',
    'env_start',
    'env_play',
    'env_end',
    'setup'
]);

const PHASE_LABELS = {
    setup: 'Setup',
    villain_start: 'Villain — Start Phase',
    villain_play: 'Villain — Play Phase',
    villain_end: 'Villain — End Phase',
    hero_start: 'Hero — Start Phase',
    hero_play: 'Hero — Play Phase',
    hero_power: 'Hero — Power Phase',
    hero_draw: 'Hero — Draw Phase',
    hero_end: 'Hero — End Phase',
    env_start: 'Environment — Start Phase',
    env_play: 'Environment — Play Phase',
    env_end: 'Environment — End Phase',
    game_over: 'Game Over'
};

/**
 * @param {{
 *   turnState: { round: number, phase: string, H: number, activeHeroId: string|null, activeControllerPlayerId: string|null },
 *   myPlayerId: string,
 *   onEndGame: () => void
 * }} props
 */
const TurnTracker = ({ turnState, myPlayerId, onEndGame }) => {
    const dispatch = useDispatch();
    const { round = 0, phase = 'setup', H = 0, activeControllerPlayerId = null } = turnState || {};

    const isCoopPhase = COOP_PHASES.has(phase);
    const isHeroPhase = !isCoopPhase && phase !== 'game_over';
    const canAdvance =
        phase !== 'game_over' &&
        (isCoopPhase || (isHeroPhase && activeControllerPlayerId === myPlayerId));

    const phaseLabel = PHASE_LABELS[phase] || phase;

    const handleAdvance = () => {
        if (canAdvance) {
            dispatch(sendGameMessage('advancePhase', {}));
        }
    };

    const handleEndGame = () => {
        dispatch(sendGameMessage('initiateGameOver', {}));
        if (onEndGame) onEndGame();
    };

    const barStyle = {
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: '#1a1d20',
        borderBottom: '1px solid #343a40',
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap'
    };

    const hBadgeStyle = {
        backgroundColor: '#0d6efd',
        color: '#fff',
        borderRadius: '4px',
        padding: '2px 10px',
        fontWeight: 'bold',
        fontSize: '0.9rem',
        letterSpacing: '0.03em'
    };

    const roundBadgeStyle = {
        backgroundColor: '#495057',
        color: '#f8f9fa',
        borderRadius: '4px',
        padding: '2px 10px',
        fontSize: '0.85rem'
    };

    const phaseLabelStyle = {
        color: '#f8f9fa',
        fontSize: '0.9rem',
        fontWeight: '500',
        flex: 1
    };

    const advanceBtnStyle = {
        backgroundColor: canAdvance ? '#198754' : '#343a40',
        border: 'none',
        color: canAdvance ? '#fff' : '#6c757d',
        borderRadius: '4px',
        padding: '4px 14px',
        cursor: canAdvance ? 'pointer' : 'not-allowed',
        fontSize: '0.85rem',
        fontWeight: '500'
    };

    const endGameBtnStyle = {
        backgroundColor: 'transparent',
        border: '1px solid #6c757d',
        color: '#6c757d',
        borderRadius: '4px',
        padding: '4px 14px',
        cursor: 'pointer',
        fontSize: '0.85rem'
    };

    return (
        <div style={barStyle}>
            <span style={roundBadgeStyle}>Round {round}</span>
            <span style={hBadgeStyle}>H = {H}</span>
            <span style={phaseLabelStyle}>{phaseLabel}</span>
            <button
                style={advanceBtnStyle}
                onClick={handleAdvance}
                disabled={!canAdvance}
                title={canAdvance ? 'Advance to next phase' : 'Not your turn to advance'}
            >
                Advance Phase
            </button>
            <button
                style={endGameBtnStyle}
                onClick={handleEndGame}
                title='Open game over dialog on all clients'
            >
                End Game
            </button>
        </div>
    );
};

export default TurnTracker;
