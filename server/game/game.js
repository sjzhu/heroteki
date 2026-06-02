// SotMDE: Ashes rules-engine code stripped in Phase 1.
// Constructor shell, getPlayers(), router, and socket-event method stubs retained.
// This file will be substantially rewritten in Phase 3.

const _ = require('underscore');
const EventEmitter = require('events');
const moment = require('moment');

const GameChat = require('./gamechat');
const Player = require('./player');
const Spectator = require('./spectator');
const logger = require('../log');

class Game extends EventEmitter {
    constructor(details, options = {}) {
        super();
        this.gameChat = new GameChat(this);
        this.router = options.router;

        this.allowSpectators = details.allowSpectators;
        this.createdAt = new Date();
        this.gamePrivate = details.gamePrivate;
        this.gameType = details.gameType;
        this.id = details.id;
        this.label = details.label;
        this.manualMode = false;
        this.muteSpectators = details.muteSpectators;
        this.name = details.name;
        this.owner = details.owner.username;
        this.password = details.password;
        this.playersAndSpectators = {};
        this.started = false;
        this.cardData = options.cardData || [];
        this.activePlayer = null;

        _.each(details.players, (player) => {
            this.playersAndSpectators[player.user.username] = new Player(
                player.id,
                player.user,
                this.owner === player.user.username,
                this
            );
        });

        _.each(details.spectators, (spectator) => {
            this.playersAndSpectators[spectator.user.username] = new Spectator(
                spectator.id,
                spectator.user
            );
        });

        this.setMaxListeners(0);
    }

    /*
     * Reports errors from the game engine back to the router
     */
    reportError(e) {
        this.router.handleError(this, e);
    }

    addMessage() {
        this.gameChat.addMessage(...arguments);
    }

    addAlert() {
        this.gameChat.addAlert(...arguments);
    }

    get messages() {
        return this.gameChat.messages;
    }

    isSpectator(player) {
        return player.constructor === Spectator;
    }

    hasActivePlayer(playerName) {
        return this.playersAndSpectators[playerName] && !this.playersAndSpectators[playerName].left;
    }

    getPlayers() {
        return Object.values(this.playersAndSpectators).filter(
            (player) => !this.isSpectator(player)
        );
    }

    getPlayerByName(playerName) {
        let player = this.playersAndSpectators[playerName];
        if (player && !this.isSpectator(player)) {
            return player;
        }
    }

    getPlayersAndSpectators() {
        return this.playersAndSpectators;
    }

    getSpectators() {
        return Object.values(this.playersAndSpectators).filter((player) =>
            this.isSpectator(player)
        );
    }

    getOtherPlayer(player) {
        return this.getPlayers().find((p) => p.name !== player.name);
    }

    // --- Socket event stubs (to be implemented in Phase 3) ---

    chat(playerName, message) {
        let player = this.playersAndSpectators[playerName];
        if (!player) {
            return;
        }
        if (!this.isSpectator(player) || !this.muteSpectators) {
            this.gameChat.addChatMessage('{0} {1}', player, message);
        }
    }

    concede(playerName) {
        logger.info(`Player concede: ${playerName} in game ${this.id}`);
        let player = this.getPlayerByName(playerName);
        if (!player) {
            return;
        }
        this.addAlert('info', '{0} concedes', player);
    }

    selectDeck(playerName, deck) {
        let player = this.getPlayerByName(playerName);
        if (player) {
            player.selectDeck(deck);
        }
    }

    shuffleDeck(playerName) {
        let player = this.getPlayerByName(playerName);
        if (player) {
            player.shuffleDeck();
        }
    }

    watch(socketId, user) {
        if (!this.allowSpectators && !user.permissions.canManageGames) {
            return false;
        }
        this.playersAndSpectators[user.username] = new Spectator(socketId, user);
        this.addAlert('info', '{0} has joined the game as a spectator', user.username);
        return true;
    }

    join(socketId, user) {
        if (this.started || this.getPlayers().length === 2) {
            return false;
        }
        this.playersAndSpectators[user.username] = new Player(
            socketId,
            user,
            this.owner === user.username,
            this
        );
        return true;
    }

