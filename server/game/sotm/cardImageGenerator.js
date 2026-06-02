/**
 * SotMDE placeholder card image generator.
 * Renders an SVG template to a PNG using sharp and writes it to
 * public/card-images/placeholders/.
 */

'use strict';

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { getTemplate } = require('./cardTemplates');

const OUTPUT_DIR = path.join(__dirname, '../../../public/card-images/placeholders');

// Ensure the output directory exists when this module is first loaded
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Generate a placeholder PNG for the given card.
 * Writes the file to OUTPUT_DIR/<card.id>.png and returns the public URL path.
 *
 * @param {object} card - Card data record (must have at least id, name, type, etc.)
 * @returns {Promise<string>} Root-relative public path, e.g. "/card-images/placeholders/legacy-01.png"
 */
async function generatePlaceholder(card) {
    const svgString = getTemplate(card)(card);
    const outputPath = path.join(OUTPUT_DIR, `${card.id}.png`);
    await sharp(Buffer.from(svgString)).png().toFile(outputPath);
    return `/card-images/placeholders/${card.id}.png`;
}

/**
 * Returns true if a placeholder image should be (re)generated for this card.
 * Conditions:
 *   - imageUrl is null or undefined
 *   - imageUrl is already a placeholder path (starts with /card-images/placeholders/)
 *
 * Cards with a real external or official imageUrl are left untouched.
 *
 * @param {object} card - Card data record.
 * @returns {boolean}
 */
function shouldGeneratePlaceholder(card) {
    return !card.imageUrl
        || card.imageUrl.startsWith('/card-images/placeholders/');
}

module.exports = { generatePlaceholder, shouldGeneratePlaceholder };
