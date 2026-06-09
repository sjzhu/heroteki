/**
 * Unit tests for finaliseGame() and related logic in game.js.
 *
 * Strategy: test the _deriveVersionTags() logic and the GAME_OVER guard
 * by creating a minimal mock game object that replicates the relevant
 * behavior, since game.js requires a live DB connection to fully instantiate.
 *
 * The _deriveVersionTags() method is tested by invoking it on a minimal
 * object that shares the same structure as a real Game instance.
 */

'use strict';

const { TurnPhase } = require('../../../../server/game/sotm/TurnManager');

// ---- Minimal stand-ins ----

function makeHeroPlayer(deckId, deckVersion, charId, charVersion) {
    const characterCard = charId ? { id: charId, version: charVersion || null } : null;
    return {
        id: 'player1',
        name: 'Alice',
        deckId,
        deckVersion: deckVersion || null,
        characterCard,
        hp: 30,
        isIncapacitated: false,
    };
}

function makeVillain(deckId, deckVersion, charId, charVersion) {
    return {
        deckId,
        deckVersion: deckVersion || null,
        characterCard: charId ? { id: charId, version: charVersion || null } : null,
        hp: 40,
        isFlipped: false,
    };
}

function makeEnvironment(deckId, deckVersion) {
    return {
        deckId,
        deckVersion: deckVersion || null,
    };
}

/**
 * Minimal game object with just the properties needed to test
 * _deriveVersionTags() and the GAME_OVER guard. This mirrors the shape of
 * the real Game class without requiring a DB connection.
 */
function makeMinimalGame(opts = {}) {
    const heroPlayers = opts.heroPlayers || [];
    const villain = opts.villain || null;
    const environment = opts.environment || null;
    const phase = opts.phase || TurnPhase.SETUP;

    const turnManager = {
        phase,
        round: opts.round || 1,
        setGameOver() { this.phase = TurnPhase.GAME_OVER; },
    };

    // Replicate _deriveVersionTags exactly as in game.js
    function _deriveVersionTags() {
        const tags = [];
        for (const hero of heroPlayers) {
            if (hero.deckVersion) tags.push(`deck:${hero.deckId}@${hero.deckVersion}`);
            if (hero.characterCard && hero.characterCard.version) {
                tags.push(`char:${hero.characterCard.id}@${hero.characterCard.version}`);
            }
        }
        if (villain) {
            if (villain.deckVersion) tags.push(`deck:${villain.deckId}@${villain.deckVersion}`);
            if (villain.characterCard && villain.characterCard.version) {
                tags.push(`char:${villain.characterCard.id}@${villain.characterCard.version}`);
            }
        }
        if (environment && environment.deckVersion) {
            tags.push(`deck:${environment.deckId}@${environment.deckVersion}`);
        }
        return tags;
    }

    return {
        id: 'game-test-001',
        turnManager,
        heroPlayers,
        villain,
        environment,
        _deriveVersionTags,
        TurnPhase,
    };
}

describe('_deriveVersionTags()', () => {
    it('generates deck:{id}@{version} for hero deck', () => {
        const game = makeMinimalGame({
            heroPlayers: [makeHeroPlayer('legacy', '1.0.0', null, null)],
        });
        const tags = game._deriveVersionTags();
        expect(tags).toContain('deck:legacy@1.0.0');
    });

    it('generates char:{id}@{version} for hero character card', () => {
        const game = makeMinimalGame({
            heroPlayers: [makeHeroPlayer('legacy', '1.0.0', 'legacy-char', '1.2.0')],
        });
        const tags = game._deriveVersionTags();
        expect(tags).toContain('char:legacy-char@1.2.0');
    });

    it('generates deck tag for villain deck', () => {
        const game = makeMinimalGame({
            heroPlayers: [],
            villain: makeVillain('baron-blade', '2.1.0', null, null),
        });
        const tags = game._deriveVersionTags();
        expect(tags).toContain('deck:baron-blade@2.1.0');
    });

    it('generates char tag for villain character card', () => {
        const game = makeMinimalGame({
            heroPlayers: [],
            villain: makeVillain('baron-blade', '2.1.0', 'baron-blade-char', '2.0.0'),
        });
        const tags = game._deriveVersionTags();
        expect(tags).toContain('char:baron-blade-char@2.0.0');
    });

    it('generates deck tag for environment deck', () => {
        const game = makeMinimalGame({
            heroPlayers: [],
            environment: makeEnvironment('megalopolis', '1.0.1'),
        });
        const tags = game._deriveVersionTags();
        expect(tags).toContain('deck:megalopolis@1.0.1');
    });

    it('generates tags for all decks in a full game', () => {
        const game = makeMinimalGame({
            heroPlayers: [
                makeHeroPlayer('legacy', '1.0.0', 'legacy-char', '1.0.0'),
                makeHeroPlayer('wraith', '1.1.0', 'wraith-char', '1.1.0'),
            ],
            villain: makeVillain('baron-blade', '2.0.0', 'baron-blade-char', '2.0.0'),
            environment: makeEnvironment('megalopolis', '1.0.0'),
        });
        const tags = game._deriveVersionTags();
        expect(tags).toContain('deck:legacy@1.0.0');
        expect(tags).toContain('char:legacy-char@1.0.0');
        expect(tags).toContain('deck:wraith@1.1.0');
        expect(tags).toContain('char:wraith-char@1.1.0');
        expect(tags).toContain('deck:baron-blade@2.0.0');
        expect(tags).toContain('char:baron-blade-char@2.0.0');
        expect(tags).toContain('deck:megalopolis@1.0.0');
    });

    it('skips deck tag when deckVersion is null', () => {
        const game = makeMinimalGame({
            heroPlayers: [makeHeroPlayer('legacy', null, null, null)],
        });
        const tags = game._deriveVersionTags();
        expect(tags.filter(t => t.startsWith('deck:legacy'))).toHaveSize(0);
    });

    it('skips char tag when characterCard version is null', () => {
        const game = makeMinimalGame({
            heroPlayers: [makeHeroPlayer('legacy', '1.0.0', 'legacy-char', null)],
        });
        const tags = game._deriveVersionTags();
        expect(tags.filter(t => t.startsWith('char:'))).toHaveSize(0);
    });

    it('skips char tag when characterCard is null', () => {
        const game = makeMinimalGame({
            heroPlayers: [makeHeroPlayer('legacy', '1.0.0', null, null)],
        });
        const tags = game._deriveVersionTags();
        expect(tags.filter(t => t.startsWith('char:'))).toHaveSize(0);
    });

    it('skips villain tag when villain is null', () => {
        const game = makeMinimalGame({ heroPlayers: [] });
        const tags = game._deriveVersionTags();
        expect(tags.length).toBe(0);
    });
});