    isEmpty() {
        return Object.values(this.playersAndSpectators).every((player) => {
            if (player.left || player.id === 'TBA') {
                return true;
            }
            if (!player.disconnectedAt) {
                return false;
            }
            let difference = moment().diff(moment(player.disconnectedAt), 'minutes');
            return difference > 5;
        });
    }

    leave(playerName) {
        logger.info(`Player leave: ${playerName} in game ${this.id}`);
        let player = this.playersAndSpectators[playerName];
        if (!player) {
            return;
        }
        if (!this.finishedAt) {
            this.concede(playerName);
        }
        this.addAlert('info', '{0} has left the game', player);
        if (this.isSpectator(player) || !this.started) {
            delete this.playersAndSpectators[playerName];
        } else {
            player.left = true;
            if (!this.finishedAt) {
                this.finishedAt = new Date();
            }
        }
    }

    disconnect(playerName) {
        let player = this.playersAndSpectators[playerName];
        if (!player) {
            return;
        }
        if (this.isSpectator(player)) {
            delete this.playersAndSpectators[playerName];
        } else {
            this.addAlert(
                'info',
                '{0} has disconnected. They can reconnect if you wait for them.',
                player
            );
            player.disconnectedAt = new Date();
        }
        player.socket = undefined;
    }

    rematch() {
        if (!this.finishedAt) {
            this.finishedAt = new Date();
            this.winReason = 'rematch';
        }
        this.router.rematch(this);
    }

    failedConnect(playerName) {
        let player = this.playersAndSpectators[playerName];
        if (!player) {
            return;
        }
        if (this.isSpectator(player) || !this.started) {
            delete this.playersAndSpectators[playerName];
        } else {
            this.addAlert('warning', '{0} has failed to connect to the game', player);
            player.disconnectedAt = new Date();
            if (!this.finishedAt) {
                this.finishedAt = new Date();
            }
        }
    }

    reconnect(socket, playerName) {
        let player = this.getPlayerByName(playerName);
        if (!player) {
            return;
        }
        player.id = socket.id;
        player.socket = socket;
        player.disconnectedAt = undefined;
        this.addAlert('info', '{0} has reconnected', player);
    }

    initialise() {
        // Stub — will be rewritten in Phase 3
        let players = {};
        _.each(this.playersAndSpectators, (player) => {
            if (!player.left) {
                players[player.name] = player;
            }
        });
        this.playersAndSpectators = players;
        this.playStarted = true;
        this.startedAt = new Date();
        this.round = 0;
    }

    continue() {
        // Stub — pipeline removed; will be reimplemented in Phase 3
    }

    getSaveState() {
        let players = this.getPlayers().map((player) => ({
            name: player.name,
            wins: player.wins
        }));

        const state = {
            id: this.savedGameId,
            label: this.label,
            gameId: this.id,
            gamePrivate: this.gamePrivate,
            gameType: this.gameType,
            players: players,
            startedAt: this.startedAt,
            finishedAt: this.finishedAt,
            round: this.round,
            winReason: this.winReason,
            winner: this.winner ? this.winner.name : undefined
        };

        try {
            state.chat = this.gameChat.getChatAsText();
        } catch (error) {
            state.chat = 'ERROR:' + error.message;
        }

        return state;
    }

    getSummary(options = {}) {
        let playerSummaries = {};

        for (const player of this.getPlayers()) {
            if (player.left) {
                continue;
            }
            playerSummaries[player.name] = {
                id: player.id,
                left: player.left,
                lobbyId: player.lobbyId,
                name: player.name,
                owner: player.owner,
                user: options.fullData && player.user,
                wins: player.wins,
                deck: player.deckData ? { name: player.deckData.name } : {}
            };
        }

        return {
            allowSpectators: this.allowSpectators,
            createdAt: this.createdAt,
            gamePrivate: this.gamePrivate,
            gameType: this.gameType,
            id: this.id,
            label: this.label,
            manualMode: this.manualMode,
            messages: this.gameChat.messages,
            muteSpectators: this.muteSpectators,
            name: this.name,
            owner: this.owner,
            players: playerSummaries,
            spectators: this.getSpectators().map((spectator) => ({
                id: spectator.id,
                lobbyId: spectator.lobbyId,
                name: spectator.name
            })),
            started: this.started,
            startedAt: this.startedAt,
            finishedAt: this.finishedAt,
            winner: this.winner ? this.winner.name : undefined
        };
    }
}

module.exports = Game;
