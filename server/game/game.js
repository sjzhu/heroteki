// SotMDE Game — server-side game model.
// Rewrites the Ashteki Game class (Phase 3, Step 3.6).
// This file is the central game object. It:
//   - Manages HeroPlayer, VillainController, EnvironmentController, and TurnManager
//   - Handles all socket event commands dispatched by gameserver.js
//   - Persists state to MongoDB (gameStates, gameEvents, gameOutcomes) via monk
//   - Does NOT emit socket events directly; broadcast happens via game.getState()
//     called from gameserver.js's sendGameState()

const _ = require('underscore');
const EventEmitter = require('events');
const moment = require('moment');
const monk = require('monk');
const config = require('config');

const GameChat = require('./gamechat');
const Spectator = require('./spectator');
const logger = require('../log');

const Player = require('./player');
const SotmCard = require('./sotm/SotmCard');
const HeroPlayer = require('./sotm/HeroPlayer');
const VillainController = require('./sotm/VillainController');
const EnvironmentController = require('./sotm/EnvironmentController');
const { TurnManager, TurnPhase } = require('./sotm/TurnManager');
const EVENT_TYPES = require('./sotm/eventTypes');

// Lazy DB connection — only created when needed so tests that don't touch DB work fine
let _db = null;
function getDb() {
    if (!_db) {
        const mongoUrl = process.env.MONGO_URL || config.get('mongo');
        _db = monk(mongoUrl);
    }
    return _db;
}

