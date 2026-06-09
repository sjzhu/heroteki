// SotMDE: Ashes-specific logic stripped in Phase 1.
// Retains zone arrays (hand, deck, discard, cardsInPlay), HP-like counters,
// and a minimal getState() serialiser.
// This file will be substantially rewritten / replaced in Phase 3.

const _ = require('underscore');
const moment = require('moment');

class Player {
    constructor(id, user, owner, game) {
        this.game = game;
        this.user = user;
        this.role = user.role;
        this.avatar = user.avatar;
        this.optionSettings = user.settings ? user.settings.optionSettings : {};

        this.id = id;
        this.owner = owner;

        // Zone arrays
        this.hand = [];
        this.deck = [];
        this.cardsInPlay = [];
        this.discard = [];

        // HP-like counters
        this.wins = 0;

        this.deckData = {};
        this.firstPlayer = false;
        this.left = false;
        this.socket = undefined;
        this.lobbyId = undefined;
        this.disconnectedAt = undefined;
        this.showDeck = false;

        this.promptState = { getState: () => ({}) };
        this.inspectionCard = null;
    }

    get name() {
        return this.user.username;
    }

    get type() {
        return 'player';
    }

    get isDummy() {
        return false;
    }

    get isAwol() {
        let difference = moment().diff(moment(this.disconnectedAt), 'minutes');
        return difference > 3;
    }

    isSpectator() {
        return false;
    }

    get deckIsEmpty() {
        return this.deck.length === 0;
    }

    shuffleDeck() {
        this.deck = _.shuffle(this.deck);
    }

    selectDeck(deckData) {
        this.deckData = deckData;
        this.deckData.selected = true;
    }

    setWins(wins) {
        this.wins = wins;
    }

    initialise() {
        this.opponent = this.game.getOtherPlayer(this);
    }

    currentPrompt() {
        return this.promptState.getState();
    }

    inspectCard(card) {
        this.inspectionCard = card;
    }

    clearInspector() {
        this.inspectionCard = null;
    }

    // eslint-disable-next-line no-unused-vars
    getState(activePlayer) {
        let cardSummary = (card) => {
            if (!card || typeof card !== 'object') return card;
            if (typeof card.getSummary === 'function') return card.getSummary();
            return { name: card.name, id: card.id };
        };

        return {
            id: this.id,
            name: this.name,
            owner: this.owner,
            left: this.left,
            wins: this.wins,
            deckData: this.deckData ? { name: this.deckData.name } : {},
            hand: this.hand.map(cardSummary),
            deck: this.deck.length,
            discard: this.discard.map(cardSummary),
            cardsInPlay: this.cardsInPlay.map(cardSummary),
            promptState: this.promptState.getState()
        };
    }
}

module.exports = Player;
