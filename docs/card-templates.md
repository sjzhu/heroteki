# SVG Card Template System

Placeholder PNG images are generated for cards that have `imageUrl: null`. Each card type
has its own SVG template, selected via a registry. All templates share layout constants and
utility functions from the `shared/` directory.

## Template Contract

Every template is a function with signature:

```js
/**
 * @param {object} card  - SotmCard data record from MongoDB
 * @returns {string}     - A complete SVG document as a string
 */
function myTemplate(card) {
  // Return an SVG string
  return `<svg ...>...</svg>`;
}
module.exports = myTemplate;
```

The function receives the raw card data record (not a SotmCard runtime instance) and must
return a valid SVG string. The generator converts it to PNG via `sharp`.

## Template Registry

`server/game/sotm/cardTemplates/index.js` maps card types and custom keys to template functions:

```js
const templates = {
  heroCard:         require('./heroCard'),
  villainCard:      require('./villainCard'),
  environmentCard:  require('./environmentCard'),
  heroCharacter:    require('./heroCharacter'),
  villainCharacter: require('./villainCharacter'),
  default:          require('./default'),
};

function getTemplate(card) {
  if (card.template && templates[card.template]) {
    return templates[card.template];
  }
  return templates[card.type] ?? templates.default;
}
```

**Lookup order:**
1. If `card.template` is set and matches a registry key, use that template
2. Otherwise use `templates[card.type]` (e.g. `templates.heroCard`)
3. Fall back to `templates.default` if the type is not in the registry

## Creating a Named Template

1. Copy the default template as a starting point:
   ```bash
   cp server/game/sotm/cardTemplates/default.js server/game/sotm/cardTemplates/myTemplate.js
   ```

2. Edit `myTemplate.js` to implement the function. Use the shared utilities (see below).

3. Register it in `cardTemplates/index.js`:
   ```js
   const templates = {
     ...
     myTemplate: require('./myTemplate'),
   };
   ```

4. Assign `template: "myTemplate"` to any card that should use it (in the card JSON data).

Until a named template is designed, it should re-export `default`:
```js
// STUB: re-exports default until myTemplate is designed
module.exports = require('./default');
```

## Shared Utilities

All utilities are in `server/game/sotm/cardTemplates/shared/`.

### layout.js

Exports layout constants:

```js
const { WIDTH, HEIGHT, PADDING, NAME_SIZE, BODY_SIZE, META_SIZE, CORNER_RADIUS } = require('./shared/layout');
// WIDTH = 300, HEIGHT = 420, PADDING = 16
```

### textUtils.js

```js
const { wrapText, escapeXml } = require('./shared/textUtils');

// wrapText(text, maxCharsPerLine) → string[]
// Greedily packs words onto lines. Handles null/undefined input (returns []).
const lines = wrapText('Play this card to do something.', 30);

// escapeXml(str) → string
// Escapes <, >, &, ", ' for safe embedding in SVG text nodes.
// REQUIRED for all card name and text fields.
const safe = escapeXml(card.text);
```

**Important:** Always call `escapeXml()` on card names and text before embedding them in SVG.
Cards with `<`, `>`, `&`, `"`, or `'` will silently break SVG rendering if not escaped.

### fragments.js

Pre-built SVG snippet helpers:

```js
const { footer, keywordBar, hpBadge, dividerLine } = require('./shared/fragments');

footer(deckName, version, W, H, PAD)  // Bottom bar with deck name + version
keywordBar(keywords, y, PAD)          // Keyword line in small caps
hpBadge(hp, W, PAD)                   // Top-right HP badge; returns '' if hp is null
dividerLine(y, W)                     // Full-width 1px horizontal rule
```

## Default Template Layout

The `default.js` template renders top to bottom:

```
[ Name (bold serif, large) ]  [ HP badge if character ]
[ horizontal rule ]
[ Keywords in small caps ]
[ horizontal rule ]
[ Body text, wrapped, sans-serif ]
[ horizontal rule at bottom ]
[ Deck name (left) ]  [ version (right) ]
```

## Regenerating Placeholders

To regenerate all placeholder images (e.g. after editing a template):

```bash
node server/scripts/generatePlaceholders.js
```

To regenerate only a specific deck:

```bash
node server/scripts/generatePlaceholders.js --deckId baron-blade
```

Cards with a real (non-placeholder) `imageUrl` are never overwritten by either script.
