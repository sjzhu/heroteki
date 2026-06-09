/**
 * Unit tests for SotMDE TurnManager.
 * Tests the full phase transition sequence, H value, isMyTurn(), and getState().
 */

'use strict';

const { TurnManager, TurnPhase } = require('../../../../server/game/sotm/TurnManager');

// Helpers
function makeHeroOrder(heroes) {
    return heroes.map(([heroId, controllerPlayerId]) => ({ heroId, controllerPlayerId }));
}

function makeManager(H, heroes, callbacks) {
    const heroOrder = makeHeroOrder(heroes.slice(0, H));
    return new TurnManager(H, heroOrder, callbacks || {});
}

describe('TurnManager', () => {
    describe('construction', () => {
        it('starts in SETUP phase with round 0', () => {
            const tm = makeManager(2, [['legacy', 'alice'], ['wraith', 'bob']]);
            expect(tm.phase).toBe(TurnPhase.SETUP);
            expect(tm.round).toBe(0);
        });

        it('stores H value at construction', () => {
            const tm = makeManager(3, [['legacy', 'alice'], ['wraith', 'alice'], ['haka', 'bob']]);
            expect(tm.H).toBe(3);
        });

        it('H value never changes through a full round', () => {
            const tm = makeManager(2, [['legacy', 'alice'], ['wraith', 'bob']]);
            const initialH = tm.H;
            // Advance through entire round
            const phases = [
                TurnPhase.VILLAIN_START, TurnPhase.VILLAIN_PLAY, TurnPhase.VILLAIN_END,
                TurnPhase.HERO_START,
            ];
            for (let i = 0; i < phases.length; i++) {
                tm.advance();
                expect(tm.H).toBe(initialH);
            }
        });

        it('activeHeroId is null at construction', () => {
            const tm = makeManager(1, [['legacy', 'alice']]);
            expect(tm.activeHeroId).toBeNull();
        });

        it('activeControllerPlayerId is null at construction', () => {
            const tm = makeManager(1, [['legacy', 'alice']]);
            expect(tm.activeControllerPlayerId).toBeNull();
        });

        it('sets lastActivityAt on construction', () => {
            const before = new Date();
            const tm = makeManager(1, [['legacy', 'alice']]);
            const after = new Date();
            expect(tm.lastActivityAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(tm.lastActivityAt.getTime()).toBeLessThanOrEqual(after.getTime());
        });
    });

    describe('phase transition sequence for a single-hero game', () => {
        let tm;

        beforeEach(() => {
            tm = makeManager(1, [['legacy', 'alice']]);
        });

        it('SETUP → VILLAIN_START on first advance(); round becomes 1', () => {
            tm.advance();
            expect(tm.phase).toBe(TurnPhase.VILLAIN_START);
            expect(tm.round).toBe(1);
        });

        it('VILLAIN_START → VILLAIN_PLAY', () => {
            tm.advance(); // SETUP → VILLAIN_START
            tm.advance(); // VILLAIN_START → VILLAIN_PLAY
            expect(tm.phase).toBe(TurnPhase.VILLAIN_PLAY);
        });

        it('VILLAIN_PLAY → VILLAIN_END', () => {
            tm.advance(); tm.advance(); tm.advance();
            expect(tm.phase).toBe(TurnPhase.VILLAIN_END);
        });

        it('VILLAIN_END → HERO_START(0)', () => {
            tm.advance(); tm.advance(); tm.advance(); tm.advance();
            expect(tm.phase).toBe(TurnPhase.HERO_START);
        });

        it('HERO_START → HERO_PLAY', () => {
            tm.advance(); tm.advance(); tm.advance(); tm.advance(); tm.advance();
            expect(tm.phase).toBe(TurnPhase.HERO_PLAY);
        });

        it('HERO_PLAY → HERO_POWER', () => {
            for (let i = 0; i < 6; i++) tm.advance();
            expect(tm.phase).toBe(TurnPhase.HERO_POWER);
        });

        it('HERO_POWER → HERO_DRAW', () => {
            for (let i = 0; i < 7; i++) tm.advance();
            expect(tm.phase).toBe(TurnPhase.HERO_DRAW);
        });

        it('HERO_DRAW → HERO_END', () => {
            for (let i = 0; i < 8; i++) tm.advance();
            expect(tm.phase).toBe(TurnPhase.HERO_END);
        });

        it('HERO_END (last hero) → ENV_START', () => {
            for (let i = 0; i < 9; i++) tm.advance();
            expect(tm.phase).toBe(TurnPhase.ENV_START);
        });

        it('ENV_START → ENV_PLAY', () => {
            for (let i = 0; i < 10; i++) tm.advance();
            expect(tm.phase).toBe(TurnPhase.ENV_PLAY);
        });

        it('ENV_PLAY → ENV_END', () => {
            for (let i = 0; i < 11; i++) tm.advance();
            expect(tm.phase).toBe(TurnPhase.ENV_END);
        });

        it('ENV_END → VILLAIN_START (round increments)', () => {
            for (let i = 0; i < 12; i++) tm.advance();
            expect(tm.phase).toBe(TurnPhase.VILLAIN_START);
            expect(tm.round).toBe(2);
        });
    });

    describe('multi-hero phase transitions (2 heroes)', () => {
        let tm;

        beforeEach(() => {
            tm = makeManager(2, [['legacy', 'alice'], ['wraith', 'bob']]);
        });

        it('after first hero HERO_END, enters second hero HERO_START', () => {
            // SETUP → VILLAIN_START(1) → VILLAIN_PLAY(2) → VILLAIN_END(3) → HERO_START(4)
            // → HERO_PLAY(5) → HERO_POWER(6) → HERO_DRAW(7) → HERO_END(8)
            // → HERO_START for hero 2 (9)
            for (let i = 0; i < 9; i++) tm.advance();
            expect(tm.phase).toBe(TurnPhase.HERO_START);
            expect(tm.activeHeroId).toBe('wraith');
            expect(tm.activeControllerPlayerId).toBe('bob');
        });

        it('after second hero HERO_END, enters ENV_START', () => {
            // 14 advances to get past both hero turns and into ENV_START
            for (let i = 0; i < 14; i++) tm.advance();
            expect(tm.phase).toBe(TurnPhase.ENV_START);
        });
    });

    describe('activeHeroId and activeControllerPlayerId', () => {
        let tm;

        beforeEach(() => {
            tm = makeManager(2, [['legacy', 'alice'], ['wraith', 'bob']]);
        });

        it('both are null during VILLAIN phases', () => {
            tm.advance(); // SETUP → VILLAIN_START
            expect(tm.activeHeroId).toBeNull();
            expect(tm.activeControllerPlayerId).toBeNull();

            tm.advance(); // VILLAIN_PLAY
            expect(tm.activeHeroId).toBeNull();
            tm.advance(); // VILLAIN_END
            expect(tm.activeHeroId).toBeNull();
        });

        it('both are null during ENV phases', () => {
            // Advance to ENV_START (14 advances for 2-hero game)
            for (let i = 0; i < 14; i++) tm.advance();
            expect(tm.phase).toBe(TurnPhase.ENV_START);
            expect(tm.activeHeroId).toBeNull();
            expect(tm.activeControllerPlayerId).toBeNull();
        });

        it('set to first hero during first hero phases', () => {
            // Advance to HERO_START (4 advances)
            for (let i = 0; i < 4; i++) tm.advance();
            expect(tm.phase).toBe(TurnPhase.HERO_START);
            expect(tm.activeHeroId).toBe('legacy');
            expect(tm.activeControllerPlayerId).toBe('alice');
        });

        it('remain set through all 5 hero phases', () => {
            for (let i = 0; i < 4; i++) tm.advance(); // reach HERO_START
            const heroPhases = [
                TurnPhase.HERO_START, TurnPhase.HERO_PLAY,
                TurnPhase.HERO_POWER, TurnPhase.HERO_DRAW, TurnPhase.HERO_END
            ];
            for (const phase of heroPhases) {
                expect(tm.phase).toBe(phase);
                expect(tm.activeHeroId).toBe('legacy');
                tm.advance();
            }
        });

        it('set to second hero during second hero phases', () => {
            for (let i = 0; i < 9; i++) tm.advance(); // reach second hero HERO_START
            expect(tm.activeHeroId).toBe('wraith');
            expect(tm.activeControllerPlayerId).toBe('bob');
        });

        it('cleared back to null when entering ENV_START', () => {
            for (let i = 0; i < 14; i++) tm.advance(); // ENV_START
            expect(tm.activeHeroId).toBeNull();
            expect(tm.activeControllerPlayerId).toBeNull();
        });
    });

    describe('isMyTurn()', () => {
        let tm;

        beforeEach(() => {
            tm = makeManager(2, [['legacy', 'alice'], ['wraith', 'bob']]);
        });

        it('returns false for all players during SETUP', () => {
            expect(tm.phase).toBe(TurnPhase.SETUP);
            expect(tm.isMyTurn('alice')).toBe(false);
            expect(tm.isMyTurn('bob')).toBe(false);
        });

        it('returns true for ALL players during villain phases (cooperative)', () => {
            tm.advance(); // VILLAIN_START
            expect(tm.isMyTurn('alice')).toBe(true);
            expect(tm.isMyTurn('bob')).toBe(true);
            expect(tm.isMyTurn('spectator')).toBe(true);
        });

        it('returns true for ALL players during VILLAIN_PLAY', () => {
            tm.advance(); tm.advance();
            expect(tm.phase).toBe(TurnPhase.VILLAIN_PLAY);
            expect(tm.isMyTurn('alice')).toBe(true);
            expect(tm.isMyTurn('bob')).toBe(true);
        });

        it('returns true for ALL players during VILLAIN_END', () => {
            tm.advance(); tm.advance(); tm.advance();
            expect(tm.phase).toBe(TurnPhase.VILLAIN_END);
            expect(tm.isMyTurn('alice')).toBe(true);
            expect(tm.isMyTurn('bob')).toBe(true);
        });

        it('returns true only for active controller during HERO_START', () => {
            for (let i = 0; i < 4; i++) tm.advance(); // HERO_START for alice/legacy
            expect(tm.phase).toBe(TurnPhase.HERO_START);
            expect(tm.isMyTurn('alice')).toBe(true);
            expect(tm.isMyTurn('bob')).toBe(false);
        });

        it('returns true only for active controller during HERO_PLAY', () => {
            for (let i = 0; i < 5; i++) tm.advance(); // HERO_PLAY for alice
            expect(tm.isMyTurn('alice')).toBe(true);
            expect(tm.isMyTurn('bob')).toBe(false);
        });

        it('returns true for ALL players during ENV phases', () => {
            for (let i = 0; i < 14; i++) tm.advance(); // ENV_START
            expect(tm.phase).toBe(TurnPhase.ENV_START);
            expect(tm.isMyTurn('alice')).toBe(true);
            expect(tm.isMyTurn('bob')).toBe(true);
        });

        it('returns false for all players during GAME_OVER', () => {
            tm.setGameOver();
            expect(tm.isMyTurn('alice')).toBe(false);
            expect(tm.isMyTurn('bob')).toBe(false);
        });

        it('one player controls two heroes — isMyTurn() returns true during both hero turns', () => {
            const tm2 = makeManager(2, [['legacy', 'alice'], ['wraith', 'alice']]);
            // First hero turn (4 advances)
            for (let i = 0; i < 4; i++) tm2.advance();
            expect(tm2.isMyTurn('alice')).toBe(true);
            // Advance through first hero's 5 phases, reach second hero HERO_START
            for (let i = 0; i < 5; i++) tm2.advance();
            expect(tm2.isMyTurn('alice')).toBe(true);
        });
    });

    describe('lastActivityAt', () => {
        it('updates on every advance() call', (done) => {
            const tm = makeManager(1, [['legacy', 'alice']]);
            const initial = tm.lastActivityAt.getTime();

            setTimeout(() => {
                tm.advance();
                expect(tm.lastActivityAt.getTime()).toBeGreaterThan(initial);
                done();
            }, 5);
        });

        it('updates on setGameOver()', (done) => {
            const tm = makeManager(1, [['legacy', 'alice']]);
            const initial = tm.lastActivityAt.getTime();

            setTimeout(() => {
                tm.setGameOver();
                expect(tm.lastActivityAt.getTime()).toBeGreaterThan(initial);
                done();
            }, 5);
        });
    });

    describe('getState()', () => {
        it('returns all required fields', () => {
            const tm = makeManager(2, [['legacy', 'alice'], ['wraith', 'bob']]);
            const state = tm.getState();

            expect(state.round).toBeDefined();
            expect(state.phase).toBeDefined();
            expect(state.H).toBeDefined();
            expect(state.activeHeroId !== undefined).toBe(true);
            expect(state.activeControllerPlayerId !== undefined).toBe(true);
            expect(Array.isArray(state.heroOrder)).toBe(true);
            expect(typeof state.currentHeroIndex).toBe('number');
            expect(state.lastActivityAt instanceof Date).toBe(true);
        });

        it('H in state matches constructor value', () => {
            const tm = makeManager(3, [['legacy', 'alice'], ['wraith', 'bob'], ['haka', 'bob']]);
            expect(tm.getState().H).toBe(3);
        });

        it('state phase matches current phase', () => {
            const tm = makeManager(1, [['legacy', 'alice']]);
            tm.advance();
            expect(tm.getState().phase).toBe(TurnPhase.VILLAIN_START);
        });
    });

    describe('onAdvance callback', () => {
        it('fires with a label string after each phase transition', () => {
            const calls = [];
            const tm = makeManager(1, [['legacy', 'alice']], {
                onAdvance: (label) => calls.push(label)
            });
            tm.advance();
            expect(calls.length).toBe(1);
            expect(typeof calls[0]).toBe('string');
        });

        it('does not fire if phase stays the same (GAME_OVER advance is no-op)', () => {
            const calls = [];
            const tm = makeManager(1, [['legacy', 'alice']], {
                onAdvance: (label) => calls.push(label)
            });
            tm.setGameOver();
            const beforeCount = calls.length;
            tm.advance(); // no-op; phase stays GAME_OVER
            expect(calls.length).toBe(beforeCount);
        });
    });

    describe('round counter', () => {
        it('round is 0 during SETUP', () => {
            const tm = makeManager(1, [['legacy', 'alice']]);
            expect(tm.round).toBe(0);
        });

        it('round becomes 1 when entering VILLAIN_START', () => {
            const tm = makeManager(1, [['legacy', 'alice']]);
            tm.advance();
            expect(tm.round).toBe(1);
        });

        it('round increments to 2 after ENV_END in a 1-hero game (12 advances)', () => {
            const tm = makeManager(1, [['legacy', 'alice']]);
            for (let i = 0; i < 12; i++) tm.advance();
            expect(tm.phase).toBe(TurnPhase.VILLAIN_START);
            expect(tm.round).toBe(2);
        });
    });
});
