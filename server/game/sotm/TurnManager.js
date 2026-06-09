// SotMDE TurnManager — cooperative turn-phase state machine.
// This is the single point of change for any turn structure adjustments.
// Adding/removing phases requires only: (1) update TurnPhase enum,
// (2) update advance() transition sequence, (3) update label map.

const TurnPhase = {
    SETUP: 'setup',
    VILLAIN_START: 'villain_start',
    VILLAIN_PLAY: 'villain_play',
    VILLAIN_END: 'villain_end',
    HERO_START: 'hero_start',
    HERO_PLAY: 'hero_play',
    HERO_POWER: 'hero_power',
    HERO_DRAW: 'hero_draw',
    HERO_END: 'hero_end',
    ENV_START: 'env_start',
    ENV_PLAY: 'env_play',
    ENV_END: 'env_end',
    GAME_OVER: 'game_over'
};

// Phases where all players may act (cooperative; not hero-specific)
const VILLAIN_PHASES = new Set([
    TurnPhase.VILLAIN_START,
    TurnPhase.VILLAIN_PLAY,
    TurnPhase.VILLAIN_END
]);
const ENV_PHASES = new Set([TurnPhase.ENV_START, TurnPhase.ENV_PLAY, TurnPhase.ENV_END]);
const HERO_PHASES = new Set([
    TurnPhase.HERO_START,
    TurnPhase.HERO_PLAY,
    TurnPhase.HERO_POWER,
    TurnPhase.HERO_DRAW,
    TurnPhase.HERO_END
]);

const HERO_PHASE_SEQUENCE = [
    TurnPhase.HERO_START,
    TurnPhase.HERO_PLAY,
    TurnPhase.HERO_POWER,
    TurnPhase.HERO_DRAW,
    TurnPhase.HERO_END
];

const PHASE_LABELS = {
    [TurnPhase.SETUP]: 'Setup',
    [TurnPhase.VILLAIN_START]: 'Villain — Start of Turn',
    [TurnPhase.VILLAIN_PLAY]: 'Villain — Play Card',
    [TurnPhase.VILLAIN_END]: 'Villain — End of Turn',
    [TurnPhase.HERO_START]: 'Hero — Start of Turn',
    [TurnPhase.HERO_PLAY]: 'Hero — Play Phase',
    [TurnPhase.HERO_POWER]: 'Hero — Power Phase',
    [TurnPhase.HERO_DRAW]: 'Hero — Draw Phase',
    [TurnPhase.HERO_END]: 'Hero — End of Turn',
    [TurnPhase.ENV_START]: 'Environment — Start of Turn',
    [TurnPhase.ENV_PLAY]: 'Environment — Play Card',
    [TurnPhase.ENV_END]: 'Environment — End of Turn',
    [TurnPhase.GAME_OVER]: 'Game Over'
};

class TurnManager {
    /**
     * @param {number} H                        - total hero deck count; never changes
     * @param {{ heroId: string, controllerPlayerId: string }[]} heroOrder
     * @param {{ onHeroStart?: (heroSlot) => void, onAdvance?: (label: string) => void }} [callbacks]
     */
    constructor(H, heroOrder, callbacks = {}) {
        this.H = H;
        this.heroOrder = heroOrder;
        this.onHeroStart = callbacks.onHeroStart || null;
        // onAdvance(label): called after each phase change with a human-readable system message.
        // Used by game.js to push { type: 'system', text } entries to the chat log.
        this.onAdvance = callbacks.onAdvance || null;

        this.round = 0;
        this.phase = TurnPhase.SETUP;
        this.currentHeroIndex = 0;
        this.activeHeroId = null;
        this.activeControllerPlayerId = null;
        this.lastActivityAt = new Date();
    }

