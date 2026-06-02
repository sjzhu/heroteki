/**
 * SotMDE card template registry.
 * Maps card type strings (and optional card.template overrides) to SVG generator functions.
 * Each generator has the signature: (card) => svgString.
 */

'use strict';

const templates = {
    heroCard:         require('./heroCard'),
    villainCard:      require('./villainCard'),
    environmentCard:  require('./environmentCard'),
    heroCharacter:    require('./heroCharacter'),
    villainCharacter: require('./villainCharacter'),
    default:          require('./default'),
};

/**
 * Select the appropriate SVG template function for a card.
 *
 * Lookup order:
 * 1. card.template (if set and matches a known template key)
 * 2. card.type (matches a CARD_TYPES value)
 * 3. default (fallback for unknown types)
 *
 * @param {object} card - Card data record.
 * @returns {function} Template function: (card) => svgString
 */
function getTemplate(card) {
    if (card.template && templates[card.template]) return templates[card.template];
    return templates[card.type] ?? templates.default;
}

module.exports = { getTemplate };
