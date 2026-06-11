/**
 * SotMDE official card and deck import script.
 *
 * Reads all JSON files under data/sotm/cards/ and data/sotm/decks/,
 * upserts them into the MongoDB 'cards' and 'decks' collections,
 * validates deck sizes, validates side deck card references,
 * and stubs placeholder generation for cards with null imageUrl.
 *
 * Usage:
 *   node server/scripts/importSotmData.js [--skip-count-validation]
 *
 * Flags:
 *   --skip-count-validation   Skip deck size validation (for exemplar / development data
 *                             that does not have full card counts).
 *
 * Exit codes:
 *   0  Success
 *   1  Validation error (deck size mismatch or missing side-deck card reference)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const monk = require('monk');
const config = require('config');

const { CARD_TYPES } = require('../game/sotm/cardSchema.js');
const { EXPECTED_DECK_SIZES } = require('../game/sotm/deckSchema.js');
const {
    generatePlaceholder,
    shouldGeneratePlaceholder
} = require('../game/sotm/cardImageGenerator');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CARDS_DATA_DIR = path.join(__dirname, '../../data/sotm/cards');
const DECKS_DATA_DIR = path.join(__dirname, '../../data/sotm/decks');

const args = process.argv.slice(2);
const SKIP_COUNT_VALIDATION = args.includes('--skip-count-validation');

// ---------------------------------------------------------------------------
// MongoDB connection
// ---------------------------------------------------------------------------

const mongoUrl = process.env.MONGO_URL || config.get('mongo');
const db = monk(mongoUrl);

const cardsCollection = db.get('sotmCards');
const decksCollection = db.get('sotmDecks');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read all JSON files in a directory. Files containing a JSON array are
 * flattened into individual records; files containing an object are returned
 * as a single-element array.
 *
 * @param {string} dir - Absolute path to the directory.
 * @returns {{ filePath: string, records: object[] }[]}
 */
function readJsonDir(dir) {
    const results = [];
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
        const filePath = path.join(dir, file);
        const raw = fs.readFileSync(filePath, 'utf8');
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (err) {
            console.error(`[ERROR] Could not parse JSON: ${filePath} — ${err.message}`);
            process.exit(1);
        }
        const records = Array.isArray(parsed) ? parsed : [parsed];
        results.push({ filePath, records });
    }
    return results;
}

/**
 * Compute a field-level diff between two objects and return a human-readable
 * description of what changed.
 *
 * @param {object} existing - The document already in the database.
 * @param {object} incoming - The incoming data.
 * @returns {string[]} Array of diff lines, empty if no differences.
 */
function fieldDiff(existing, incoming) {
    const diffs = [];
    const allKeys = new Set([...Object.keys(existing), ...Object.keys(incoming)]);
    // Ignore MongoDB internal fields
    allKeys.delete('_id');
    for (const key of allKeys) {
        const oldVal = JSON.stringify(existing[key]);
        const newVal = JSON.stringify(incoming[key]);
        if (oldVal !== newVal) {
            diffs.push(`  ${key}: ${oldVal} → ${newVal}`);
        }
    }
    return diffs;
}

/**
 * Validate a card record against the schema. Returns an array of error strings.
 * @param {object} card
 * @param {string} filePath - Source file path, for error messages.
 */
