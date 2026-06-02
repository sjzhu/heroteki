// STUBBED: will be rewritten in Phase 7
class GameStateWriter {
    constructor(game) { this.game = game; }
    getStateForPlayer() { return { id: this.game.id, started: false }; }
    getStateForReplay() { return {}; }
    getState() { return { id: this.game.id, started: false }; }
}
module.exports = GameStateWriter;
