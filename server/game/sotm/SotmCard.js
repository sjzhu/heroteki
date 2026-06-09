// SotMDE runtime card object. Wraps a card data record and tracks zone/state.
class SotmCard {
    constructor(data) {
        this.id = data.id; // unique instance id (data.id + UUID suffix)
        this.dataId = data.id; // matches the DB record
        this.name = data.name;
        this.type = data.type;
        this.keywords = data.keywords;
        this.text = data.text;
        this.imageUrl = data.imageUrl;
        // Both fields derive from the same JSON value so cards always spawn at full HP.
        // maxHp is the printed/baseline value and never changes unless explicitly set
        // via modifyCard. hp tracks current HP and is what the HpDial displays.
        // If data.hp is null (most non-character cards), both stay null and no dial is shown.
        this.hp = data.hp ?? null;
        this.maxHp = data.hp ?? null;
        this.zone = null; // set by controller when card enters a zone
        this.faceDown = false;
        // Generic token tracking. Keys are player-defined label strings (e.g. "bounty",
        // "X", "ammo"); values are non-negative integers. Tokens are cleared whenever
        // the card leaves a play zone (playArea or character zone).
        this.tokens = {};
    }

    getSummary() {
        return {
            id: this.id,
            dataId: this.dataId,
            name: this.name,
            type: this.type,
            keywords: this.keywords,
            hp: this.hp,
            maxHp: this.maxHp,
            zone: this.zone,
            faceDown: this.faceDown,
            imageUrl: this.imageUrl,
            tokens: this.tokens
        };
    }

    // Applied by the modifyCard socket event handler
    applyUpdates(updates) {
        if (updates.hp !== undefined) this.hp = updates.hp;
        if (updates.maxHp !== undefined) this.maxHp = updates.maxHp;
        if (updates.addKeyword) {
            if (!this.keywords.includes(updates.addKeyword)) this.keywords.push(updates.addKeyword);
        }
        if (updates.removeKeyword)
            this.keywords = this.keywords.filter((k) => k !== updates.removeKeyword);
        // Token operations: label + delta adds/subtracts; result clamped to >= 0.
        // Sending delta that reduces count to 0 removes the key entirely.
        if (updates.token) {
            const { label, delta } = updates.token;
            const current = this.tokens[label] ?? 0;
            const next = current + delta;
            if (next <= 0) delete this.tokens[label];
            else this.tokens[label] = next;
        }
    }

    // Call this whenever the card leaves a play zone (playArea → trash/hand/deck,
    // or character zone on incapacitation). Resets transient in-play state.
    clearPlayState() {
        this.tokens = {};
    }
}
module.exports = SotmCard;
