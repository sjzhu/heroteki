/**
 * SotMDE default SVG card template.
 * Complete, functional implementation used as the fallback for all card types.
 * Named templates start as re-exports of this module until individually designed.
 *
 * Layout (top → bottom):
 *   [ Name (bold serif, large) ]  [ HP badge if character ]
 *   [ horizontal rule ]
 *   [ Keywords in small caps ]
 *   [ horizontal rule ]
 *   [ Body text, wrapped, sans-serif ]
 *   [ horizontal rule at bottom ]
 *   [ Deck name (left) ]  [ version (right) ]
 *
 * Function signature: (card) => svgString
 */

'use strict';

const fs = require('fs');
const path = require('path');

const {
    WIDTH: W, HEIGHT: H, PADDING: PAD,
    NAME_SIZE, BODY_SIZE, FONT_SERIF, FONT_SANS,
    CORNER_RADIUS, BODY_LINE_HEIGHT
} = require('./shared/layout');

const { escapeXml, wrapText } = require('./shared/textUtils');
const { footer, keywordBar, hpBadge, dividerLine } = require('./shared/fragments');

// ---------------------------------------------------------------------------
// Font data — embed as base64 in the SVG @font-face so sharp can render text
// without a system font lookup.
// ---------------------------------------------------------------------------

let LORA_B64 = '';
let INTER_B64 = '';

try {
    const loraPath = path.join(__dirname, '../../../assets/fonts/Lora-Bold.ttf');
    LORA_B64 = fs.readFileSync(loraPath).toString('base64');
} catch (e) {
    // Font unavailable — SVG will fall back to generic serif
}

try {
    const interPath = path.join(__dirname, '../../../assets/fonts/Inter-Regular.ttf');
    INTER_B64 = fs.readFileSync(interPath).toString('base64');
} catch (e) {
    // Font unavailable — SVG will fall back to generic sans-serif
}

// ---------------------------------------------------------------------------
// Type → background colour mapping (subtle differentiation)
// ---------------------------------------------------------------------------

const TYPE_BG = {
    heroCard:         '#e8f4fd',
    villainCard:      '#fde8e8',
    environmentCard:  '#e8fde8',
    heroCharacter:    '#d6ecff',
    villainCharacter: '#ffd6d6',
};

// Max characters per wrapped line given the card width and body font size.
// Empirically: 300px card, 16px padding each side → 268px usable.
// At ~6px per char for 11px Inter: ~268 / 6 ≈ 44 chars.
const MAX_CHARS = 38;

// Vertical line height for body text
const LINE_H = Math.round(BODY_SIZE * BODY_LINE_HEIGHT);

/**
 * Render a card as an SVG string.
 *
 * @param {object} card - Card data record.
 * @returns {string} Complete SVG document as a string.
 */
function renderCard(card) {
    const bg = TYPE_BG[card.type] || '#f5f5f5';

    // -- Font-face declarations --
    const fontFaces = `
    <defs>
      <style>
        @font-face {
          font-family: '${FONT_SERIF}';
          font-weight: bold;
          src: url('data:font/truetype;base64,${LORA_B64}') format('truetype');
        }
        @font-face {
          font-family: '${FONT_SANS}';
          font-weight: normal;
          src: url('data:font/truetype;base64,${INTER_B64}') format('truetype');
        }
      </style>
    </defs>`;

    // -- Card background --
    const background = `
  <rect width="${W}" height="${H}" rx="${CORNER_RADIUS}" fill="${bg}" stroke="#aaa" stroke-width="1.5"/>`;

    // -- Name section --
    // Reserve right margin for HP badge if present
    const nameMaxWidth = card.hp !== null ? W - PAD * 2 - 52 : W - PAD * 2;
    const nameY = PAD + NAME_SIZE;
    const safeName = escapeXml(card.name || '');
    const nameEl = `
  <text x="${PAD}" y="${nameY}" font-family="${FONT_SERIF}, serif" font-size="${NAME_SIZE}" font-weight="bold" fill="#1a1a1a" clip-path="url(#nameClip)">${safeName}</text>
  <clipPath id="nameClip">
    <rect x="${PAD}" y="${PAD}" width="${nameMaxWidth}" height="${NAME_SIZE + 4}"/>
  </clipPath>`;

    // -- HP badge --
    const hpEl = hpBadge(card.hp, W, PAD);

    // -- Divider after name --
    const div1Y = nameY + 6;
    const div1 = dividerLine(div1Y, W);

    // -- Keywords --
    const kwY = div1Y + 14;
    const kwEl = keywordBar(card.keywords, kwY, PAD);

    // -- Divider after keywords (only if keywords present) --
    let div2Y = kwY + 4;
    let div2 = '';
    if (card.keywords && card.keywords.length > 0) {
        div2Y = kwY + 8;
        div2 = dividerLine(div2Y, W);
    }

    // -- Body text --
    const bodyStartY = div2Y + LINE_H;
    const maxBodyLines = Math.floor((H - bodyStartY - 40) / LINE_H); // reserve space for footer
    const rawLines = wrapText(card.text, MAX_CHARS);
    const lines = rawLines.slice(0, maxBodyLines);

    let bodyEl = '';
    for (let i = 0; i < lines.length; i++) {
        const y = bodyStartY + i * LINE_H;
        bodyEl += `
  <text x="${PAD}" y="${y}" font-family="${FONT_SANS}, sans-serif" font-size="${BODY_SIZE}" fill="#333">${escapeXml(lines[i])}</text>`;
    }

    // Overflow indicator if text was truncated
    if (rawLines.length > maxBodyLines) {
        const overflowY = bodyStartY + maxBodyLines * LINE_H;
        bodyEl += `
  <text x="${PAD}" y="${overflowY}" font-family="${FONT_SANS}, sans-serif" font-size="${BODY_SIZE}" fill="#999">…</text>`;
    }

    // -- Bottom divider --
    const bottomDivY = H - PAD - 16;
    const bottomDiv = dividerLine(bottomDivY, W);

    // -- Footer --
    const footerEl = footer(card.deckId || '', card.version || '', W, H, PAD);

    // -- Assemble --
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${fontFaces}${background}${nameEl}${hpEl}${div1}${kwEl}${div2}${bodyEl}${bottomDiv}${footerEl}
</svg>`;
}

module.exports = renderCard;