// Permitted keys for modifyCard updates
const MODIFY_CARD_ALLOWED_KEYS = new Set(['hp', 'maxHp', 'addKeyword', 'removeKeyword', 'token']);

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
        this.muteSpectators = details.muteSpectators;
        this.name = details.name;
        this.owner = details.owner ? details.owner.username : null;
        this.password = details.password;
        this.playersAndSpectators = {};
        this.started = false;
        this.startedAt = null;
        this.finishedAt = null;

        this.heroPlayers = []; // HeroPlayer[]
        this.villain = null; // VillainController
        this.environment = null; // EnvironmentController
        this.turnManager = null; // TurnManager
        this.setupInstructions = null;

        // Populate playersAndSpectators from details
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

        // Store for initialise() — details carries heroOrder, villainDeckId, etc.
        this._details = details;
        this._cardData = options.cardData || {};

        this.setMaxListeners(0);
    }

    /*
     * Reports errors back to the router
     */
    reportError(e) {
        this.router.handleError(this, e);
    }

    // ---- Chat helpers ----

    addMessage() {
        this.gameChat.addMessage(...arguments);
    }

    addAlert() {
        this.gameChat.addAlert(...arguments);
    }

    get messages() {
        return this.gameChat.messages;
    }

    // ---- Player/spectator helpers ----

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

    getPlayerName(actorId) {
        // actorId may be a username (string)
        return actorId || 'unknown';
    }

    // ---- Game lifecycle ----

    watch(socketId, user) {
        if (!this.allowSpectators && !user.permissions.canManageGames) {
            return false;
        }
        this.playersAndSpectators[user.username] = new Spectator(socketId, user);
        this.addAlert('info', '{0} has joined the game as a spectator', user.username);
        return true;
    }

    // eslint-disable-next-line no-unused-vars
    join(socketId, user) {
        if (this.started || this.getPlayers().length >= 8) {
            return false;
        }
        // For SotMDE, players join the lobby layer before game starts;
        // the game node receives them via details.players
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
            this.addAlert('info', '{0} has left the game', player);
        }
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

    rematch() {
        if (!this.finishedAt) {
            this.finishedAt = new Date();
        }
        this.router.rematch(this);
    }

    // No-op stubs expected by gameserver.js
    setWins() {}
    stopClocks() {}
    getPlainTextLog() {
        return [];
    }

    // ---- Initialise from pendingGame details ----

    initialise() {
        // Remove left players, set started
        let players = {};
        _.each(this.playersAndSpectators, (player) => {
            if (!player.left) {
                players[player.name] = player;
            }
        });
        this.playersAndSpectators = players;
        this.started = true;
        this.startedAt = new Date();

        // cardData is passed via options; stored during construction from gameserver.js
        const cardData = this._cardData || {};

        // heroOrder and heroSelection come from the pendingGame's getStartGameDetails()
        const heroOrder = this._details ? this._details.heroOrder || [] : [];
        /* eslint-disable-next-line no-unused-vars */
        const heroSelection = this._details ? this._details.heroSelection || {} : {}; // available for future use
        const villainDeckId = this._details ? this._details.villainDeckId : null;
        const environmentDeckId = this._details ? this._details.environmentDeckId : null;

        // Build HeroPlayers in heroOrder sequence
        this.heroPlayers = heroOrder.map((slot) => {
            const deckId = slot.heroId;
            const controllerPlayerId = slot.controllerPlayerId;
            const playerName = controllerPlayerId;

            // Separate character card from play cards
            const characterCardData = Object.values(cardData).find(
                (cd) => cd.deckId === deckId && cd.type === 'heroCharacter'
            );
            const characterCard = characterCardData ? new SotmCard(characterCardData) : null;

            const playCards = Object.values(cardData)
                .filter((cd) => cd.deckId === deckId && cd.type === 'heroCard')
                .map((cd) => new SotmCard(cd));

            const hero = new HeroPlayer(
                controllerPlayerId,
                playerName,
                deckId,
                playCards,
                characterCard
            );
            // Capture deck version from any card in this deck
            const anyCard =
                characterCardData || Object.values(cardData).find((cd) => cd.deckId === deckId);
            hero.deckVersion = anyCard ? anyCard.version || null : null;

            return hero;
        });

        const H = heroOrder.length;

        // Build VillainController
        if (villainDeckId) {
            const villainCharData = Object.values(cardData).find(
                (cd) => cd.deckId === villainDeckId && cd.type === 'villainCharacter'
            );
            const villainChar = villainCharData ? new SotmCard(villainCharData) : null;
            const villainCards = Object.values(cardData)
                .filter((cd) => cd.deckId === villainDeckId && cd.type === 'villainCard')
                .map((cd) => new SotmCard(cd));

            this.villain = new VillainController(villainDeckId, villainCards, villainChar);
            const anyVCard =
                villainCharData ||
                Object.values(cardData).find((cd) => cd.deckId === villainDeckId);
            this.villain.deckVersion = anyVCard ? anyVCard.version || null : null;
        }

        // Build EnvironmentController
        if (environmentDeckId) {
            const envCards = Object.values(cardData)
                .filter((cd) => cd.deckId === environmentDeckId && cd.type === 'environmentCard')
                .map((cd) => new SotmCard(cd));

            this.environment = new EnvironmentController(environmentDeckId, envCards);
            const anyECard = Object.values(cardData).find((cd) => cd.deckId === environmentDeckId);
            this.environment.deckVersion = anyECard ? anyECard.version || null : null;
        }

        // Wire TurnManager
        this.turnManager = new TurnManager(H, heroOrder, {
            onHeroStart: (slot) => this._onHeroStart(slot),
            // Phase 8.2: push system message to chat log on each phase advance
            onAdvance: (label) => this._pushSystemMessage(label)
        });

        // Shuffle all decks
        for (const hero of this.heroPlayers) {
            hero.shuffleDeck();
        }
        if (this.villain) this.villain.shuffleDeck();
        if (this.environment) this.environment.shuffleDeck();

        // Deal 4 cards to each hero
        for (const hero of this.heroPlayers) {
            hero.drawCard(4);
        }

        // Setup instructions from any deck that has them
        const setupMessages = [];
        for (const hero of this.heroPlayers) {
            const deckCardData = Object.values(cardData).find((cd) => cd.deckId === hero.deckId);
            if (deckCardData && deckCardData.setupInstructions) {
                setupMessages.push(`${hero.deckId}: ${deckCardData.setupInstructions}`);
            }
        }
        if (this.villain) {
            const vcd = Object.values(cardData).find((cd) => cd.deckId === this.villain.deckId);
            if (vcd && vcd.setupInstructions)
                setupMessages.push(`Villain: ${vcd.setupInstructions}`);
        }
        if (this.environment) {
            const ecd = Object.values(cardData).find((cd) => cd.deckId === this.environment.deckId);
            if (ecd && ecd.setupInstructions)
                setupMessages.push(`Environment: ${ecd.setupInstructions}`);
        }
        if (setupMessages.length > 0) {
            this.setupInstructions = setupMessages.join('\n');
            this.gameChat.addMessage(this.setupInstructions);
        }

        this.round = 0;
        this.logEvent(EVENT_TYPES.GAME_SETUP, 'system', {
            heroOrder,
            villainDeckId,
            environmentDeckId,
            H
        });

        // Save initial state (fire-and-forget)
        this.saveState().catch((err) => logger.error('saveState failed on init', err));
    }

    // ---- Turn notification (wired to TurnManager onHeroStart callback) ----

    _onHeroStart(slot) {
        // Wrap in try/catch — a failed notification must never crash a game
        try {
            const notifConfig = config.get('notificationEmail');
            if (!notifConfig || !notifConfig.enabled) return;

            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                host: notifConfig.smtpHost,
                port: notifConfig.smtpPort,
                from: notifConfig.fromAddress
            });

            const playerName = slot.controllerPlayerId;
            const subject = `[SotMDE] It's your turn — ${slot.heroId}`;
            const text = `It is now ${slot.heroId}'s turn in game "${this.name}" (Round ${this.turnManager.round}). Log in to take your turn.`;

            transporter
                .sendMail({
                    from: notifConfig.fromAddress,
                    to: playerName, // best effort; will fail if not an email address
                    subject,
                    text
                })
                .catch((err) => logger.warn('Turn notification email failed:', err));
        } catch (err) {
            logger.warn('Turn notification setup failed:', err);
        }
    }

    // ---- Socket event command handlers ----
    // All handlers accept (playerName, payload) because gameserver.js dispatches as:
    //   game[command](socket.user.username, ...args)

    chat(playerName, message) {
        let player = this.playersAndSpectators[playerName];
        if (!player) return;
        if (!this.isSpectator(player) || !this.muteSpectators) {
            this.gameChat.addChatMessage('{0} {1}', player, message);
        }
    }

    sendMessage(playerName, { text } = {}) {
        if (!text) return;
        this.gameChat.messages.push({
            mid: `chat-${Date.now()}-${Math.random()}`,
            date: new Date(),
            type: 'chat',
            text: `${playerName}: ${text}`,
            message: { 0: `${playerName}: ${text}` }
        });
    }

    advancePhase(playerName) {
        if (!this.turnManager) return;
        if (this.turnManager.phase === TurnPhase.GAME_OVER) return;

        this.turnManager.advance();
        this.logEvent(EVENT_TYPES.PHASE_ADVANCE, playerName, {
            phase: this.turnManager.phase,
            round: this.turnManager.round
        });
        this.saveState().catch((err) => logger.error('saveState failed', err));
    }

    playCard(playerName, { cardId, targetControllerId } = {}) {
        if (!cardId) return;

        // Find the active hero controlled by this player
        const hero = this._findActiveHeroForPlayer(playerName);
        if (!hero) return;

        const card = hero.playCard(cardId);
        if (!card) return;

        let dest = 'play area';

        // Some cards are played directly into another controller's play area.
        if (targetControllerId && card.zone === 'playArea') {
            const target = this._findController(targetControllerId);
            if (target && target !== hero && Array.isArray(target.playArea)) {
                const idx = hero.playArea.findIndex((c) => c.id === card.id);
                if (idx !== -1) {
                    hero.playArea.splice(idx, 1);
                    target.playArea.push(card);
                    dest = `${targetControllerId} play area`;
                }
            }
        }

        this._pushActionMessage(`${playerName}: played ${card.name} → ${dest}`);
        this.logEvent(EVENT_TYPES.PLAY_CARD, playerName, {
            cardId,
            heroId: hero.deckId,
            targetControllerId: targetControllerId || null
        });
        this.saveState().catch((err) => logger.error('saveState failed', err));
    }

    discardCard(playerName, { cardId, zone } = {}) {
        if (!cardId) return;

        const { card } = this._findCardInGame(cardId);
        if (!card) return;

        const cardName = card.name || cardId;
        // Find the controller that holds this card
        this._moveCardToTrash(cardId, zone, playerName);
        this._pushActionMessage(
            `${playerName}: discarded ${cardName} from ${zone || 'unknown zone'}`
        );
        this.logEvent(EVENT_TYPES.DISCARD_CARD, playerName, { cardId, zone });
        this.saveState().catch((err) => logger.error('saveState failed', err));
    }

    moveCard(playerName, { cardId, fromZone, toZone, controllerId } = {}) {
        if (!cardId || !fromZone || !toZone) return;

        // Call clearPlayState when leaving play — but a card moving between
        // play areas stays in play and keeps its tokens/state.
        const { card } = this._findCardInGame(cardId);
        const cardName = card ? card.name || cardId : cardId;
        if (
            card &&
            (fromZone === 'playArea' || fromZone === 'character') &&
            toZone !== 'playArea'
        ) {
            card.clearPlayState();
        }

        this._genericMoveCard(cardId, fromZone, toZone, controllerId);
        this._pushActionMessage(`${playerName}: moved ${cardName} from ${fromZone} → ${toZone}`);
        this.logEvent(EVENT_TYPES.MOVE_CARD, playerName, {
            cardId,
            fromZone,
            toZone,
            controllerId
        });
        this.saveState().catch((err) => logger.error('saveState failed', err));
    }

    shuffleDeck(playerName, { controllerId, zoneId } = {}) {
        const controller = this._findController(controllerId);
        if (!controller) return;

        if (zoneId === 'auxDeck' || zoneId === 'deck' || !zoneId) {
            controller.shuffleDeck();
        }

        this.logEvent(EVENT_TYPES.SHUFFLE_DECK, playerName, { controllerId, zoneId });
        this.saveState().catch((err) => logger.error('saveState failed', err));
    }

    playTopCard(playerName, { controllerId } = {}) {
        const controller = this._findController(controllerId);
        if (!controller || !controller.playTopCard) return;

        const card = controller.playTopCard();
        if (card) {
            this._pushActionMessage(
                `${playerName}: played top card of ${controllerId} — ${card.name}`
            );
        }
        this.logEvent(EVENT_TYPES.PLAY_TOP_CARD, playerName, { controllerId });
        this.saveState().catch((err) => logger.error('saveState failed', err));
    }

    flipVillain(playerName) {
        if (!this.villain) return;
        this.villain.flip();
        this.logEvent(EVENT_TYPES.FLIP_VILLAIN, playerName, { isFlipped: this.villain.isFlipped });
        this.saveState().catch((err) => logger.error('saveState failed', err));
    }

    adjustHp(playerName, { controllerId, delta } = {}) {
        if (delta === undefined) return;

        const controller = this._findController(controllerId);
        if (!controller || typeof controller.adjustHp !== 'function') return;
        if (controller.isIncapacitated) return;

        controller.adjustHp(delta);
        const sign = delta >= 0 ? '+' : '';
        this._pushActionMessage(
            `${playerName}: adjusted HP of ${controllerId} by ${sign}${delta} → ${controller.hp}`
        );
        this.logEvent(EVENT_TYPES.ADJUST_HP, playerName, { controllerId, delta });
        this.saveState().catch((err) => logger.error('saveState failed', err));
    }

    toggleIncapacitate(playerName, { controllerId } = {}) {
        const hero = this.heroPlayers.find((h) => h.deckId === controllerId);
        if (!hero) return;

        if (hero.isIncapacitated) {
            hero.restore();
            this._pushActionMessage(`${playerName}: restored ${controllerId} from incapacitated`);
        } else {
            hero.incapacitate();
            this._pushActionMessage(`${playerName}: incapacitated ${controllerId}`);
        }
        this.logEvent(EVENT_TYPES.TOGGLE_INCAPACITATE, playerName, {
            controllerId,
            isIncapacitated: hero.isIncapacitated
        });
        this.saveState().catch((err) => logger.error('saveState failed', err));
    }

    drawCard(playerName, { heroId, count = 1 } = {}) {
        const hero = this.heroPlayers.find((h) => h.deckId === heroId);
        if (!hero) return;

        hero.drawCard(count, this.logEvent.bind(this));
        this.saveState().catch((err) => logger.error('saveState failed', err));
    }

    modifyCard(playerName, { cardId, controllerId, updates } = {}) {
        if (!cardId || !updates) return;

        // Validate keys
        const invalidKeys = Object.keys(updates).filter((k) => !MODIFY_CARD_ALLOWED_KEYS.has(k));
        if (invalidKeys.length > 0) {
            logger.warn(`modifyCard: invalid update keys: ${invalidKeys.join(', ')}`);
            return;
        }

        const { card } = this._findCardInGame(cardId);
        if (!card) return;

        card.applyUpdates(updates);
        this.logEvent(EVENT_TYPES.MODIFY_CARD, playerName, { cardId, controllerId, updates });
        this.saveState().catch((err) => logger.error('saveState failed', err));
    }

    searchDeck(playerName, { controllerId, zoneId } = {}, socket) {
        const controller = this._findController(controllerId);
        if (!controller) return;

        const deck = controller.deck || [];
        const deckContents = deck.map((c) => c.getSummary());

        this.logEvent(EVENT_TYPES.SEARCH_DECK, playerName, { controllerId, zoneId });

        // Emit only to requesting socket — do not broadcast
        if (socket) {
            socket.send('deckContents', { controllerId, zoneId, cards: deckContents });
        }
        // Note: gameserver.js calls game[command](username, ...args) so socket is not
        // directly available here. The search result will need Phase 7 wiring to send
        // to only the requesting socket. For now, include it in the broadcast state.
    }

    submitGameOver(playerName, { result, notes = '', tags = [] } = {}) {
        if (!this.turnManager || this.turnManager.phase === TurnPhase.GAME_OVER) return;

        this.logEvent(EVENT_TYPES.GAME_OVER, playerName, { result });
        this.finaliseGame(result, notes, tags).catch((err) =>
            logger.error('finaliseGame failed', err)
        );
    }

    // eslint-disable-next-line no-unused-vars
    initiateGameOver(playerName) {
        // Broadcast gameOverPrompt to all connected clients via gameserver.js
        // gameserver.js reads this flag after the handler returns and emits the event
        this._pendingBroadcast = { type: 'gameOverPrompt' };
    }

    // eslint-disable-next-line no-unused-vars
    cancelGameOver(playerName) {
        // Broadcast gameOverCancelled to all connected clients
        this._pendingBroadcast = { type: 'gameOverCancelled' };
        this.gameChat.addMessage('Game over cancelled.');
    }

    endSession(playerName) {
        this.logEvent(EVENT_TYPES.SESSION_END, playerName, { result: 'abandoned' });
        this.finaliseGame('abandoned', '', []).catch((err) =>
            logger.error('finaliseGame failed on endSession', err)
        );
    }

    // Kept for Ashteki compatibility
    concede(playerName) {
        logger.info(`Player concede (treated as endSession): ${playerName} in game ${this.id}`);
        this.endSession(playerName);
    }

    // eslint-disable-next-line no-unused-vars
    selectDeck(playerName, deck) {
        // no-op in SotMDE; deck selection happens in lobby
    }

    continue() {
        // no-op — pipeline removed
    }

    // ---- Core async methods ----

    /**
     * Serialize state per-player.
     * Called by gameserver.js sendGameState via GameStateWriter.getStateForPlayer.
     */
    getState(forPlayerName) {
        const tm = this.turnManager;

        return {
            gameId: this.id,
            round: tm ? tm.round : 0,
            phase: tm ? tm.phase : 'setup',
            H: tm ? tm.H : 0,
            activeHeroId: tm ? tm.activeHeroId : null,
            activeControllerPlayerId: tm ? tm.activeControllerPlayerId : null,
            villain: this.villain ? this.villain.getState() : null,
            environment: this.environment ? this.environment.getState() : null,
            heroes: this.heroPlayers.map((h) => h.getState(forPlayerName)),
            chatLog: this.gameChat.messages,
            setupInstructions:
                this.turnManager && this.turnManager.phase === 'setup'
                    ? this.setupInstructions
                    : null,
            isGameOver: tm ? tm.phase === TurnPhase.GAME_OVER : false
        };
    }

    /**
     * Persist full game state to MongoDB gameStates collection.
     * Fire-and-forget from all mutation paths.
     */
    async saveState() {
        try {
            const db = getDb();
            const gameStates = db.get('gameStates');

            // Serialize to plain JSON
            const state = JSON.stringify(this.getState(null));

            await gameStates.update(
                { gameId: this.id },
                {
                    $set: {
                        gameId: this.id,
                        updatedAt: new Date(),
                        state,
                        lastActivityAt: this.turnManager
                            ? this.turnManager.lastActivityAt
                            : new Date()
                    }
                },
                { upsert: true }
            );
        } catch (err) {
            logger.error('saveState failed', err);
        }
    }

    /**
     * Load game state from MongoDB and rehydrate.
     * Called by game node when a player reconnects with no in-memory game.
     * @param {string} gameId
     */
    async loadState(gameId) {
        try {
            const db = getDb();
            const gameStates = db.get('gameStates');
            const doc = await gameStates.findOne({ gameId });
            if (!doc) {
                logger.warn(`loadState: no persisted state found for game ${gameId}`);
                return false;
            }

            // Parse JSON state — note: full rehydration of SotmCard objects etc.
            // is complex; for Phase 3 we store parsed state for reference.
            // Full rehydration will be completed in Phase 7.
            logger.info(`loadState: found persisted state for game ${gameId}`);
            return true;
        } catch (err) {
            logger.error('loadState failed', err);
            return false;
        }
    }

    /**
     * Insert one event document to gameEvents (fire-and-forget).
     */
    logEvent(eventType, actorId, payload) {
        try {
            const db = getDb();
            const gameEvents = db.get('gameEvents');
            const tm = this.turnManager;

            gameEvents
                .insert({
                    gameId: this.id,
                    round: tm ? tm.round : 0,
                    phase: tm ? tm.phase : 'setup',
                    timestamp: new Date(),
                    actorId,
                    actorName: this.getPlayerName(actorId),
                    eventType,
                    payload
                })
                .catch((err) => logger.error('gameEvents insert failed', err));
        } catch (err) {
            logger.error('logEvent setup failed', err);
        }
    }

    /**
     * Count the number of events of a given type for a player in this game.
     * Used by finaliseGame() to populate cardsPlayed on each hero.
     * @param {string} playerId - actor id (socket user id)
     * @param {string} eventType - one of EVENT_TYPES values
     * @returns {Promise<number>}
     */
    async countEventsForPlayer(playerId, eventType) {
        try {
            const db = getDb();
            const gameEvents = db.get('gameEvents');
            const count = await gameEvents.count({ gameId: this.id, actorId: playerId, eventType });
            return count;
        } catch (err) {
            logger.error('countEventsForPlayer failed', err);
            return 0;
        }
    }

    /**
     * Finalize the game: write to gameOutcomes, set GAME_OVER phase, broadcast.
     */
    async finaliseGame(result, notes, tags) {
        if (!this.turnManager || this.turnManager.phase === TurnPhase.GAME_OVER) return;

        try {
            const autoTags = this._deriveVersionTags();
            const mergedTags = [...new Set([...autoTags, ...(tags || [])])];

            const db = getDb();
            const gameOutcomes = db.get('gameOutcomes');

            await gameOutcomes.insert({
                gameId: this.id,
                startedAt: this.startedAt,
                endedAt: new Date(),
                durationMinutes: this.startedAt
                    ? Math.round((Date.now() - this.startedAt) / 60000)
                    : 0,
                rounds: this.turnManager ? this.turnManager.round : 0,
                result,
                villainDeckId: this.villain ? this.villain.deckId : null,
                villainDeckVersion: this.villain ? this.villain.deckVersion : null,
                villainCharacterVersion:
                    this.villain && this.villain.characterCard
                        ? this.villain.characterCard.version || null
                        : null,
                villainFinalHp: this.villain ? this.villain.hp : null,
                villainWasFlipped: this.villain ? this.villain.isFlipped : false,
                environmentDeckId: this.environment ? this.environment.deckId : null,
                environmentDeckVersion: this.environment ? this.environment.deckVersion : null,
                heroes: await Promise.all(
                    this.heroPlayers.map(async (h) => ({
                        playerId: h.id,
                        playerName: h.name,
                        heroDeckId: h.deckId,
                        heroDeckVersion: h.deckVersion,
                        heroCharacterVersion: h.characterCard
                            ? h.characterCard.version || null
                            : null,
                        finalHp: h.hp,
                        wasIncapacitated: h.isIncapacitated,
                        cardsPlayed: await this.countEventsForPlayer(h.id, EVENT_TYPES.PLAY_CARD)
                    }))
                ),
                notes,
                tags: mergedTags
            });
        } catch (err) {
            logger.error('finaliseGame DB write failed', err);
        }

        // Set phase to GAME_OVER regardless of DB success
        this.turnManager.setGameOver();
        this.finishedAt = new Date();

        this.saveState().catch((err) => logger.error('saveState on finalise failed', err));
    }

    /**
     * Derive auto-tags for all decks/characters in the game.
     */
    _deriveVersionTags() {
        const tags = [];
        for (const hero of this.heroPlayers) {
            if (hero.deckVersion) tags.push(`deck:${hero.deckId}@${hero.deckVersion}`);
            if (hero.characterCard && hero.characterCard.version) {
                tags.push(`char:${hero.characterCard.id}@${hero.characterCard.version}`);
            }
        }
        if (this.villain) {
            if (this.villain.deckVersion)
                tags.push(`deck:${this.villain.deckId}@${this.villain.deckVersion}`);
            if (this.villain.characterCard && this.villain.characterCard.version) {
                tags.push(
                    `char:${this.villain.characterCard.id}@${this.villain.characterCard.version}`
                );
            }
        }
        if (this.environment && this.environment.deckVersion) {
            tags.push(`deck:${this.environment.deckId}@${this.environment.deckVersion}`);
        }
        return tags;
    }

    // ---- Chat log helpers (Phase 8.2, 8.3) ----

    /**
     * Push a system message (phase transitions, server notices) to the chat log.
     * @param {string} text
     */
    _pushSystemMessage(text) {
        this.gameChat.messages.push({
            mid: `sys-${Date.now()}-${Math.random()}`,
            date: new Date(),
            type: 'system',
            text,
            message: { 0: text }
        });
    }

    /**
     * Push an action message (card moves, HP changes) to the chat log.
     * @param {string} text
     */
    _pushActionMessage(text) {
        this.gameChat.messages.push({
            mid: `act-${Date.now()}-${Math.random()}`,
            date: new Date(),
            type: 'action',
            text,
            message: { 0: text }
        });
    }

    // ---- Internal helpers ----

    /**
     * Find the active hero controlled by playerName.
     * If turnManager is in a HERO phase, only that hero is "active".
     * Otherwise, find any hero whose controllerPlayerId === playerName.
     */
    _findActiveHeroForPlayer(playerName) {
        if (this.turnManager && this.turnManager.activeHeroId) {
            const activeHero = this.heroPlayers.find(
                (h) => h.deckId === this.turnManager.activeHeroId
            );
            if (activeHero && activeHero.id === playerName) {
                return activeHero;
            }
        }
        // Fallback: any hero controlled by this player
        return this.heroPlayers.find((h) => h.id === playerName);
    }

    /**
     * Find a controller by id string ('villain', 'environment', or hero deckId).
     */
    _findController(controllerId) {
        if (!controllerId) return null;
        if (controllerId === 'villain' || (this.villain && controllerId === this.villain.deckId)) {
            return this.villain;
        }
        if (
            controllerId === 'environment' ||
            (this.environment && controllerId === this.environment.deckId)
        ) {
            return this.environment;
        }
        return (
            this.heroPlayers.find((h) => h.deckId === controllerId || h.id === controllerId) || null
        );
    }

    /**
     * Search all zones for a card by id.
     * Returns { card, controller, zone }.
     */
    _findCardInGame(cardId) {
        // Hero zones
        for (const hero of this.heroPlayers) {
            for (const zone of ['hand', 'deck', 'trash', 'playArea']) {
                const card = hero[zone].find((c) => c.id === cardId);
                if (card) return { card, controller: hero, zone };
            }
            if (hero.characterCard && hero.characterCard.id === cardId) {
                return { card: hero.characterCard, controller: hero, zone: 'character' };
            }
        }
        // Villain zones
        if (this.villain) {
            for (const zone of ['deck', 'trash', 'playArea']) {
                const card = this.villain[zone].find((c) => c.id === cardId);
                if (card) return { card, controller: this.villain, zone };
            }
            if (this.villain.characterCard && this.villain.characterCard.id === cardId) {
                return {
                    card: this.villain.characterCard,
                    controller: this.villain,
                    zone: 'character'
                };
            }
        }
        // Environment zones
        if (this.environment) {
            for (const zone of ['deck', 'trash', 'playArea']) {
                const card = this.environment[zone].find((c) => c.id === cardId);
                if (card) return { card, controller: this.environment, zone };
            }
        }
        return { card: null, controller: null, zone: null };
    }

    /**
     * Move a card from one zone to trash within its controller.
     */
    // eslint-disable-next-line no-unused-vars
    _moveCardToTrash(cardId, fromZone, playerName) {
        for (const hero of this.heroPlayers) {
            if (hero.discardCard(cardId, fromZone)) return;
        }
        if (this.villain && this.villain.discardFromPlay && fromZone === 'playArea') {
            this.villain.discardFromPlay(cardId);
            return;
        }
        if (this.environment && fromZone === 'playArea') {
            this.environment.discardFromPlay(cardId);
        }
    }

    /**
     * Generic zone-to-zone card move.
     * Supports moving within the same controller or between controllers.
     */
    _genericMoveCard(cardId, fromZone, toZone, controllerId) {
        const { card, controller } = this._findCardInGame(cardId);
        if (!card || !controller) return;

        const sourceArr = controller[fromZone];
        if (!Array.isArray(sourceArr)) return;
        const idx = sourceArr.findIndex((c) => c.id === cardId);
        if (idx === -1) return;

        // Determine destination controller
        let destController = controller;
        if (controllerId) {
            destController = this._findController(controllerId) || controller;
        }

        // Validate the destination zone exists BEFORE removing from source —
        // villain/environment controllers have no hand, and removing first
        // would silently delete the card from the game.
        const destArr = destController[toZone];
        if (!Array.isArray(destArr)) return;

        sourceArr.splice(idx, 1);
        card.zone = toZone;
        destArr.push(card);
    }

    // ---- Compatibility methods for gameserver.js ----

    getSaveState() {
        return {
            id: this.id,
            gameId: this.id,
            gamePrivate: this.gamePrivate,
            gameType: this.gameType,
            label: this.label,
            players: this.getPlayers().map((p) => ({ name: p.name, wins: p.wins || 0 })),
            startedAt: this.startedAt,
            finishedAt: this.finishedAt,
            round: this.turnManager ? this.turnManager.round : 0
        };
    }

    // eslint-disable-next-line no-unused-vars
    getSummary(options = {}) {
        let playerSummaries = {};

        for (const player of this.getPlayers()) {
            if (player.left) continue;
            playerSummaries[player.name] = {
                id: player.id,
                left: player.left,
                lobbyId: player.lobbyId,
                name: player.name,
                owner: player.owner,
                wins: player.wins || 0
            };
        }

        return {
            allowSpectators: this.allowSpectators,
            createdAt: this.createdAt,
            gamePrivate: this.gamePrivate,
            gameType: this.gameType,
            id: this.id,
            label: this.label,
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
            finishedAt: this.finishedAt
        };
    }
}

module.exports = Game;
