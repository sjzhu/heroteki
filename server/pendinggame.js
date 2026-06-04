const uuid = require('uuid');
const _ = require('underscore');
const crypto = require('crypto');

const GameChat = require('./game/gamechat.js');
const logger = require('./log');
const PendingPlayer = require('./models/PendingPlayer.js');
const DummyUser = require('./models/DummyUser.js');
const { GameTypes } = require('./constants.js');

class PendingGame {
    constructor(owner, details) {
        this.newGameType = details.newGameType;
        this.gameFormat = details.gameFormat;
        this.allowSpectators = details.allowSpectators;
        this.saveReplay = false; // replay system disabled in Phase 1
        this.createdAt = new Date();
        this.startedAt = null;
        this.finishedAt = null;
        this.gamePrivate = !!details.gamePrivate; // hides from game list
        this.gameType = details.ranked ? 'competitive' : 'casual';
        this.id = uuid.v1();
        this.label = details.label;
        this.muteSpectators = details.muteSpectators;
        this.name = details.name;
        this.node = {};
        this.owner = owner;
        this.players = {};
        this.showHand = details.showHand;
        this.openHands = details.openHands;
        this.spectators = {};
        this.started = false;
        this.swap = !!details.swap;
        this.rematch = false;

        this.useGameTimeLimit = details.useGameTimeLimit;
        this.gameTimeLimit = details.gameTimeLimit;
        this.clockType = details.clockType;

        this.gameChat = new GameChat(this);

        // SotMDE-specific fields
        this.villainDeckId = details.villainDeckId || null;
        this.environmentDeckId = details.environmentDeckId || null;
        // heroSelection: { [playerName]: deckId[] } — each player may claim 1+ hero decks
        this.heroSelection = {};
        // heroOrder: [{ heroId (=deckId), controllerPlayerId (=playerName) }] — in turn order
        this.heroOrder = [];
    }

    // Getters
    getPlayersAndSpectators() {
        return Object.assign({}, this.players, this.spectators);
    }

    getPlayers() {
        return this.players;
    }

    getSpectators() {
        return Object.values(this.spectators);
    }

    getPlayerOrSpectator(playerName) {
        return this.getPlayersAndSpectators()[playerName];
    }

    getPlayerByName(playerName) {
        return this.players[playerName];
    }

    getOtherPlayer(thisPlayerName) {
        for (const [key, value] of Object.entries(this.players)) {
            if (key !== thisPlayerName) {
                return value;
            }
        }
        return null;
    }

    getSaveState() {
        let players = _.map(this.getPlayers(), (player) => {
            return {
                name: player.name,
                wins: player.wins
            };
        });

        return {
            id: this.id,
            gamePrivate: this.gamePrivate,
            gameId: this.id,
            gameType: this.gameType,
            label: this.label,
            players: players,
            startedAt: this.createdAt,
            swap: this.swap
        };
    }

    // Actions
    addMessage() {
        this.gameChat.addMessage(...arguments);
    }

    addPlayer(id, user) {
        if (!user) {
            logger.error('Tried to add a player to a game that did not have a user object');
            return;
        }

        const isOwner = this.owner.username === user.username;
        this.players[user.username] = new PendingPlayer(id, user.username, isOwner, user);
    }

    addSpectator(id, user) {
        this.spectators[user.username] = {
            id: id,
            name: user.username,
            user: user
        };
    }

    isSpectator(username) {
        return !!this.spectators[username];
    }

    newGame(id, user, password, join) {
        if (password) {
            this.password = crypto.createHash('md5').update(password).digest('hex');
        }

        if (join) {
            this.addPlayer(id, user);
        }
    }

    isUserBlocked(user) {
        return _.contains(this.owner.blockList, user.username.toLowerCase());
    }

    join(id, user, password) {
        // SotMDE: removed 2-player hard cap; game is ready when allHeroesSelected()
        if (this.started) {
            return 'Game already started';
        }

        if (this.isUserBlocked(user)) {
            return 'Cannot join game';
        }

        if (this.password) {
            if (crypto.createHash('md5').update(password).digest('hex') !== this.password) {
                return 'Incorrect game password';
            }
        }

        this.addMessage('{0} has joined the game', user.username);
        this.addPlayer(id, user);

        if (!this.isOwner(this.owner.username)) {
            let otherPlayer = Object.values(this.players).find(
                (player) => player.name !== this.owner.username
            );

            if (otherPlayer) {
                this.owner = otherPlayer.user;
                otherPlayer.owner = true;
            }
        }

        return undefined;
    }

