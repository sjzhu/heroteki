// SotMDE HeroPlayer — represents one human player's hero deck and state.
// One instance per hero deck (a single player may have multiple HeroPlayer instances).

/* eslint-disable-next-line no-unused-vars */
const SotmCard = require('./SotmCard'); // used in JSDoc @param types
const EVENT_TYPES = require('./eventTypes');

class HeroPlayer {
    /**
     * @param {string} id          - socket user id (controllerPlayerId)
     * @param {string} name        - display name
     * @param {string} deckId      - hero deck id
     * @param {SotmCard[]} cards   - all non-character cards for this deck
     * @param {SotmCard} characterCard
     */
    constructor(id, name, deckId, cards, characterCard) {
        this.id = id;
        this.name = name;
        this.deckId = deckId;
        this.deckVersion = null; // set by game.js after construction

        this.hand = [];
        this.deck = cards.filter((c) => c.type !== 'heroCharacter');
        this.trash = [];
        this.playArea = [];
        this.characterCard = characterCard;
        this.auxiliaryZones = [];

        this.hp = characterCard ? characterCard.hp ?? 0 : 0;
        this.maxHp = characterCard ? characterCard.maxHp ?? 0 : 0;
        this.isIncapacitated = false;

        // Mark card zones
        if (this.characterCard) {
            this.characterCard.zone = 'character';
        }
        for (const c of this.deck) {
            c.zone = 'deck';
        }
    }

    // Fisher-Yates in-place shuffle
    _fisherYates(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    shuffleDeck() {
        this._fisherYates(this.deck);
    }

    /**
     * Draw n cards. Auto-shuffles trash into deck if deck runs dry mid-draw.
     * @param {number} n
     * @param {Function} [logEvent] - optional game.logEvent callback
     */
    drawCard(n = 1, logEvent) {
        for (let i = 0; i < n; i++) {
            if (this.deck.length === 0) {
                if (this.trash.length === 0) break; // nothing left to draw

                // Auto-reshuffle trash → deck
                this.deck = [...this.trash];
                this.trash = [];
                this._fisherYates(this.deck);
                for (const c of this.deck) c.zone = 'deck';
            }

            const card = this.deck.shift();
            card.zone = 'hand';
            this.hand.push(card);

            if (logEvent) {
                logEvent(EVENT_TYPES.DRAW_CARD, this.id, { cardId: card.id, heroId: this.deckId });
            }
        }
    }

    /**
     * Play a card from hand.
     * One-shots go to trash; all others go to playArea.
     * @param {string} cardId
     * @returns {SotmCard|null}
     */
    playCard(cardId) {
        const idx = this.hand.findIndex((c) => c.id === cardId);
        if (idx === -1) return null;

        const card = this.hand.splice(idx, 1)[0];

        if (card.keywords && card.keywords.includes('one-shot')) {
            card.zone = 'trash';
            this.trash.push(card);
        } else {
            card.zone = 'playArea';
            this.playArea.push(card);
        }

        return card;
    }

    /**
     * Discard a card from the given zone to trash.
     * Calls card.clearPlayState() if leaving playArea.
     * @param {string} cardId
     * @param {string} fromZone  - 'hand' | 'playArea' | 'deck'
     * @returns {SotmCard|null}
     */
    discardCard(cardId, fromZone) {
        let sourceArr;
        switch (fromZone) {
            case 'hand':
                sourceArr = this.hand;
                break;
            case 'playArea':
                sourceArr = this.playArea;
                break;
            case 'deck':
                sourceArr = this.deck;
                break;
            default:
                return null;
        }

        const idx = sourceArr.findIndex((c) => c.id === cardId);
        if (idx === -1) return null;

        const card = sourceArr.splice(idx, 1)[0];

        if (fromZone === 'playArea') {
            card.clearPlayState();
        }

        card.zone = 'trash';
        this.trash.push(card);
        return card;
    }

    setHp(n) {
        this.hp = n;
        if (n <= 0) {
            this.isIncapacitated = true;
        }
    }

    adjustHp(delta) {
        this.setHp(this.hp + delta);
    }

    incapacitate() {
        this.isIncapacitated = true;
        if (this.characterCard) {
            this.characterCard.clearPlayState();
        }
    }

    /**
     * Serialize state for broadcast.
     * Hand is hidden (array of { faceDown: true }) if forPlayerId !== this.id.
     * @param {string} forPlayerId
     */
    getState(forPlayerId) {
        const isOwner = forPlayerId === this.id;

        return {
            id: this.id,
            name: this.name,
            deckId: this.deckId,
            deckVersion: this.deckVersion,
            hand: isOwner
                ? this.hand.map((c) => c.getSummary())
                : this.hand.map(() => ({ faceDown: true })),
            handCount: this.hand.length,
            deck: this.deck.map((c) => c.getSummary()),
            deckCount: this.deck.length,
            trash: this.trash.map((c) => c.getSummary()),
            playArea: this.playArea.map((c) => c.getSummary()),
            characterCard: this.characterCard ? this.characterCard.getSummary() : null,
            auxiliaryZones: this.auxiliaryZones.map((az) => ({
                id: az.id,
                name: az.name,
                deck: az.deck.map((c) => c.getSummary()),
                trash: az.trash.map((c) => c.getSummary())
            })),
            hp: this.hp,
            maxHp: this.maxHp,
            isIncapacitated: this.isIncapacitated,
            controllerPlayerId: this.id
        };
    }
}

module.exports = HeroPlayer;