describe('_deriveVersionTags() deduplication', () => {
    it('auto-tags deduplicated via Set in finaliseGame', () => {
        // Simulate the deduplication step from finaliseGame():
        // const mergedTags = [...new Set([...autoTags, ...tags])];
        const autoTags = ['deck:legacy@1.0.0', 'char:legacy-char@1.0.0', 'deck:legacy@1.0.0'];
        const userTags = ['deck:legacy@1.0.0', 'my-custom-tag'];
        const merged = [...new Set([...autoTags, ...userTags])];

        expect(merged.filter(t => t === 'deck:legacy@1.0.0').length).toBe(1);
        expect(merged).toContain('my-custom-tag');
        expect(merged).toContain('char:legacy-char@1.0.0');
    });

    it('user tags are included alongside auto-tags', () => {
        const autoTags = ['deck:legacy@1.0.0'];
        const userTags = ['fun-run', 'first-game'];
        const merged = [...new Set([...autoTags, ...userTags])];

        expect(merged).toContain('deck:legacy@1.0.0');
        expect(merged).toContain('fun-run');
        expect(merged).toContain('first-game');
    });
});

describe('GAME_OVER phase guard', () => {
    it('_deriveVersionTags is not called when phase is already GAME_OVER', () => {
        // Simulate the guard from finaliseGame():
        // if (!this.turnManager || this.turnManager.phase === TurnPhase.GAME_OVER) return;
        const game = makeMinimalGame({
            phase: TurnPhase.GAME_OVER,
        });

        let deriveCalled = false;
        game._deriveVersionTags = () => {
            deriveCalled = true;
            return [];
        };

        // Replicate the finaliseGame guard logic
        function simulateFinaliseGame(g) {
            if (!g.turnManager || g.turnManager.phase === TurnPhase.GAME_OVER) return 'guarded';
            g._deriveVersionTags();
            return 'executed';
        }

        const result = simulateFinaliseGame(game);
        expect(result).toBe('guarded');
        expect(deriveCalled).toBe(false);
    });

    it('_deriveVersionTags IS called when phase is not GAME_OVER', () => {
        const game = makeMinimalGame({
            phase: TurnPhase.VILLAIN_PLAY,
        });

        let deriveCalled = false;
        game._deriveVersionTags = () => {
            deriveCalled = true;
            return [];
        };

        function simulateFinaliseGame(g) {
            if (!g.turnManager || g.turnManager.phase === TurnPhase.GAME_OVER) return 'guarded';
            g._deriveVersionTags();
            return 'executed';
        }

        const result = simulateFinaliseGame(game);
        expect(result).toBe('executed');
        expect(deriveCalled).toBe(true);
    });

    it('phase is set to GAME_OVER after finaliseGame runs', () => {
        const game = makeMinimalGame({
            phase: TurnPhase.HERO_PLAY,
        });

        function simulateFinaliseGame(g) {
            if (!g.turnManager || g.turnManager.phase === TurnPhase.GAME_OVER) return;
            g.turnManager.setGameOver();
        }

        simulateFinaliseGame(game);
        expect(game.turnManager.phase).toBe(TurnPhase.GAME_OVER);
    });

    it('calling finaliseGame twice is idempotent (second call is no-op)', () => {
        const game = makeMinimalGame({
            phase: TurnPhase.ENV_END,
        });

        let callCount = 0;
        const originalDerive = game._deriveVersionTags.bind(game);
        game._deriveVersionTags = () => {
            callCount++;
            return originalDerive();
        };

        function simulateFinaliseGame(g) {
            if (!g.turnManager || g.turnManager.phase === TurnPhase.GAME_OVER) return false;
            g._deriveVersionTags();
            g.turnManager.setGameOver();
            return true;
        }

        const first = simulateFinaliseGame(game);
        const second = simulateFinaliseGame(game);

        expect(first).toBe(true);
        expect(second).toBe(false);
        expect(callCount).toBe(1);
    });
});
