/**
 * SotMDE card template layout constants.
 * Used by all SVG card templates to ensure consistent sizing and typography.
 */

'use strict';

// Card dimensions in pixels
const WIDTH = 300;
const HEIGHT = 420;
const PADDING = 16;

// Font size scale (px)
const NAME_SIZE = 18;   // Card name — bold serif
const BODY_SIZE = 11;   // Body text — sans-serif
const META_SIZE = 10;   // Deck name / version footer — sans-serif

// Corner radius for the card border
const CORNER_RADIUS = 8;

// Font family references — must match @font-face declarations in the SVG
const FONT_SERIF = 'Lora';           // Bold for card names
const FONT_SANS = 'Inter';           // Regular for body text and metadata

// Line height multipliers (em)
const BODY_LINE_HEIGHT = 1.5;        // px = BODY_SIZE * BODY_LINE_HEIGHT

module.exports = {
    WIDTH,
    HEIGHT,
    PADDING,
    NAME_SIZE,
    BODY_SIZE,
    META_SIZE,
    CORNER_RADIUS,
    FONT_SERIF,
    FONT_SANS,
    BODY_LINE_HEIGHT
};
