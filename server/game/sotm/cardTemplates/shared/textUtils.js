/**
 * SotMDE SVG text utilities.
 * Shared by all card templates for safe text embedding and word-wrap.
 */

'use strict';

/**
 * Escape a string for safe embedding in SVG XML content and attribute values.
 * Handles: < > & " '
 *
 * @param {*} str - Value to escape. Non-strings are coerced to string first.
 * @returns {string} XML-safe string.
 */
function escapeXml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Greedy word-wrap: split `text` into lines of at most `maxCharsPerLine`
 * characters by breaking on spaces.
 *
 * Handles:
 * - null / undefined input → returns []
 * - empty string → returns []
 * - words longer than maxCharsPerLine → placed on their own line (no mid-word break)
 *
 * @param {string|null|undefined} text
 * @param {number} maxCharsPerLine
 * @returns {string[]}
 */
function wrapText(text, maxCharsPerLine) {
    if (text === null || text === undefined || text === '') return [];
    if (typeof maxCharsPerLine !== 'number' || maxCharsPerLine <= 0) maxCharsPerLine = 40;

    const lines = [];
    // Preserve explicit newlines in card text
    const paragraphs = String(text).split('\n');

    for (const paragraph of paragraphs) {
        const words = paragraph.split(' ').filter((w) => w.length > 0);
        if (words.length === 0) {
            // Skip blank paragraphs that result from leading/trailing whitespace
            continue;
        }

        let current = '';
        for (const word of words) {
            if (current === '') {
                // First word on a new line — always place it, even if oversized
                current = word;
            } else if (current.length + 1 + word.length <= maxCharsPerLine) {
                current += ' ' + word;
            } else {
                lines.push(current);
                current = word;
            }
        }
        if (current !== '') {
            lines.push(current);
        }
    }

    return lines;
}

module.exports = { escapeXml, wrapText };