function validateCard(card, filePath) {
    const errors = [];
    if (!card.id || typeof card.id !== 'string') {
        errors.push(`${filePath}: card missing required string 'id'`);
    }
    if (!card.name || typeof card.name !== 'string') {
        errors.push(`${filePath}: card '${card.id}' missing required string 'name'`);
    }
    if (!card.deckId || typeof card.deckId !== 'string') {
        errors.push(`${filePath}: card '${card.id}' missing required string 'deckId'`);
    }
    if (!card.type || !CARD_TYPES.includes(card.type)) {
        errors.push(
            `${filePath}: card '${card.id}' has invalid type '${
                card.type
            }' (must be one of: ${CARD_TYPES.join(', ')})`
        );
    }
    if (!Array.isArray(card.keywords)) {
        errors.push(`${filePath}: card '${card.id}' missing required array 'keywords'`);
    }
    if (typeof card.text !== 'string') {
        errors.push(`${filePath}: card '${card.id}' missing required string 'text'`);
    }
    if (!('hp' in card)) {
        errors.push(
            `${filePath}: card '${card.id}' missing required field 'hp' (use null for non-character cards)`
        );
    }
    return errors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    console.log('=== SotMDE Import Script ===');
    console.log(`MongoDB: ${mongoUrl}`);
    if (SKIP_COUNT_VALIDATION) {
        console.log(
            '[INFO] --skip-count-validation flag set; deck size validation will be skipped.'
        );
    }

    // -----------------------------------------------------------------------
    // Step 1 — Ensure indexes exist
    // -----------------------------------------------------------------------

    console.log('\n[Step 1] Ensuring indexes...');
    try {
        await cardsCollection.createIndex({ id: 1 }, { unique: true, name: 'id_unique' });
        await cardsCollection.createIndex({ deckId: 1 }, { name: 'deckId_1' });
        await cardsCollection.createIndex({ source: 1 }, { name: 'source_1' });
        await decksCollection.createIndex({ id: 1 }, { unique: true, name: 'id_unique' });
        await decksCollection.createIndex({ deckType: 1 }, { name: 'deckType_1' });
        await decksCollection.createIndex({ source: 1 }, { name: 'source_1' });
        await decksCollection.createIndex({ uploadedBy: 1 }, { name: 'uploadedBy_1' });
        console.log('[Step 1] Indexes OK.');
    } catch (err) {
        // Index creation errors are non-fatal if the index already exists with the same spec.
        // Monk wraps the driver error; log and continue.
        console.warn('[Step 1] Index creation warning (may already exist):', err.message);
    }

    // -----------------------------------------------------------------------
    // Step 2 — Load and upsert cards
    // -----------------------------------------------------------------------

    console.log('\n[Step 2] Loading card data from', CARDS_DATA_DIR);
    const cardFiles = readJsonDir(CARDS_DATA_DIR);

    // Build a map of all cards for later reference validation
    const allCards = new Map(); // id → card record

    let cardValidationErrors = [];

    for (const { filePath, records } of cardFiles) {
        for (const card of records) {
            const errors = validateCard(card, filePath);
            if (errors.length > 0) {
                cardValidationErrors.push(...errors);
                continue;
            }

            // Check for duplicate ids within the data files
            if (allCards.has(card.id)) {
                cardValidationErrors.push(`Duplicate card id '${card.id}' found in ${filePath}`);
                continue;
            }

            allCards.set(card.id, card);
        }
    }

    if (cardValidationErrors.length > 0) {
        console.error('\n[ERROR] Card validation failed:');
        for (const err of cardValidationErrors) {
            console.error(' ', err);
        }
        await db.close();
        process.exit(1);
    }

    console.log(`[Step 2] Loaded ${allCards.size} valid card(s). Upserting into MongoDB...`);

    let cardsInserted = 0;
    let cardsUpdated = 0;
    let cardsUnchanged = 0;

    for (const [, card] of allCards) {
        // Set server-assigned fields
        const cardDoc = {
            ...card,
            source: 'official',
            uploadedBy: null
        };

        // Check for existing document to detect version changes and log diffs
        const existing = await cardsCollection.findOne({ id: card.id });

        if (existing) {
            if (existing.version !== card.version) {
                const diffs = fieldDiff(existing, cardDoc);
                console.log(
                    `[UPDATE] Card '${card.id}': version ${existing.version} → ${card.version}`
                );
                if (diffs.length > 0) {
                    console.log('  Field-level diff:');
                    for (const d of diffs) console.log(d);
                }
                cardsUpdated++;
            } else {
                cardsUnchanged++;
            }
        } else {
            console.log(`[INSERT] Card '${card.id}'`);
            cardsInserted++;
        }

        await cardsCollection.findOneAndUpdate(
            { id: card.id },
            { $set: cardDoc },
            { upsert: true }
        );
    }

    console.log(
        `[Step 2] Cards: ${cardsInserted} inserted, ${cardsUpdated} updated, ${cardsUnchanged} unchanged.`
    );

    // -----------------------------------------------------------------------
    // Step 3 — Load and upsert decks
    // -----------------------------------------------------------------------

    console.log('\n[Step 3] Loading deck data from', DECKS_DATA_DIR);
    const deckFiles = readJsonDir(DECKS_DATA_DIR);

    const allDecks = new Map(); // id → deck record
    let deckValidationErrors = [];

    for (const { filePath, records } of deckFiles) {
        for (const deck of records) {
            if (!deck.id || typeof deck.id !== 'string') {
                deckValidationErrors.push(`${filePath}: deck missing required string 'id'`);
                continue;
            }
            if (!deck.name || typeof deck.name !== 'string') {
                deckValidationErrors.push(
                    `${filePath}: deck '${deck.id}' missing required string 'name'`
                );
                continue;
            }
            if (!['hero', 'villain', 'environment'].includes(deck.deckType)) {
                deckValidationErrors.push(
                    `${filePath}: deck '${deck.id}' has invalid deckType '${deck.deckType}'`
                );
                continue;
            }
            if (!deck.version || typeof deck.version !== 'string') {
                deckValidationErrors.push(
                    `${filePath}: deck '${deck.id}' missing required string 'version' (no default — must be explicit)`
                );
                continue;
            }
            if (allDecks.has(deck.id)) {
                deckValidationErrors.push(`Duplicate deck id '${deck.id}' found in ${filePath}`);
                continue;
            }
            allDecks.set(deck.id, deck);
        }
    }

    if (deckValidationErrors.length > 0) {
        console.error('\n[ERROR] Deck validation failed:');
        for (const err of deckValidationErrors) {
            console.error(' ', err);
        }
        await db.close();
        process.exit(1);
    }

    // -----------------------------------------------------------------------
    // Step 4 — Compute cardCount and validate deck sizes
    // -----------------------------------------------------------------------

    console.log('\n[Step 4] Computing card counts and validating deck sizes...');

    let countValidationErrors = [];

    for (const [deckId, deck] of allDecks) {
        // Count cards in allCards that belong to this deck
        // (excluding character cards, which are stored separately)
        let count = 0;
        for (const [, card] of allCards) {
            if (
                card.deckId === deckId &&
                card.type !== 'heroCharacter' &&
                card.type !== 'villainCharacter'
            ) {
                count++;
            }
        }

        deck._computedCardCount = count;

        const expectedSize = EXPECTED_DECK_SIZES[deck.deckType];
        if (!SKIP_COUNT_VALIDATION) {
            if (count !== expectedSize) {
                // Compute missing/surplus for the error log
                const deckCardIds = [...allCards.entries()]
                    .filter(
                        ([, c]) =>
                            c.deckId === deckId &&
                            c.type !== 'heroCharacter' &&
                            c.type !== 'villainCharacter'
                    )
                    .map(([id]) => id);

                countValidationErrors.push(
                    `Deck '${deckId}' (${deck.deckType}) has ${count} card(s) but expected ${expectedSize}. ` +
                        `Diff: ${
                            count < expectedSize
                                ? `missing ${expectedSize - count} card(s)`
                                : `surplus ${count - expectedSize} card(s)`
                        }. ` +
                        `Present card IDs: [${deckCardIds.join(', ')}]`
                );
            } else {
                console.log(`[OK] Deck '${deckId}' has correct card count: ${count}`);
            }
        } else {
            console.log(`[SKIP] Deck '${deckId}': ${count} card(s) (validation skipped)`);
        }
    }

    if (countValidationErrors.length > 0) {
        console.error(
            '\n[ERROR] Deck size validation failed (use --skip-count-validation to bypass during development):'
        );
        for (const err of countValidationErrors) {
            console.error(' ', err);
        }
        await db.close();
        process.exit(1);
    }

    // -----------------------------------------------------------------------
    // Step 5 — Validate side deck card references
    // -----------------------------------------------------------------------

    console.log('\n[Step 5] Validating side deck card references...');

    let sideDeckErrors = [];

    for (const [deckId, deck] of allDecks) {
        if (deck.sideDeck && Array.isArray(deck.sideDeck.cardIds)) {
            for (const cardId of deck.sideDeck.cardIds) {
                if (!allCards.has(cardId)) {
                    sideDeckErrors.push(
                        `Deck '${deckId}' side deck references unknown card id '${cardId}'`
                    );
                }
            }
        }
    }

    if (sideDeckErrors.length > 0) {
        console.error('\n[ERROR] Side deck card reference validation failed:');
        for (const err of sideDeckErrors) {
            console.error(' ', err);
        }
        await db.close();
        process.exit(1);
    }

    console.log('[Step 5] Side deck references OK.');

    // -----------------------------------------------------------------------
    // Step 6 — Upsert decks with computed cardCount
    // -----------------------------------------------------------------------

    console.log('\n[Step 6] Upserting decks into MongoDB...');

    let decksInserted = 0;
    let decksUpdated = 0;
    let decksUnchanged = 0;

    for (const [, deck] of allDecks) {
        const deckDoc = {
            id: deck.id,
            name: deck.name,
            deckType: deck.deckType,
            version: deck.version,
            characterCardId: deck.characterCardId ?? null,
            characterVersion: deck.characterVersion ?? null,
            cardCount: deck._computedCardCount,
            sideDeck: deck.sideDeck ?? null,
            setupInstructions: deck.setupInstructions ?? null,
            source: 'official',
            uploadedBy: null
        };

        const existing = await decksCollection.findOne({ id: deck.id });

        if (existing) {
            if (existing.version !== deck.version) {
                const diffs = fieldDiff(existing, deckDoc);
                console.log(
                    `[UPDATE] Deck '${deck.id}': version ${existing.version} → ${deck.version}`
                );
                if (diffs.length > 0) {
                    console.log('  Field-level diff:');
                    for (const d of diffs) console.log(d);
                }
                decksUpdated++;
            } else {
                decksUnchanged++;
            }
        } else {
            console.log(`[INSERT] Deck '${deck.id}'`);
            decksInserted++;
        }

        await decksCollection.findOneAndUpdate(
            { id: deck.id },
            { $set: deckDoc },
            { upsert: true }
        );
    }

    console.log(
        `[Step 6] Decks: ${decksInserted} inserted, ${decksUpdated} updated, ${decksUnchanged} unchanged.`
    );

    // -----------------------------------------------------------------------
    // Step 7 — Placeholder image generation
    // -----------------------------------------------------------------------

    console.log('\n[Step 7] Checking for cards requiring placeholder image generation...');

    let placeholdersGenerated = 0;
    let placeholdersSkipped = 0;
    let placeholdersFailed = 0;

    // We work from allCards (already validated and upserted in Step 2).
    // Re-read each card's current DB record to pick up any imageUrl already set.
    for (const [, card] of allCards) {
        // Fetch the freshly-upserted record to get the latest imageUrl value.
        const dbCard = await cardsCollection.findOne({ id: card.id });
        const cardForCheck = dbCard || card;

        if (!shouldGeneratePlaceholder(cardForCheck)) {
            placeholdersSkipped++;
            continue;
        }

        try {
            const generatedPath = await generatePlaceholder(cardForCheck);
            await cardsCollection.findOneAndUpdate(
                { id: cardForCheck.id },
                { $set: { imageUrl: generatedPath } }
            );
            console.log(`[GEN] Placeholder generated for '${cardForCheck.id}' → ${generatedPath}`);
            placeholdersGenerated++;
        } catch (err) {
            console.error(
                `[ERROR] Placeholder generation failed for '${cardForCheck.id}': ${err.message}`
            );
            placeholdersFailed++;
        }
    }

    console.log(
        `[Step 7] Placeholders: ${placeholdersGenerated} generated, ${placeholdersSkipped} skipped (had imageUrl), ${placeholdersFailed} failed.`
    );

    // -----------------------------------------------------------------------
    // Done
    // -----------------------------------------------------------------------

    console.log('\n=== Import complete ===');
    console.log(`Cards: ${allCards.size} processed`);
    console.log(`Decks: ${allDecks.size} processed`);

    await db.close();
    process.exit(0);
}

main().catch((err) => {
    console.error('[FATAL] Unhandled error during import:', err);
    db.close().finally(() => process.exit(1));
});