    watch(id, user, password) {
        if (user && user.permissions && user.permissions.canManageGames) {
            this.addSpectator(id, user);
            this.addMessage('{0} has joined the game as a spectator', user.username);

            return;
        }

        if (!this.allowSpectators) {
            return 'Join not permitted';
        }

        if (this.isUserBlocked(user)) {
            return 'Cannot join game';
        }

        if (this.password) {
            if (crypto.createHash('md5').update(password).digest('hex') !== this.password) {
                return 'Incorrect game password';
            }
        }

        this.addSpectator(id, user);
        this.addMessage('{0} has joined the game as a spectator', user.username);
    }

    leave(playerName) {
        let player = this.getPlayerOrSpectator(playerName);
        if (!player) {
            return;
        }

        if (!this.started) {
            this.addMessage('{0} has left the game', playerName);
        }

        if (this.players[playerName]) {
            if (this.started) {
                this.players[playerName].left = true;
            } else {
                this.removeAndResetOwner(playerName);

                delete this.players[playerName];
            }
        }

        if (this.spectators[playerName]) {
            delete this.spectators[playerName];
        }
    }

    disconnect(playerName) {
        let player = this.getPlayerOrSpectator(playerName);
        if (!player) {
            return;
        }

        if (!this.started) {
            this.addMessage('{0} has disconnected', playerName);
        }

        if (this.players[playerName]) {
            if (!this.started) {
                this.removeAndResetOwner(playerName);

                delete this.players[playerName];
            }
        } else {
            delete this.spectators[playerName];
        }
    }

    removeDummy() {
        delete this.players[DummyUser.DUMMY_USERNAME];
    }

    chat(playerName, message) {
        let player = this.getPlayerOrSpectator(playerName);
        if (!player) {
            return;
        }

        player.argType = 'player';

        this.addMessage('{0} {1}', player, message);
    }

    // ---- SotMDE hero deck selection methods ----

    /**
     * Claim a hero deck for a player.
     * @param {string} playerName
     * @param {string} deckId
     * @returns {string|undefined} error message, or undefined on success
     */
    addHeroDeck(playerName, deckId) {
        // Check not already claimed by another player
        for (const [pName, deckIds] of Object.entries(this.heroSelection)) {
            if (pName !== playerName && deckIds.includes(deckId)) {
                return `Hero deck ${deckId} is already claimed by ${pName}`;
            }
        }

        if (!this.heroSelection[playerName]) {
            this.heroSelection[playerName] = [];
        }

        if (!this.heroSelection[playerName].includes(deckId)) {
            this.heroSelection[playerName].push(deckId);
        }

        return undefined;
    }

    /**
     * Release a hero deck for a player.
     * @param {string} playerName
     * @param {string} deckId
     */
    removeHeroDeck(playerName, deckId) {
        if (!this.heroSelection[playerName]) return;
        this.heroSelection[playerName] = this.heroSelection[playerName].filter(id => id !== deckId);
        if (this.heroSelection[playerName].length === 0) {
            delete this.heroSelection[playerName];
        }
    }

    /**
     * Set the final hero turn order.
     * orderedDeckIds must be a permutation of all selected hero deckIds.
     * @param {string[]} orderedDeckIds
     * @returns {string|undefined} error message, or undefined on success
     */
    setHeroOrder(orderedDeckIds) {
        // Build complete set of all selected deckIds
        const allSelected = [];
        for (const deckIds of Object.values(this.heroSelection)) {
            allSelected.push(...deckIds);
        }

        // Validate: must be a permutation
        if (orderedDeckIds.length !== allSelected.length) {
            return 'heroOrder length does not match total selected hero decks';
        }
        for (const id of allSelected) {
            if (!orderedDeckIds.includes(id)) {
                return `Hero deck ${id} is missing from the hero order`;
            }
        }

        // Build heroOrder — map each deckId back to its controller player
        const deckToPlayer = {};
        for (const [pName, deckIds] of Object.entries(this.heroSelection)) {
            for (const deckId of deckIds) {
                deckToPlayer[deckId] = pName;
            }
        }

        this.heroOrder = orderedDeckIds.map(deckId => ({
            heroId: deckId,
            controllerPlayerId: deckToPlayer[deckId]
        }));

        return undefined;
    }

    /**
     * Returns true when the game is ready to start from a SotMDE standpoint:
     * every player has at least one hero selected, villain and environment are set,
     * and heroOrder has been locked in.
     */
    allHeroesSelected() {
        const playerNames = Object.keys(this.players);
        if (playerNames.length === 0) return false;

        // Every player must have at least one hero selection
        for (const pName of playerNames) {
            if (!this.heroSelection[pName] || this.heroSelection[pName].length === 0) {
                return false;
            }
        }

        if (!this.villainDeckId || !this.environmentDeckId) return false;
        if (this.heroOrder.length === 0) return false;

        return true;
    }

