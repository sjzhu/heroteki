// SotMDE GameStateWriter — bridges game.getState() to socket emission.
// Phase 7 will finalize this; for now it delegates to game.getState() directly.
class GameStateWriter {
    constructor(game) {
        this.game = game;
    }

    /**
     * Serialize state for a specific player (hands are hidden for others).
     * @param {import('../game/player')} player
     */
    getStateForPlayer(player) {
        if (typeof this.game.getState === 'function') {
            return this.game.getState(player.name);
        }
        return { id: this.game.id, started: false };
    }

    getStateForReplay() {
        if (typeof this.game.getState === 'function') {
            return this.game.getState(null);
        }
        return {};
    }

    getState(userName) {
        if (typeof this.game.getState === 'function') {
            return this.game.getState(userName || null);
        }
        return { id: this.game.id, started: false };
    }
}
module.exports = GameStateWriter;
