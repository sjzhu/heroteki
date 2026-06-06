/**
 * SotMDE API — Deck listing and user deck upload endpoints.
 * Phase 6, Steps 6.1 and 6.3.
 *
 * Step 6.1: GET /api/sotm/decks?type=hero|villain|environment&source=official|manual|user
 * Step 6.3: POST /api/sotm/decks/upload
 */

'use strict';

const passport = require('passport');
const monk = require('monk');
const { wrapAsync } = require('../util.js');
const logger = require('../log.js');
const { generatePlaceholder, shouldGeneratePlaceholder } = require('../game/sotm/cardImageGenerator');

const DECK_SIZES = { hero: 40, villain: 25, environment: 15 };
const REQUIRED_CARD_FIELDS = ['id', 'name', 'deckId', 'type', 'keywords', 'text'];
const REQUIRED_DECK_FIELDS = ['id', 'name', 'deckType', 'version'];

function getDb() {
    const mongoUrl = process.env.MONGO_URL || require('config').get('mongo');
    return monk(mongoUrl);
}

module.exports.init = function (server) {
    // -------------------------------------------------------------------------
    // Step 6.1 — GET /api/sotm/decks
    // -------------------------------------------------------------------------
    server.get(
        '/api/sotm/decks',
        passport.authenticate('jwt', { session: false }),
        wrapAsync(async function (req, res) {
            const db = getDb();
            const decksCollection = db.get('sotmDecks');

            const query = {};

            if (req.query.type) {
                query.deckType = req.query.type;
            }

            if (req.query.source) {
                query.source = req.query.source;
                // User-source decks: filter to requester's own unless admin
                if (req.query.source === 'user') {
                    if (!req.user.permissions?.isAdmin) {
                        query.uploadedBy = req.user.id || req.user._id.toString();
                    }
                }
            }

            const decks = await decksCollection.find(query, {
                projection: {
                    id: 1,
                    name: 1,
                    deckType: 1,
                    version: 1,
                    characterVersion: 1,
                    cardCount: 1,
                    setupInstructions: 1,
                    source: 1
                },
                sort: { name: 1 }
            });

            await db.close();

            res.send(decks.map(d => ({
                id: d.id,
                name: d.name,
                deckType: d.deckType,
                version: d.version,
                characterVersion: d.characterVersion || null,
                cardCount: d.cardCount || 0,
                setupInstructions: d.setupInstructions || null,
                source: d.source
            })));
        })
    );

    // -------------------------------------------------------------------------
    // Step 6.3 — POST /api/sotm/decks/upload
    // -------------------------------------------------------------------------
    server.post(
        '/api/sotm/decks/upload',
        passport.authenticate('jwt', { session: false }),
        wrapAsync(async function (req, res) {
            const { deck, characterCard, cards } = req.body;

            // --- 1. Validate required fields ---
            const errors = [];

            if (!deck) {
                return res.status(400).send({ success: false, message: 'Missing deck object' });
            }
            if (!Array.isArray(cards)) {
                return res.status(400).send({ success: false, message: 'Missing cards array' });
            }

            for (const field of REQUIRED_DECK_FIELDS) {
                if (!deck[field]) {
                    errors.push(`Deck missing required field: ${field}`);
                }
            }

            const allCards = characterCard ? [characterCard, ...cards] : cards;

            for (const card of allCards) {
                for (const field of REQUIRED_CARD_FIELDS) {
                    if (card[field] === undefined || card[field] === null) {
                        errors.push(`Card ${card.id || '(unknown)'} missing required field: ${field}`);
                    }
                }
            }

            if (errors.length > 0) {
                return res.status(400).send({ success: false, errors });
            }

            // --- 2. Check for id collisions ---
            const db = getDb();
            const cardsCollection = db.get('sotmCards');
            const decksCollection = db.get('sotmDecks');

            const allCardIds = allCards.map(c => c.id);
            const existingCards = await cardsCollection.find({ id: { $in: allCardIds } });
            // Only collision if the existing card belongs to a different user
            const userId = (req.user.id || req.user._id).toString();
            const collisions = existingCards.filter(
                ec => ec.source !== 'user' || ec.uploadedBy !== userId
            );

            if (collisions.length > 0) {
                await db.close();
                return res.status(409).send({
                    success: false,
                    message: 'Card ID collision(s) with existing non-user cards',
                    collisions: collisions.map(c => c.id)
                });
            }

            const warnings = [];

            // --- 3 & 4. Set source/uploadedBy; default card version to deck version ---
            const deckVersion = deck.version;

            const processedCards = allCards.map(c => ({
                ...c,
                source: 'user',
                uploadedBy: userId,
                version: c.version || deckVersion
            }));

            // --- 5. Compute cardCount (non-character cards only) ---
            const nonCharacterCards = cards; // characterCard excluded from count
            const cardCount = nonCharacterCards.length;

            // --- 6. Check deck size ---
            const expectedSize = DECK_SIZES[deck.deckType];
            if (expectedSize !== undefined && cardCount !== expectedSize) {
                warnings.push(
                    `Deck size mismatch: expected ${expectedSize} cards for ${deck.deckType}, got ${cardCount}`
                );
            }

            // --- 7. Upsert cards and deck into MongoDB ---
            const deckDocument = {
                ...deck,
                source: 'user',
                uploadedBy: userId,
                cardCount
            };

            // Upsert each card
            for (const card of processedCards) {
                await cardsCollection.findOneAndUpdate(
                    { id: card.id },
                    { $set: card },
                    { upsert: true }
                );
            }

            // Upsert deck
            await decksCollection.findOneAndUpdate(
                { id: deckDocument.id },
                { $set: deckDocument },
                { upsert: true }
            );

            // --- 8. Trigger placeholder generation for cards with null/missing imageUrl ---
            const generationErrors = [];
            for (const card of processedCards) {
                if (shouldGeneratePlaceholder(card)) {
                    try {
                        const imageUrl = await generatePlaceholder(card);
                        await cardsCollection.findOneAndUpdate(
                            { id: card.id },
                            { $set: { imageUrl } }
                        );
                    } catch (err) {
                        logger.error(`Placeholder generation failed for card ${card.id}`, err);
                        generationErrors.push(card.id);
                    }
                }
            }

            if (generationErrors.length > 0) {
                warnings.push(`Placeholder generation failed for: ${generationErrors.join(', ')}`);
            }

            await db.close();

            // --- 9. Return success ---
            return res.send({
                success: true,
                warnings,
                cardCount,
                deckId: deck.id
            });
        })
    );
};
