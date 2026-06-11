/**
 * SotMDE standalone placeholder image regeneration script.
 *
 * Regenerates placeholder PNG images for all cards (or a specific deck)
 * where shouldGeneratePlaceholder() is true.
 *
 * Usage:
 *   node server/scripts/generatePlaceholders.js
 *   node server/scripts/generatePlaceholders.js --deckId=legacy
 *
 * Flags:
 *   --deckId=<id>   Only regenerate placeholders for cards in the specified deck.
 *
 * Exit codes:
 *   0  Success
 *   1  Fatal error
 */

'use strict';

const monk = require('monk');
const config = require('config');
const {
    generatePlaceholder,
    shouldGeneratePlaceholder
} = require('../game/sotm/cardImageGenerator');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

let deckIdFilter = null;
for (const arg of args) {
    const m = arg.match(/^--deckId=(.+)$/);
    if (m) deckIdFilter = m[1];
}

const mongoUrl = process.env.MONGO_URL || config.get('mongo');
const db = monk(mongoUrl);
const cardsCollection = db.get('sotmCards');

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    console.log('=== SotMDE Placeholder Generator ===');
    console.log(`MongoDB: ${mongoUrl}`);
    if (deckIdFilter) {
        console.log(`Filtering to deck: ${deckIdFilter}`);
    }

    // Build query
    const query = {};
    if (deckIdFilter) query.deckId = deckIdFilter;

    const cards = await cardsCollection.find(query);

    if (cards.length === 0) {
        console.log('[INFO] No cards found matching the query.');
        await db.close();
        process.exit(0);
    }

    console.log(`[INFO] Found ${cards.length} card(s) to check.`);

    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (const card of cards) {
        if (!shouldGeneratePlaceholder(card)) {
            skipped++;
            continue;
        }

        try {
            const generatedPath = await generatePlaceholder(card);
            await cardsCollection.findOneAndUpdate(
                { id: card.id },
                { $set: { imageUrl: generatedPath } }
            );
            console.log(`[GEN] ${card.id} → ${generatedPath}`);
            generated++;
        } catch (err) {
            console.error(
                `[ERROR] Failed to generate placeholder for '${card.id}': ${err.message}`
            );
            failed++;
        }
    }

    console.log(`\n=== Done ===`);
    console.log(`Generated: ${generated}, Skipped: ${skipped}, Failed: ${failed}`);

    await db.close();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error('[FATAL] Unhandled error:', err);
    db.close().finally(() => process.exit(1));
});