    selectDeck(playerName, deck, forOpponent) {
        var player = forOpponent
            ? this.getOtherPlayer(playerName)
            : this.getPlayerByName(playerName);
        if (!player) {
            return;
        }

        if (player.deck) {
            player.deck.selected = false;
        }

        player.deck = deck;
        player.deck.selected = true;
    }

    // interrogators
    isEmpty() {
        return !_.any(this.getPlayersAndSpectators(), (player) =>
            this.hasActivePlayer(player.name)
        );
    }

    isOwner(playerName) {
        let player = this.players[playerName];

        if (!player || !player.owner) {
            return false;
        }

        return true;
    }

    removeAndResetOwner(playerName) {
        if (this.isOwner(playerName)) {
            let otherPlayer = _.find(this.players, (player) => player.name !== playerName);

            if (otherPlayer) {
                this.owner = otherPlayer.user;
                otherPlayer.owner = true;
            }
        }
    }

    hasActivePlayer(playerName) {
        return (
            (this.players[playerName] &&
                !this.players[playerName].left &&
                !this.players[playerName].disconnected &&
                !this.players[playerName].isDummy) ||
            this.spectators[playerName]
        );
    }

    isVisibleFor(user) {
        if (!user) {
            return true;
        }

        if (user.permissions && user.permissions.canManageGames) {
            return true;
        }

        let players = Object.values(this.players);
        return (
            !this.owner.hasUserBlocked(user) &&
            !user.hasUserBlocked(this.owner) &&
            players.every((player) => !player.user.hasUserBlocked(user))
        );
    }

    // Summary
    getSummary(activePlayer) {
        let playerSummaries = {};
        let playersInGame = _.filter(this.players, (player) => !player.left);

        _.each(playersInGame, (player) => {
            let deck = {};
            if (player.deck) {
                deck = {
                    selected: player.deck.selected,
                    name: player.deck.name || null
                };
            }

            playerSummaries[player.name] = {
                avatar: player.user.avatar,
                deck: deck,
                id: player.id,
                left: player.left,
                name: player.name,
                owner: player.owner,
                role: player.user.role,
                wins: player.wins,
                faveColor: player.user.faveColor,
                gamesPlayed: player.user.gamesPlayed ? player.user.gamesPlayed : 0,
                eloRating: player.user.eloRating
            };
        });

        return {
            allowSpectators: this.allowSpectators,
            createdAt: this.createdAt,
            finishedAt: this.finishedAt,
            gameFormat: this.gameFormat,
            gamePrivate: this.gamePrivate,
            gameType: this.gameType,
            gameTimeLimit: this.gameTimeLimit,
            id: this.id,
            label: this.label,
            messages: activePlayer ? this.gameChat.messages : undefined,
            muteSpectators: this.muteSpectators,
            name: this.name,
            needsPassword: !!this.password,
            newGameType: this.newGameType,
            node: this.node ? this.node.identity : undefined,
            owner: this.owner.username,
            players: playerSummaries,
            showHand: this.showHand,
            openHands: this.openHands,
            started: this.started,
            swap: this.swap,
            spectators: Object.values(this.spectators).map((spectator) => {
                return {
                    id: spectator.id,
                    name: spectator.name,
                    avatar: spectator.user.avatar
                };
            }),
            startedAt: this.startedAt,
            useGameTimeLimit: this.useGameTimeLimit,
            clockType: this.clockType,
            saveReplay: this.saveReplay
        };
    }

    getStartGameDetails() {
        const players = {};

        for (let playerDetails of Object.values(this.players)) {
            const { name, user, ...rest } = playerDetails;
            players[name] = {
                name,
                user: user.getDetails(),
                ...rest
            };
        }

        const spectators = {};
        for (let spectatorDetails of Object.values(this.spectators)) {
            const { name, user, ...rest } = spectatorDetails;
            spectators[name] = {
                name,
                user: user.getDetails(),
                ...rest
            };
        }

        return {
            allowSpectators: this.allowSpectators,
            saveReplay: this.saveReplay,
            createdAt: this.createdAt,
            gameFormat: this.gameFormat,
            gamePrivate: this.gamePrivate,
            gameTimeLimit: this.gameTimeLimit,
            gameType: this.gameType,
            id: this.id,
            label: this.label,
            muteSpectators: this.muteSpectators,
            name: this.name,
            needsPassword: !!this.password,
            owner: this.owner.getDetails(),
            players,
            showHand: this.showHand,
            openHands: this.openHands,
            spectators,
            started: this.started,
            swap: this.swap,
            useGameTimeLimit: this.useGameTimeLimit,
            clockType: this.clockType,
            // SotMDE fields
            villainDeckId: this.villainDeckId,
            environmentDeckId: this.environmentDeckId,
            heroSelection: this.heroSelection,
            heroOrder: this.heroOrder,
        };
    }
}

module.exports = PendingGame;
