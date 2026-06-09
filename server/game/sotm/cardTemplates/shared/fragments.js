/**
 * SotMDE SVG fragment generators.
 * Each function returns a string of SVG markup suitable for embedding in a
 * larger SVG document. Used by all card templates.
 */

'use strict';

const { escapeXml } = require('./textUtils');
const { META_SIZE, FONT_SANS, BODY_SIZE } = require('./layout');

/**
 * Footer bar: deck name (left) and version (right), at the card bottom.
 *
 * @param {string} deckName
 * @param {string|null} version
 * @param {number} W  - Card width
 * @param {number} H  - Card height
 * @param {number} PAD - Padding
 * @returns {string} SVG snippet
 */
function footer(deckName, version, W, H, PAD) {
    const y = H - PAD;
    const safeDecK = escapeXml(deckName || '');
    const safeVer = escapeXml(version || '');
    return `
  <text x="${PAD}" y="${y}" font-family="${FONT_SANS}, sans-serif" font-size="${META_SIZE}" fill="#555" text-anchor="start">${safeDecK}</text>
  <text x="${
      W - PAD
  }" y="${y}" font-family="${FONT_SANS}, sans-serif" font-size="${META_SIZE}" fill="#555" text-anchor="end">${safeVer}</text>`;
}

/**
 * Keyword bar: keywords rendered in small-caps on a single line.
 *
 * @param {string[]} keywords
 * @param {number} y       - Top of the keyword bar (baseline)
 * @param {number} PAD     - Horizontal padding
 * @returns {string} SVG snippet (empty string if no keywords)
 */
function keywordBar(keywords, y, PAD) {
    if (!keywords || keywords.length === 0) return '';
    const text = keywords.map((k) => k.toUpperCase()).join('  ·  ');
    return `
  <text x="${PAD}" y="${y}" font-family="${FONT_SANS}, sans-serif" font-size="${BODY_SIZE}" font-variant="small-caps" fill="#444" letter-spacing="1">${escapeXml(
        text
    )}</text>`;
}

/**
 * HP badge: a small rounded rectangle in the top-right corner.
 * Returns an empty string when hp is null (non-character cards).
 *
 * @param {number|null} hp
 * @param {number} W   - Card width
 * @param {number} PAD - Padding
 * @returns {string} SVG snippet
 */
function hpBadge(hp, W, PAD) {
    if (hp === null || hp === undefined) return '';
    const badgeW = 44;
    const badgeH = 22;
    const x = W - PAD - badgeW;
    const y = PAD;
    return `
  <rect x="${x}" y="${y}" width="${badgeW}" height="${badgeH}" rx="4" fill="#c0392b"/>
  <text x="${x + badgeW / 2}" y="${
        y + badgeH - 5
    }" font-family="${FONT_SANS}, sans-serif" font-size="13" font-weight="bold" fill="white" text-anchor="middle">HP ${escapeXml(
        String(hp)
    )}</text>`;
}

/**
 * A full-width 1px horizontal divider line.
 *
 * @param {number} y  - Y coordinate of the line
 * @param {number} W  - Card width
 * @returns {string} SVG snippet
 */
function dividerLine(y, W) {
    return `
  <line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#ccc" stroke-width="1"/>`;
}

module.exports = { footer, keywordBar, hpBadge, dividerLine };