    /**
     * Advance to the next phase.
     * Updates lastActivityAt, activeHeroId, activeControllerPlayerId.
     * Fires onHeroStart callback when entering a HERO_START phase.
     * @returns {{ phase, round, activeHeroId, activeControllerPlayerId }}
     */
    advance() {
        this.lastActivityAt = new Date();

        const current = this.phase;

        // Compute next phase
        if (current === TurnPhase.SETUP) {
            this.round = 1;
            this.currentHeroIndex = 0;
            this._enterPhase(TurnPhase.VILLAIN_START);
        } else if (current === TurnPhase.VILLAIN_START) {
            this._enterPhase(TurnPhase.VILLAIN_PLAY);
        } else if (current === TurnPhase.VILLAIN_PLAY) {
            this._enterPhase(TurnPhase.VILLAIN_END);
        } else if (current === TurnPhase.VILLAIN_END) {
            // Enter first hero's turn
            this.currentHeroIndex = 0;
            this._enterHeroPhase(TurnPhase.HERO_START);
        } else if (HERO_PHASES.has(current)) {
            const heroPhaseIdx = HERO_PHASE_SEQUENCE.indexOf(current);

            if (heroPhaseIdx < HERO_PHASE_SEQUENCE.length - 1) {
                // Next hero phase for same hero
                this._enterHeroPhase(HERO_PHASE_SEQUENCE[heroPhaseIdx + 1]);
            } else {
                // HERO_END — advance to next hero or ENV_START
                const nextHeroIdx = this.currentHeroIndex + 1;
                if (nextHeroIdx < this.H) {
                    this.currentHeroIndex = nextHeroIdx;
                    this._enterHeroPhase(TurnPhase.HERO_START);
                } else {
                    // All heroes done, enter environment
                    this._enterPhase(TurnPhase.ENV_START);
                }
            }
        } else if (current === TurnPhase.ENV_START) {
            this._enterPhase(TurnPhase.ENV_PLAY);
        } else if (current === TurnPhase.ENV_PLAY) {
            this._enterPhase(TurnPhase.ENV_END);
        } else if (current === TurnPhase.ENV_END) {
            // New round: back to villain start
            this.round++;
            this._enterPhase(TurnPhase.VILLAIN_START);
        } else if (current === TurnPhase.GAME_OVER) {
            // Already over; no-op
        }

        // Phase 8.2: push a system message to the game's chat log after each phase change
        if (this.onAdvance && this.phase !== current) {
            try {
                this.onAdvance(this.getCurrentTurnLabel());
            } catch (err) {
                // Never crash a game due to logging failure
            }
        }

        return this.getState();
    }

    /** Enter a villain/environment phase (clears hero active fields). */
    _enterPhase(phase) {
        this.phase = phase;
        this.activeHeroId = null;
        this.activeControllerPlayerId = null;
    }

    /** Enter a hero phase, reading current heroOrder entry. */
    _enterHeroPhase(phase) {
        this.phase = phase;
        const slot = this.heroOrder[this.currentHeroIndex];
        if (slot) {
            this.activeHeroId = slot.heroId;
            this.activeControllerPlayerId = slot.controllerPlayerId;
        }

        if (phase === TurnPhase.HERO_START && this.onHeroStart && slot) {
            try {
                this.onHeroStart(slot);
            } catch (err) {
                // Notification failure must never crash a game
            }
        }
    }

    /** Force phase directly to GAME_OVER (used by finaliseGame). */
    setGameOver() {
        this.phase = TurnPhase.GAME_OVER;
        this.activeHeroId = null;
        this.activeControllerPlayerId = null;
        this.lastActivityAt = new Date();
    }

    /**
     * Returns true when it is the given player's turn to act.
     * During villain/env phases: all players may act (cooperative).
     * During hero phases: only the activeControllerPlayerId.
     * @param {string} socketPlayerId
     */
    isMyTurn(socketPlayerId) {
        if (VILLAIN_PHASES.has(this.phase) || ENV_PHASES.has(this.phase)) {
            return true;
        }
        if (HERO_PHASES.has(this.phase)) {
            return this.activeControllerPlayerId === socketPlayerId;
        }
        // SETUP or GAME_OVER: no one's turn
        return false;
    }

    getH() {
        return this.H;
    }

    /**
     * Human-readable label for the current phase.
     * @returns {string}
     */
    getCurrentTurnLabel() {
        const base = PHASE_LABELS[this.phase] || this.phase;
        if (HERO_PHASES.has(this.phase) && this.activeHeroId) {
            return `Round ${this.round} — ${this.activeHeroId}: ${PHASE_LABELS[this.phase]}`;
        }
        return `Round ${this.round} — ${base}`;
    }

    getState() {
        return {
            round: this.round,
            phase: this.phase,
            H: this.H,
            activeHeroId: this.activeHeroId,
            activeControllerPlayerId: this.activeControllerPlayerId,
            heroOrder: this.heroOrder,
            currentHeroIndex: this.currentHeroIndex,
            lastActivityAt: this.lastActivityAt
        };
    }
}

module.exports = { TurnManager, TurnPhase };
