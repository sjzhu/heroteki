/**
 * SotMDE GameStateWriter — bridges game.getState() to socket emission.
 *
 * game.getState(forPlayerName) returns the full broadcast state shape:
 * {
 *   gameId:                    string,
 *   round:                     number,
 *   phase:                     TurnPhase,
 *   H:                         number,           // fixed; number of hero decks
 *   activeHeroId:              string | null,    // heroId whose turn it is; null during villain/env phases
 *   activeControllerPlayerId:  string | null,    // socket user id in control; null during villain/env phases
 *   villain:                   VillainState,     // all zones fully visible
 *   environment:               EnvironmentState, // all zones fully visible
 *   heroes:                    HeroState[],      // in heroOrder sequence;
 *                                                // hand visible only to that hero's controllerPlayerId
 *                                                // (one user may control multiple heroes)
 *   chatLog:                   ChatMessage[],
 *   setupInstructions:         string | null,    // non-null only during SETUP phase
 *   isGameOver:                boolean,
 * }
 *
 * Serialisation is player-specific: call getStateForPlayer(player) per socket.
 * Spectators and replay calls use getStateForReplay() which passes null so all
 * hands are treated as hidden.
 */
class GameStateWriter {
    constructor(game) {
        this.game = game;
    }

    getStateForPlayer(player) {
        return this.game.getState(player.name);
    }

    getStateForReplay() {
        return this.game.getState(null);
    }

    getState(userName) {
        return this.game.getState(userName || null);
    }
}

module.exports = GameStateWriter;
