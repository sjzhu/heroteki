/**
 * SotMDE deck data model.
 * Wraps a monk collection for the 'decks' MongoDB collection.
 *
 * Schema mirrors the deck shape defined in server/game/sotm/deckSchema.js:
 *   id                  {string}         e.g. "legacy"
 *   name                {string}         Display name
 *   deckType            {string}         "hero" | "villain" | "environment"
 *   version             {string}         e.g. "1.2.0"; must be explicit
 *   characterCardId     {string|null}    Null for environment decks
 *   characterVersion    {string|null}    Version of the character card; null for environment
 *   cardCount           {number}         Derived/computed by import script; not manually set
 *   sideDeck            {object|null}    { id, name, version, cardIds, setupInstructions }
 *   setupInstructions   {string|null}    Displayed as setup banner
 *   source              {string}         "official" | "manual" | "user"  (set by server)
 *   uploadedBy          {string|null}    User ID for "user" source decks  (set by server)
 *
 * Indexes:
 *   { id: 1 }           unique — primary lookup key
 *   { deckType: 1 }     — list decks by type (hero/villain/environment)
 *   { source: 1 }       — filter by provenance
 *   { uploadedBy: 1 }   — list a user's uploaded decks
 */

const monk = require('monk');
const logger = require('../log.js');
const ConfigService = require('../services/ConfigService.js');

class SotmDeckModel {
    constructor(db) {
        if (!db) {
            const configService = new ConfigService();
            const mongoUrl = process.env.MONGO_URL || configService.getValue('mongo');
            db = monk(mongoUrl);
        }
        this.collection = db.get('sotmDecks');
        this._db = db;
    }

    /**
     * Ensure all required indexes exist. Safe to call multiple times (createIndex is idempotent).
     */
    async ensureIndexes() {
        try {
            await this.collection.createIndex({ id: 1 }, { unique: true, name: 'id_unique' });
            await this.collection.createIndex({ deckType: 1 }, { name: 'deckType_1' });
            await this.collection.createIndex({ source: 1 }, { name: 'source_1' });
            await this.collection.createIndex({ uploadedBy: 1 }, { name: 'uploadedBy_1' });
        } catch (err) {
            logger.error('SotmDeckModel: failed to create indexes', err);
            throw err;
        }
    }

    /**
     * Upsert a deck by id. Sets/overwrites all fields.
     * @param {object} deckData - Deck data conforming to the schema above.
     */
    async upsert(deckData) {
        return this.collection.findOneAndUpdate(
            { id: deckData.id },
            { $set: deckData },
            { upsert: true }
        );
    }

    /**
     * Find a deck by its unique id.
     * @param {string} id
     */
    async findById(id) {
        return this.collection.findOne({ id });
    }

    /**
     * Find all decks of a given type.
     * @param {string} deckType - "hero" | "villain" | "environment"
     */
    async findByType(deckType) {
        return this.collection.find({ deckType });
    }

    /**
     * Find decks matching a query object.
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

module.exports = SotmDeckModel;
