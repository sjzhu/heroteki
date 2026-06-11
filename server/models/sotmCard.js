/**
 * SotMDE card data model.
 * Wraps a monk collection for the 'cards' MongoDB collection.
 *
 * Schema mirrors the card shape defined in server/game/sotm/cardSchema.js:
 *   id            {string}        Unique slug, e.g. "legacy-02"
 *   name          {string}        Display name
 *   deckId        {string}        Owning deck id, e.g. "legacy"
 *   type          {string}        One of CARD_TYPES from cardSchema.js
 *   keywords      {string[]}      Subset of KEYWORDS from cardSchema.js
 *   text          {string}        Full card text (display only)
 *   hp            {number|null}   Character cards only; null for all others
 *   imageUrl      {string|null}   Null triggers placeholder generation
 *   version       {string|null}   Inherited from deck version if null
 *   source        {string}        "official" | "manual" | "user"  (set by server)
 *   uploadedBy    {string|null}   User ID for "user" source cards  (set by server)
 *   template      {string|null}   Override SVG template key; null = type-based lookup
 *
 * Indexes:
 *   { id: 1 }       unique — primary lookup key
 *   { deckId: 1 }   — list all cards for a deck
 *   { source: 1 }   — filter by provenance
 */

const monk = require('monk');
const logger = require('../log.js');
const ConfigService = require('../services/ConfigService.js');

class SotmCardModel {
    constructor(db) {
        if (!db) {
            const configService = new ConfigService();
            const mongoUrl = process.env.MONGO_URL || configService.getValue('mongo');
            db = monk(mongoUrl);
        }
        this.collection = db.get('sotmCards');
        this._db = db;
    }

    /**
     * Ensure all required indexes exist. Safe to call multiple times (createIndex is idempotent).
     */
    async ensureIndexes() {
        try {
            await this.collection.createIndex({ id: 1 }, { unique: true, name: 'id_unique' });
            await this.collection.createIndex({ deckId: 1 }, { name: 'deckId_1' });
            await this.collection.createIndex({ source: 1 }, { name: 'source_1' });
        } catch (err) {
            logger.error('SotmCardModel: failed to create indexes', err);
            throw err;
        }
    }

    /**
     * Upsert a card by id. Sets/overwrites all fields.
     * @param {object} cardData - Card data conforming to the schema above.
     */
    async upsert(cardData) {
        return this.collection.findOneAndUpdate(
            { id: cardData.id },
            { $set: cardData },
            { upsert: true }
        );
    }

    /**
     * Find a card by its unique slug id.
     * @param {string} id
     */
    async findById(id) {
        return this.collection.findOne({ id });
    }

    /**
     * Find all cards belonging to a deck.
     * @param {string} deckId
     */
    async findByDeckId(deckId) {
        return this.collection.find({ deckId });
    }

    /**
     * Count cards belonging to a deck.
     * @param {string} deckId
     */
    async countByDeckId(deckId) {
        return this.collection.count({ deckId });
    }

    /**
     * Find cards matching a query object.
     * @param {object} query
     */
    async find(query) {
        return this.collection.find(query || {});
    }

    async close() {
        if (this._db) {
            await this._db.close();
        }
    }
}

module.exports = SotmCardModel;
