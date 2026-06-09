// SotMDE VillainController — manages the villain deck, play area, and character card.
// All zones are fully visible (no hidden information for villain).

class VillainController {
    /**
     * @param {string} deckId
     * @param {import('./SotmCard')[]} cards   - all non-character villain cards
     * @param {import('./SotmCard')} characterCard
     */
    constructor(deckId, cards, characterCard) {
        this.deckId = deckId;
        this.deckVersion = null; // set by game.js after construction

        this.deck = cards.filter((c) => c.type !== 'villainCharacter');
        this.trash = [];
        this.playArea = [];
        this.characterCard = characterCard;
        this.auxiliaryZones = [];

        this.hp = characterCard ? characterCard.hp ?? 0 : 0;
        this.maxHp = characterCard ? characterCard.maxHp ?? 0 : 0;
        this.isFlipped = false;

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
     * Move the top card of the deck to playArea.
     * Auto-shuffles trash into deck if deck is empty.
     * @returns {import('./SotmCard')|null}
     */
    playTopCard() {
        if (this.deck.length === 0) {
            if (this.trash.length === 0) return null;

            // Auto-reshuffle trash → deck
            this.deck = [...this.trash];
            this.trash = [];
            this._fisherYates(this.deck);
            for (const c of this.deck) c.zone = 'deck';
        }

        const card = this.deck.shift();
        card.zone = 'playArea';
        this.playArea.push(card);
        return card;
    }

    /**
     * Move a card from playArea to trash.
     * Calls card.clearPlayState() before moving.
     * @param {string} cardId
     * @returns {import('./SotmCard')|null}
     */
    discardFromPlay(cardId) {
        const idx = this.playArea.findIndex((c) => c.id === cardId);
        if (idx === -1) return null;

        const card = this.playArea.splice(idx, 1)[0];
        card.clearPlayState();
        card.zone = 'trash';
        this.trash.push(card);
        return card;
    }

    flip() {
        this.isFlipped = !this.isFlipped;
    }

    setHp(n) {
        this.hp = n;
    }

    adjustHp(delta) {
        this.setHp(this.hp + delta);
    }

    /** All zones fully visible for villain. */
    getState() {
        return {
            deckId: this.deckId,
            deckVersion: this.deckVersion,
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
            isFlipped: this.isFlipped
        };
    }
}

module.exports = VillainController;
