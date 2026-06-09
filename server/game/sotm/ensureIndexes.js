// SotMDE: ensureIndexes.js — create MongoDB indexes for game logging collections.
// Phase 8.5.1.
// Called once at game server startup (gameserver.js), not per-game.
// Uses the monk API: db.get('collection').createIndex(spec, opts).

const logger = require('../../log');

/**
 * Create all required indexes for SotMDE game logging collections.
 * Fire-and-forget; errors are logged but do not crash startup.
 * @param {import('monk').Manager} db - monk DB instance
 */
async function ensureIndexes(db) {
    try {
        const gameEvents = db.get('gameEvents');
        const gameOutcomes = db.get('gameOutcomes');
        const gameStates = db.get('gameStates');

        // gameEvents indexes
        await gameEvents.createIndex(
            { gameId: 1, round: 1, timestamp: 1 },
            { background: true, name: 'gameId_round_timestamp' }
        );
        await gameEvents.createIndex(
            { gameId: 1, eventType: 1 },
            { background: true, name: 'gameId_eventType' }
        );

        // gameOutcomes indexes
        await gameOutcomes.createIndex(
            { villainDeckId: 1, result: 1 },
            { background: true, name: 'villainDeckId_result' }
        );
        await gameOutcomes.createIndex(
            { 'heroes.heroDeckId': 1, result: 1 },
            { background: true, name: 'heroes_heroDeckId_result' }
        );
        await gameOutcomes.createIndex(
            { villainDeckId: 1, villainDeckVersion: 1, result: 1 },
            { background: true, name: 'villainDeckId_version_result' }
        );
        await gameOutcomes.createIndex({ endedAt: 1 }, { background: true, name: 'endedAt' });

        // gameStates indexes
        await gameStates.createIndex(
            { gameId: 1 },
            { unique: true, background: true, name: 'gameId_unique' }
        );

        logger.info('SotMDE: MongoDB indexes ensured for gameEvents, gameOutcomes, gameStates');
    } catch (err) {
        logger.error('SotMDE: ensureIndexes failed', err);
    }
}

module.exports = { ensureIndexes };
