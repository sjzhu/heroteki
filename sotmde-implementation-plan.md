# SotMDE Online — Agent Implementation Plan

A step-by-step plan for an agent to fork [Ashteki](https://github.com/Ashteki/ashteki)
into a Sentinels of the Multiverse: Definitive Edition (SotMDE) online facilitator.
The fork retains the Node.js/React/Socket.IO/MongoDB infrastructure but removes the
Ashes rules engine entirely, replacing it with a manual-play game board.

---

## Design Decisions Reference

The following decisions have been made and are baked into this plan. The agent should
not re-litigate them.

**Game model:**
- No automated rules resolution. All card effects are resolved manually by players.
  The server tracks zone contents, HP, turn phase, and game state only.
- Cooperative structure: Villain and Environment are not controlled by a human player.
  Any player may advance the Villain and Environment phases.
- Hero incapacitation is tracked as a state flag (`isIncapacitated`) when HP ≤ 0;
  no automatic enforcement of incapacitated restrictions.
- Deck auto-reshuffle (trash → deck when deck is empty) is the one mechanical
  automation worth implementing, as it involves no decisions.
- One player may manage multiple heroes. `heroOrder` is an ordered list of
  `HeroSlot { heroId, controllerPlayerId }` objects. When one hero's turn ends, the
  next hero's `controllerPlayerId` is read and control passes automatically — if it
  is the same socket user, their client just shifts focus.

**H value:**
- H = total number of hero decks in the game; set at construction, never changes.
  Hero incapacitation does not change H. Displayed prominently so players can
  evaluate card effects without mental arithmetic.

**Deck and card data:**
- Three card provenance tracks: `"official"` (script-imported), `"manual"`
  (admin-imported with uploaded images), `"user"` (player-uploaded via JSON).
- Deck sizes: Hero 40, Villain 25, Environment 15. These are warnings, not errors,
  for user-uploaded decks. Official and manual decks are validated strictly on import.
- All decks and character cards carry a `version` string (semantic versioning
  recommended but not enforced by the server).
- Side decks are supported via an `auxiliaryZones` model. Setup instructions for
  side decks are surfaced as UI banners; not automated.
- User-uploaded decks are self-contained JSON packages (cards + deck metadata inline).
  Card `imageUrl` fields in user uploads are external URLs; the server stores them
  as-is.
- Official and manual card images are hosted locally under `public/card-images/`.
  Manual card images are uploaded via an admin-only endpoint.
- An optional `template` field on each card overrides the type-based SVG template
  lookup for placeholder image generation.

**Placeholder image generation:**
- Generated at import/upload time, stored as PNGs in
  `public/card-images/placeholders/`.
- Multiple SVG templates, one per card type, selected via a registry.
- Shared utilities (layout constants, `wrapText`, `escapeXml`, SVG fragments) live
  in `cardTemplates/shared/`.
- A `default` template is a full implementation used as fallback. Named templates
  start as re-exports of `default` until designed.
- Generation triggered by: import script, user deck upload, and standalone
  `generatePlaceholders.js` script.

**Access control:**
- HTTP Basic Auth middleware gates the entire app (both lobby and game node) when
  `config.privateMode` is true. Credentials live in `config/local.json5` (gitignored).
- Admin role (existing Ashteki superuser) gates card image upload and stats pages.

**Asynchronous play:**
- Game state persisted to MongoDB after every mutation.
- Game node is stateless: load from DB on event, process, save, unload.
- Notification on hero turn start (email or similar) triggered by `TurnManager`.
- Policy: any single player may advance any phase (cooperative; no ready-vote system).

**Game logging:**
- Append-only `gameEvents` collection: one document per socket event, written
  fire-and-forget alongside `broadcastGameState()`.
- `gameOutcomes` collection: one document per completed game, written by
  `finaliseGame()`.
- Game Over is triggered manually via a modal. Result (`heroVictory` |
  `villainVictory`) is entered by any player. The modal broadcasts to all connected
  clients simultaneously.
- Auto-tags on outcome document: `deck:{deckId}@{version}` and
  `char:{cardId}@{version}` for every deck in the game. Manual tags and notes
  also captured in the modal.
- Abandoned games: explicit "End Session" button + inactivity TTL on `lastActivityAt`.

**Token model:**
- Cards track tokens as `tokens: { [label: string]: number }` — a map of
  player-defined label strings to non-negative counts.
- Token operations use `{ label, delta }` — delta adds or subtracts from the count.
  A result ≤ 0 removes the label entirely.
- Tokens are cleared (`clearPlayState()`) whenever a card leaves `playArea` or the
  `character` zone. This applies to all three controller types.

---

## Guiding Principles for the Agent

- **Read before touching.** Before editing any file, read it in full. The codebase
  descends from ringteki → keyteki → ashteki and many files are larger than they appear.
- **One concern per commit.** Each step below maps to a logical commit. Do not bundle
  unrelated changes.
- **Verify the app starts after each phase.** The lobby should load and a game room
  should be creatable before moving to the next phase.
- **Never delete the socket plumbing.** `server/gamenode.js`,
  `server/game/gamerouter.js`, and the Socket.IO event wiring are the backbone of
  everything. Gut the handlers; keep the wires.
- **Prefix all new SotMDE-specific files with a comment block** explaining their
  purpose, so future contributors can tell them apart from retained Ashteki code.

---

## Phase 0 — Repository Setup

### Step 0.1 — Fork and rename

```
git clone https://github.com/Ashteki/ashteki.git sentinels-online
cd sentinels-online
git remote set-url origin <your-new-repo-url>
```

- Edit `package.json`: change `name`, `description`, and `version`.
- Edit `README.md`: replace all Ashes/Ashteki references.
- Edit `config/default.json5`: rename the `mongo` database string from `ashteki` to
  `sentinels`; update logging labels; add the following new config keys with defaults:

```json5
{
  privateMode: false,
  privateUser: '',
  privatePassword: '',
  inactivityTimeoutHours: 48,
  notificationEmail: {
    enabled: false,
    smtpHost: '',
    smtpPort: 587,
    fromAddress: ''
  }
}
```

- Search the entire repo case-insensitively for `"ashteki"` and update all non-code
  references (HTML titles, About page text, email templates).

### Step 0.2 — Add Basic Auth middleware

In the lobby server's main Express setup file (typically `index.js` or
`server/server.js`), add before all other middleware:

```js
const basicAuth = require('express-basic-auth');
const config = require('config');

if (config.get('privateMode')) {
  app.use(basicAuth({
    users: { [config.get('privateUser')]: config.get('privatePassword') },
    challenge: true
  }));
}
```

Repeat for the game node's Express/Socket.IO server if it is exposed on a separate
port. Add `express-basic-auth` to `package.json` dependencies.

If both servers sit behind a shared reverse proxy (nginx/Caddy), note in the README
that Basic Auth can alternatively be applied at the proxy level to cover both with
one rule, and that HTTPS is required for Basic Auth to be secure.

### Step 0.3 — Confirm the base runs

```
npm install
mkdir server/logs
node .                 # lobby
node server/gamenode   # game node
```

Browse to `localhost:4000`. The lobby must load without JS errors. Register a test
user. Fix any dependency or Node version issues before proceeding.

---

## Phase 1 — Purge Ashes-Specific Code

The goal of this phase is a codebase that still *runs* but contains no Ashes card
logic. Do this in one branch so it can be reviewed as a single diff.

### Step 1.1 — Delete Ashes card definitions

Delete the entire directory:
```
server/game/cards/
```
This is the per-card ability implementation tree (one JS file per card). Nothing else
depends on this directory at import time; the card loader uses `require()` with a
try/catch fallback, so missing card files are silently ignored.

### Step 1.2 — Gut the rules-engine pipeline

The following files contain Ashes/KeyForge-specific game logic. **Do not delete them**
— delete their contents and replace with a stub that exports an empty object or no-op
class, preserving the `module.exports` shape so that anything which `require()`s them
does not throw.

Files to stub out:
- `server/game/cardaction.js`
- `server/game/abilitycontext.js`
- `server/game/abilitytarget.js`
- `server/game/costs/` (entire directory — stub each file)
- `server/game/effects/` (entire directory — stub each file)
- `server/game/gameactions/` (entire directory — stub each file)
- `server/game/promptinterrupter.js`
- `server/game/triggeredabilitycontext.js`

For each, replace contents with:
```js
// STUBBED: Ashes rules engine removed for SotMDE port
module.exports = {};
```

**Also stub or delete these directories — they are the Ashteki turn pipeline and will
be completely replaced by `TurnManager.js` in Phase 3:**

- `server/game/gamesteps/` (entire directory — ~30 files; this is Ashteki's full turn
  engine: SetupPhase, RecoveryPhase, PlayerTurnsPhase, AttackFlow, all prompt steps).
  Delete the whole directory. Nothing in the new SotMDE game.js will import from it.
- `server/game/solo/` (entire directory — 9 files for Chimera/solo mode). Delete it.
- `server/game/Clocks/` (entire directory — time-limit clocks). Delete it.

**Also stub these top-level files in `server/game/` (each is constructed in game.js
and will throw if left intact after Step 1.3 removes their callers):**

- `server/game/EffectEngine.js` → stub to `module.exports = class EffectEngine { constructor(){} };`
- `server/game/GamePipeline.js` → stub to `module.exports = class GamePipeline { constructor(){} };`
- `server/game/CardVisibility.js` → stub to `module.exports = class CardVisibility { constructor(){} isVisible(){ return true; } };`
- `server/game/chatcommands.js` → stub to `module.exports = class ChatCommands { constructor(){} processCommand(){} };`
- `server/game/loader.js` → stub to `module.exports = { loadCards: () => ({}) };`
- `server/game/deck.js` → stub to `module.exports = {};`
- `server/game/gamechat.js` → keep the file but remove any Ashes-specific command
  methods; retain the `addMessage` / `messages` list so the chat panel still works.

### Step 1.3 — Strip Ashes logic from `game.js`

`server/game/game.js` is the central game object (~1920 lines). It will be
substantially reworked in Phase 3, but for now:
- Remove all imports of the stubbed files above (EffectEngine, GamePipeline,
  CardVisibility, ChatCommands, all gamesteps, etc.).
- Remove the constructor lines that instantiate those objects:
  `this.effectEngine`, `this.pipeline`, `this.cardVisibility`, `this.chatCommands`.
- Remove methods that call into those systems: `resolveAbility`, `resolveGameAction`,
  `queueStep`, `openInterruptWindowForEvent`, and their callees.
- Remove all dice-related methods and imports (`Die`, `Dice`, dice state tracking).
- Leave the constructor shell, `getPlayers()`, `router`, and socket event method stubs
  in place (even if they do nothing yet).

### Step 1.4 — Strip Ashes logic from `player.js`

`server/game/player.js` models a single player's state. Remove:
- Phoenixborn / dice logic
- Ability queue methods
- Any method that references the stubbed files

Leave the zone arrays (`hand`, `deck`, `discard`, `cardsInPlay`), HP-like counters,
and the `getState()` serialiser.

### Step 1.5 — Remove Ashes data scripts and card data

- Delete `server/scripts/importdata.js` and `server/scripts/importprecons.js`.
- Delete the `data/` directory at the repo root (Ashes card JSON).
- Remove references to those scripts from `package.json` scripts block.

### Step 1.6 — Gut the gamenode serialization layer

`server/gamenode/` contains four state-writer classes that are tightly coupled to
Ashteki's card/die model. They will be rewritten in Phase 7, but stub them now so
the gamenode starts without errors.

- `server/gamenode/DieStateWriter.js` → stub to `module.exports = class DieStateWriter { getState(){ return []; } };`
- `server/gamenode/CardStateWriter.js` → stub to `module.exports = class CardStateWriter { getState(){ return {}; } };`
- `server/gamenode/PlayerStateWriter.js` → stub to `module.exports = class PlayerStateWriter { constructor(){} getState(){ return {}; } };`
- `server/gamenode/GameStateWriter.js` → stub to emit an empty-but-valid state shape:
```js
// STUBBED: will be rewritten in Phase 7
class GameStateWriter {
    constructor(game) { this.game = game; }
    getStateForPlayer() { return { id: this.game.id, started: false }; }
    getStateForReplay() { return {}; }
    getState() { return { id: this.game.id, started: false }; }
}
module.exports = GameStateWriter;
```

### Step 1.7 — Clean up Ashes-specific game types and league system

- In `server/constants.js`, replace the `GameTypes` object with SotMDE-appropriate
  types:
  ```js
  const GameTypes = Object.freeze({ standard: 'standard', casual: 'casual' });
  ```
  Remove `pvp`, `chimera`, `league` entries. Remove all Ashes card-type constants
  (`CardType`, `Magic`, `Level`, `BattlefieldTypes`, etc.) — they are not used
  anywhere in the SotMDE code path.
- In `server/pendinggame.js`, remove references to `this.solo`, `this.soloLevel`,
  `this.soloStage`, `this.league`, `this.pairing`. These fields come from `details`
  and are passed through `getStartGameDetails()` — they will no longer exist.
- In `server/api/index.js`, locate the league routes (`server/api/league.js`) and
  stub them to return 404. Keep the files but gut their handlers.
- The replay system (`saveReplay` flag, `AshesReplayService`, `ReplayControls.jsx`,
  `/api/games.js` replay endpoints) should be **disabled but not deleted**: set
  `saveReplay: false` always, return 404 on replay endpoints, hide `ReplayControls`
  in the client. This avoids breaking the socket plumbing while removing Ashes-specific
  serialised replay data.

### Step 1.8 — Verify the app still starts

```
node .
node server/gamenode
```
The lobby must load. A game room may crash when started — that is acceptable at this
stage. No unhandled import errors should appear on startup.

---

## Phase 2 — Card Data Model & Import

### Step 2.1 — Define the card schema

Create `server/game/sotm/cardSchema.js`:

```js
/**
 * SotMDE card schema definition.
 * All card JSON in data/sotm/ must conform to this shape.
 */
const CARD_TYPES = [
  'heroCard', 'villainCard', 'environmentCard',
  'heroCharacter', 'villainCharacter'
];
const KEYWORDS = ['one-shot', 'ongoing', 'equipment', 'limited', 'power'];

module.exports = { CARD_TYPES, KEYWORDS };
```

**Breaking rename from v1:** `'hero'`, `'villain'`, `'environment'` are replaced by
`'heroCard'`, `'villainCard'`, `'environmentCard'` to avoid ambiguity with `deckType`
and to match the template registry keys. Any existing card data using the old strings
must be updated.

Each card JSON object must have:

| Field        | Type          | Required   | Notes |
|---|---|---|---|
| `id`         | string        | Yes        | Unique slug, e.g. `"legacy-02"` |
| `name`       | string        | Yes        | Display name |
| `deckId`     | string        | Yes        | Owning deck, e.g. `"legacy"` |
| `type`       | string        | Yes        | One of `CARD_TYPES` |
| `keywords`   | string[]      | Yes        | Subset of `KEYWORDS`; may be empty array |
| `text`       | string        | Yes        | Full card text (display only; not parsed) |
| `hp`         | number\|null  | Yes        | Character cards only; null for all others |
| `imageUrl`   | string\|null  | No         | Null triggers placeholder generation |
| `version`    | string\|null  | No         | Inherited from deck version if null |
| `source`     | string        | Set by server | `"official"` \| `"manual"` \| `"user"` |
| `uploadedBy` | string\|null  | Set by server | User ID for `"user"` source cards |
| `template`   | string\|null  | No         | Override SVG template key; null = type-based lookup |

### Step 2.2 — Define the deck schema

Create `server/game/sotm/deckSchema.js`:

| Field               | Type           | Required   | Notes |
|---|---|---|---|
| `id`                | string         | Yes        | e.g. `"legacy"` |
| `name`              | string         | Yes        | Display name |
| `deckType`          | string         | Yes        | `"hero"` \| `"villain"` \| `"environment"` |
| `version`           | string         | Yes        | e.g. `"1.2.0"`; no default — must be explicit |
| `characterCardId`   | string\|null   | Yes        | Null for environment decks |
| `characterVersion`  | string\|null   | Yes        | Version of the character card; null for environment |
| `cardCount`         | number         | Derived    | Computed from card list on import; not manually set |
| `sideDeck`          | SideDeck\|null | No         | See shape below |
| `setupInstructions` | string\|null   | No         | Displayed as setup banner |
| `source`            | string         | Set by server | `"official"` \| `"manual"` \| `"user"` |
| `uploadedBy`        | string\|null   | Set by server | User ID for `"user"` source decks |

Side deck shape:
```js
{
  id: string,
  name: string,
  version: string,
  cardIds: string[],
  setupInstructions: string | null
}
```

### Step 2.3 — Create the official card data directory

```
mkdir -p data/sotm/cards
mkdir -p data/sotm/decks
```

Create exemplar JSON files to validate the import pipeline. These need not be
complete decks — 3–5 cards each is sufficient:

- `data/sotm/cards/legacy-character.json`
- `data/sotm/decks/legacy.json` (hero)
- `data/sotm/decks/baron-blade.json` (villain)
- `data/sotm/decks/megalopolis.json` (environment)

Ensure at least one exemplar card has `imageUrl: null` to exercise placeholder
generation, and at least one has a `template` override value (even a non-existent
key, to verify fallback to `default` works).

### Step 2.4 — Write the official import script

Create `server/scripts/importSotmData.js`. It must:

1. Read all JSON files under `data/sotm/cards/` and upsert each into the MongoDB
   `cards` collection keyed by `id`, setting `source: "official"`.
2. Read all JSON files under `data/sotm/decks/` and upsert each into the `decks`
   collection keyed by `id`, setting `source: "official"`.
3. Compute and store `cardCount` by counting cards whose `deckId` matches each deck.
4. **Strictly** validate deck card counts against expected sizes (40/25/15) and
   **error** (not warn) on mismatch for official decks. Log a diff of which cards
   are missing or surplus.
5. Validate that every `cardId` in every deck's side deck resolves to a known card.
   Error on missing references.
6. For each card where `imageUrl` is null or points to the placeholders directory,
   trigger placeholder generation (see Step 2.6) and update `imageUrl` with the
   generated path.
7. When a card or deck with a matching `id` already exists but has a different
   `version`, update the document and log a field-level diff to the console.
   Never modify `gameEvents` or `gameOutcomes` documents.

```
node server/scripts/importSotmData.js
```

Must complete without errors against the exemplar data.

### Step 2.5 — Extend Mongoose models

Either extend existing models in `server/models/` or create new ones:
- `server/models/sotmCard.js` — mirrors the card schema from Step 2.1
- `server/models/sotmDeck.js` — mirrors the deck schema from Step 2.2

Add indexes:
- `cards`: `{ id: 1 }` unique, `{ deckId: 1 }`, `{ source: 1 }`
- `decks`: `{ id: 1 }` unique, `{ deckType: 1 }`, `{ source: 1 }`, `{ uploadedBy: 1 }`

Keep existing Ashteki Mongoose models (user, game) untouched — lobby auth depends
on them.

### Step 2.6 — Placeholder image generation

#### Step 2.6.1 — Dependencies and fonts

Add `sharp` to `package.json` dependencies.

Create `server/assets/fonts/` and commit at minimum two TTF/OTF font files:
one serif (for card names) and one sans-serif (for body text and metadata).
Download these from Google Fonts or similar; they must be licensed for
redistribution.

#### Step 2.6.2 — Shared utilities

Create `server/game/sotm/cardTemplates/shared/`:

- `layout.js` — exported constants: `WIDTH` (300), `HEIGHT` (420), `PADDING` (16),
  font size scale (`NAME_SIZE`, `BODY_SIZE`, `META_SIZE`), font family references,
  card corner radius.

- `textUtils.js` — exported functions:
  - `wrapText(text, maxCharsPerLine)` — splits on spaces, greedily packs words,
    returns `string[]` of wrapped lines. Must handle null/undefined input gracefully.
  - `escapeXml(str)` — escapes `<`, `>`, `&`, `"`, `'` for safe SVG embedding.
    Unit test this function against cards with special characters before proceeding.

- `fragments.js` — exported functions returning SVG snippet strings:
  - `footer(deckName, version, W, H, PAD)` — bottom bar with deck name and version
  - `keywordBar(keywords, y, PAD)` — keyword line in small caps
  - `hpBadge(hp, W, PAD)` — top-right HP display; returns empty string if hp is null
  - `dividerLine(y, W)` — full-width 1px rule

#### Step 2.6.3 — Template registry

Create `server/game/sotm/cardTemplates/index.js`:

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

module.exports = { getTemplate };
```

#### Step 2.6.4 — Default template

Create `server/game/sotm/cardTemplates/default.js`. This must be a complete,
functional implementation — not a stub. It renders all fields (name, HP if present,
keywords, body text, deck name, version) in the layout described in the Design
Decisions Reference. Use the shared utilities from Step 2.6.2.

The layout (top to bottom):
```
[ Name (bold serif, large) ]  [ HP badge if character ]
[ horizontal rule ]
[ Keywords in small caps ]
[ horizontal rule ]
[ Body text, wrapped, sans-serif ]
[ horizontal rule at bottom ]
[ Deck name (left) ]  [ version (right) ]
```

#### Step 2.6.5 — Named template stubs

Create the following files, each re-exporting `default` until designed:

```js
// server/game/sotm/cardTemplates/heroCard.js
// STUB: re-exports default until heroCard template is designed
module.exports = require('./default');
```

Repeat for `villainCard.js`, `environmentCard.js`, `heroCharacter.js`,
`villainCharacter.js`.

#### Step 2.6.6 — Generator function

Create `server/game/sotm/cardImageGenerator.js`:

```js
const sharp = require('sharp');
const path = require('path');
const { getTemplate } = require('./cardTemplates');

const OUTPUT_DIR = path.join(__dirname, '../../../public/card-images/placeholders');

async function generatePlaceholder(card) {
  const svgString = getTemplate(card)(card);
  const outputPath = path.join(OUTPUT_DIR, `${card.id}.png`);
  await sharp(Buffer.from(svgString)).png().toFile(outputPath);
  return `/card-images/placeholders/${card.id}.png`;
}

function shouldGeneratePlaceholder(card) {
  return !card.imageUrl
    || card.imageUrl.startsWith('/card-images/placeholders/');
}

module.exports = { generatePlaceholder, shouldGeneratePlaceholder };
```

#### Step 2.6.7 — Standalone regeneration script

Create `server/scripts/generatePlaceholders.js`. Accepts optional `--deckId` flag.
When run without flags, regenerates placeholders for all cards where
`shouldGeneratePlaceholder(card)` is true. Updates each card's `imageUrl` in
MongoDB after generation.

#### Step 2.6.8 — Smoke test placeholder generation

Run:
```
node server/scripts/importSotmData.js
```

Confirm that:
- `public/card-images/placeholders/` is populated with PNGs for exemplar cards
  that had `imageUrl: null`
- Cards with an existing non-placeholder `imageUrl` are not overwritten
- A card with a `template` override that doesn't match any key falls back to
  `default` without error
- A card whose text contains `<`, `>`, or `&` renders correctly without breaking
  the SVG

### Step 2.7 — Define the runtime `SotmCard` class

The data schema (Step 2.1) describes the JSON stored in MongoDB. The runtime game
model also needs an in-memory `Card` object that tracks which zone the card occupies
and adds convenience methods. Create `server/game/sotm/SotmCard.js`:

```js
// SotMDE runtime card object. Wraps a card data record and tracks zone/state.
class SotmCard {
    constructor(data) {
        this.id = data.id;           // unique instance id (data.id + UUID suffix)
        this.dataId = data.id;       // matches the DB record
        this.name = data.name;
        this.type = data.type;
        this.keywords = data.keywords;
        this.text = data.text;
        this.imageUrl = data.imageUrl;
        // Both fields derive from the same JSON value so cards always spawn at full HP.
        // maxHp is the printed/baseline value and never changes unless explicitly set
        // via modifyCard. hp tracks current HP and is what the HpDial displays.
        // If data.hp is null (most non-character cards), both stay null and no dial is shown.
        this.hp = data.hp ?? null;
        this.maxHp = data.hp ?? null;
        this.zone = null;            // set by controller when card enters a zone
        this.faceDown = false;
        // Generic token tracking. Keys are player-defined label strings (e.g. "bounty",
        // "X", "ammo"); values are non-negative integers. Tokens are cleared whenever
        // the card leaves a play zone (playArea or character zone).
        this.tokens = {};
    }

    getSummary() {
        return { id: this.id, dataId: this.dataId, name: this.name,
                 type: this.type, keywords: this.keywords,
                 hp: this.hp, maxHp: this.maxHp, zone: this.zone,
                 faceDown: this.faceDown, imageUrl: this.imageUrl,
                 tokens: this.tokens };
    }

    // Applied by the modifyCard socket event handler
    applyUpdates(updates) {
        if (updates.hp !== undefined)         this.hp = updates.hp;
        if (updates.maxHp !== undefined)      this.maxHp = updates.maxHp;
        if (updates.addKeyword)               { if (!this.keywords.includes(updates.addKeyword)) this.keywords.push(updates.addKeyword); }
        if (updates.removeKeyword)            this.keywords = this.keywords.filter(k => k !== updates.removeKeyword);
        // Token operations: label + delta adds/subtracts; result clamped to >= 0.
        // Sending delta that reduces count to 0 removes the key entirely.
        if (updates.token) {
            const { label, delta } = updates.token;
            const current = this.tokens[label] ?? 0;
            const next = current + delta;
            if (next <= 0) delete this.tokens[label];
            else           this.tokens[label] = next;
        }
    }

    // Call this whenever the card leaves a play zone (playArea → trash/hand/deck,
    // or character zone on incapacitation). Resets transient in-play state.
    clearPlayState() {
        this.tokens = {};
    }
}
module.exports = SotmCard;
```

**Note on keyword mutations and `playCard()` routing:** `playCard()` checks
`card.keywords.includes('one-shot')` at the moment of play. Since `keywords` is a
live array on the `SotmCard` instance, any keyword added or removed before that call
is reflected automatically.

`HeroPlayer`, `VillainController`, and `EnvironmentController` (Phase 3) all hold
arrays of `SotmCard` instances, not raw data records.

---

## Phase 3 — Server-Side Game Model

This is the largest single phase. Work in `server/game/` exclusively.

### Step 3.1 — Define zone types and event types

Create `server/game/sotm/zones.js`:

```js
const ZONE_TYPES = {
  HAND: 'hand',
  DECK: 'deck',
  TRASH: 'trash',
  PLAY_AREA: 'playArea',
  CHARACTER: 'character',   // single face-up card, never moves
  AUX_DECK: 'auxDeck',      // side deck draw pile
  AUX_TRASH: 'auxTrash',    // side deck discard
};
module.exports = ZONE_TYPES;
```

Create `server/game/sotm/eventTypes.js` — a controlled vocabulary of all socket
event types that will be written to the `gameEvents` collection:

```js
const EVENT_TYPES = {
  GAME_SETUP:       'gameSetup',
  PHASE_ADVANCE:    'phaseAdvance',
  PLAY_CARD:        'playCard',
  MOVE_CARD:        'moveCard',
  DISCARD_CARD:     'discardCard',
  PLAY_TOP_CARD:    'playTopCard',
  SHUFFLE_DECK:     'shuffleDeck',
  ADJUST_HP:        'adjustHp',
  FLIP_VILLAIN:     'flipVillain',
  DRAW_CARD:        'drawCard',
  MODIFY_CARD:      'modifyCard',
  SEARCH_DECK:      'searchDeck',
  GAME_OVER:        'gameOver',
  SESSION_END:      'sessionEnd',
};
module.exports = EVENT_TYPES;
```

### Step 3.2 — Rewrite `player.js` as `HeroPlayer`

Create `server/game/sotm/HeroPlayer.js`. This replaces the Ashteki player for human
hero players. It must hold:

```js
{
  id,           // socket user id
  name,         // display name
  deckId,       // which hero deck they chose
  hand: [],     // SotmCard objects
  deck: [],     // SotmCard objects (shuffled)
  trash: [],    // SotmCard objects
  playArea: [],  // SotmCard objects currently in play
  characterCard: SotmCard,  // always visible, never in hand/deck
  auxiliaryZones: [],   // [{ id, name, deck: [], trash: [] }]
  hp: number,
  maxHp: number,
  isIncapacitated: false,
}
```

Methods:
- `drawCard(n = 1)` — move n cards from `deck` to `hand`; auto-shuffle `trash` into
  `deck` (Fisher-Yates) if `deck` is empty mid-draw; call `game.logEvent` for each
  draw using `EVENT_TYPES.DRAW_CARD`
- `playCard(cardId)` — move card from `hand` to `playArea`; if card has keyword
  `'one-shot'`, move directly to `trash` instead (checked via
  `card.keywords.includes('one-shot')` at time of play)
- `discardCard(cardId, fromZone)` — move card to `trash` from the specified zone;
  call `card.clearPlayState()` before moving if the card is leaving `playArea`
- `shuffleDeck()` — Fisher-Yates shuffle of `deck` array
- `setHp(n)` — set `hp`; set `isIncapacitated = true` if `n <= 0`
- `adjustHp(delta)` — calls `setHp(this.hp + delta)`
- `incapacitate()` — set `isIncapacitated = true`; call
  `this.characterCard.clearPlayState()` to strip tokens from the character card
- `getState(forPlayerId)` — serialize all fields; replace hand card details with
  `{ faceDown: true }` placeholders if `forPlayerId !== this.id`

### Step 3.3 — Create `VillainController`

Create `server/game/sotm/VillainController.js`. State shape:

```js
{
  deckId,
  deck: [],
  trash: [],
  playArea: [],
  characterCard: SotmCard,
  auxiliaryZones: [],
  hp: number,
  maxHp: number,
  isFlipped: false,
}
```

Methods:
- `playTopCard()` — move top of `deck` to `playArea`; auto-shuffle `trash` into
  `deck` if `deck` is empty
- `discardFromPlay(cardId)` — move card from `playArea` to `trash`;
  call `card.clearPlayState()` before moving
- `shuffleDeck()` — Fisher-Yates shuffle
- `flip()` — toggle `isFlipped`
- `setHp(n)`, `adjustHp(delta)`
- `getState()` — all zones always fully visible (no hidden information)

### Step 3.4 — Create `EnvironmentController`

Create `server/game/sotm/EnvironmentController.js`. Same structure as
`VillainController` but without `characterCard`, `hp`, `maxHp`, or `isFlipped`.

Methods: `playTopCard()`, `discardFromPlay(cardId)`, `shuffleDeck()`, `getState()`.

`discardFromPlay` still calls `card.clearPlayState()` before moving.

**Token clearing rule (applies to all three controller types):** Any method that moves
a card out of `playArea` (or out of the `character` zone in the case of hero
incapacitation) must call `card.clearPlayState()` first. The `moveCard` generic
handler in `game.js` must also check `fromZone === 'playArea' || fromZone === 'character'`
and call `clearPlayState()` on the card before placing it in the destination zone.

### Step 3.5 — Rewrite the turn state machine

Create `server/game/sotm/TurnManager.js`.

The state machine must track:

```js
{
  round: number,
  phase: TurnPhase,          // see enum below
  H: number,                 // number of heroes in the game; set at construction, NEVER changes
  activeHeroId: string|null, // heroId of the hero whose turn it currently is (null during villain/env phases)
  activeControllerPlayerId: string|null, // socket user id of the player who controls the active hero
                             // null during villain/env phases (all players act cooperatively)
  heroOrder: HeroSlot[],     // ordered list; one entry per hero deck, regardless of how many players
  currentHeroIndex: number,
  lastActivityAt: Date,      // updated on every advance(); used for inactivity TTL
}
```

`HeroSlot` shape:
```js
{
  heroId: string,             // matches HeroPlayer.deckId
  controllerPlayerId: string, // socket user id of the human who manages this hero
}
```

**Why `heroId` ≠ `controllerPlayerId`:** A single player can manage multiple heroes.
`heroOrder` is an ordered list of heroes, each tagged with the socket user who controls
it. When `advance()` moves from `HERO_END(N)` to `HERO_START(N+1)`, the new
`activeControllerPlayerId` is read from `heroOrder[N+1].controllerPlayerId`. If that
is the same socket user as `heroOrder[N].controllerPlayerId`, that player's client
automatically gets focus on the next hero column — no special event needed; the
broadcasted game state carries it.

Turn phase enum:
```js
const TurnPhase = {
  SETUP:           'setup',
  VILLAIN_START:   'villain_start',
  VILLAIN_PLAY:    'villain_play',
  VILLAIN_END:     'villain_end',
  HERO_START:      'hero_start',
  HERO_PLAY:       'hero_play',
  HERO_POWER:      'hero_power',
  HERO_DRAW:       'hero_draw',
  HERO_END:        'hero_end',
  ENV_START:       'env_start',
  ENV_PLAY:        'env_play',
  ENV_END:         'env_end',
  GAME_OVER:       'game_over',
};
```

`TurnManager` methods:
- `advance()` — move to the next phase in sequence; update `activeHeroId` and
  `activeControllerPlayerId` accordingly; update `lastActivityAt = new Date()`;
  if the new phase is `HERO_START`, trigger a turn notification (see Step 3.7);
  return the new state for broadcasting
- `getCurrentTurnLabel()` — human-readable string, e.g. `"Round 3 — Legacy: Play Phase"`
- `isMyTurn(socketPlayerId)` — returns `true` when it is a hero phase AND
  `activeControllerPlayerId === socketPlayerId`. During villain/environment phases
  returns `true` for **all** players (cooperative). Used by client to enable/disable
  the "Advance Phase" button and card controls.
- `getH()` — returns `this.H` (never changes after construction)
- `getState()` — serialize for broadcast

Transition logic (no locking — any player can call `advance()` since the game is
cooperative):

```
SETUP
  → VILLAIN_START → VILLAIN_PLAY → VILLAIN_END
  → HERO_START(0) → HERO_PLAY(0) → HERO_POWER(0) → HERO_DRAW(0) → HERO_END(0)
  → HERO_START(1) → ...
  → HERO_START(N) → ... → HERO_END(N)
  → ENV_START → ENV_PLAY → ENV_END
  → VILLAIN_START (round++)
```

On each transition into a `HERO_*` phase, set:
```js
this.activeHeroId = this.heroOrder[this.currentHeroIndex].heroId;
this.activeControllerPlayerId = this.heroOrder[this.currentHeroIndex].controllerPlayerId;
```
On each transition into a `VILLAIN_*` or `ENV_*` phase, set both to `null`.

**Turn structure flexibility note:** `TurnManager.js` is the single point of change
for any turn structure adjustments discovered during playtesting. Adding a phase
(e.g. a `VILLAIN_POWER` phase between `VILLAIN_PLAY` and `VILLAIN_END`), removing a
phase, or reordering them requires only: (1) adding/removing keys from `TurnPhase`,
(2) updating the transition sequence in `advance()`, and (3) updating the label map
in `getCurrentTurnLabel()`. The socket event contract, game state shape, and all
client components other than `TurnTracker.jsx` are unaffected. This isolation is
intentional — do not bleed turn-phase logic into game.js or any client component
other than TurnTracker.

### Step 3.6 — Rewrite `game.js` for SotMDE

Replace the body of `server/game/game.js` with a SotMDE-aware implementation. Keep
the same class name and `module.exports` shape so that `gamerouter.js` requires no
changes.

**Card loading architecture note:** `gameserver.js` passes card data to the Game
constructor via `options.cardData`. For SotMDE, do NOT load cards from MongoDB inside
`game.js`; use the card data already loaded by `gameserver.js`. Accept
`options.cardData` as a map of `{ [cardId]: cardDataRecord }` and use it to
instantiate `SotmCard` objects.

Constructor must accept the existing Ashteki game creation payload shape and:

1. Read `details.heroSelection` — shape `{ [playerName]: deckId[] }` (one player may
   have multiple hero decks). Flatten into an ordered list of `HeroSlot` pairs using
   `details.heroOrder`. Create one `HeroPlayer` per entry.
2. Set `H = heroOrder.length` (total number of hero decks, regardless of player count).
   This value is fixed for the entire game.
3. Instantiate one `VillainController` using `details.villainDeckId`.
4. Instantiate one `EnvironmentController` using `details.environmentDeckId`.
5. Instantiate `TurnManager`, passing `H` and `heroOrder`.
6. Build each controller's card arrays from `options.cardData`, instantiating
   `SotmCard` for each card ID in the deck definition.
7. Shuffle all decks (except side decks where setup instructions say otherwise).
8. Deal 4 cards to each hero player's hand.
9. Move each character card to the `character` zone.
10. Initialize side deck zones for any hero/villain that has a `sideDeck` definition,
    and surface `setupInstructions` as a setup-phase chat message.
11. Set `phase` to `SETUP` and record `this.startedAt = new Date()`.

**Socket event handlers:**

| Event (client → server) | Handler action |
|---|---|
| `advancePhase` | Call `turnManager.advance()`; `logEvent`; `saveState`; broadcast |
| `playCard { cardId }` | Move card from active hero's hand to `playArea` or `trash` (one-shots) |
| `discardCard { cardId, zone }` | Move card between zones |
| `moveCard { cardId, fromZone, toZone, controllerId }` | Generic zone-to-zone move; call `card.clearPlayState()` if `fromZone === 'playArea' \|\| fromZone === 'character'` |
| `shuffleDeck { controllerId, zoneId }` | Shuffle target deck |
| `playTopCard { controllerId }` | `VillainController` / `EnvironmentController` only |
| `flipVillain` | Toggle `VillainController.isFlipped` |
| `adjustHp { controllerId, delta }` | Adjust HP on the hero or villain **character card** (controller-level HP tracker) |
| `drawCard { heroId, count }` | Hero draws n cards; auto-shuffles if needed |
| `modifyCard { cardId, controllerId, updates }` | Mutate one or more properties on an arbitrary card in any zone. `updates` permitted keys: `hp` (number\|null), `maxHp` (number\|null), `addKeyword` (string), `removeKeyword` (string), `token: { label: string, delta: number }`. Server validates keys, calls `card.applyUpdates(updates)`, broadcasts. Use cases: (a) play-area card gains HP for first time — `{ hp: 5, maxHp: 5 }`; (b) HP change — `{ hp: 3 }`; (c) add keyword — `{ addKeyword: 'ongoing' }`; (d) add token — `{ token: { label: 'bounty', delta: 1 } }`; (e) remove token — `{ token: { label: 'bounty', delta: -1 } }`. Tokens reaching 0 are removed entirely. |
| `searchDeck { controllerId, zoneId }` | Emit deck contents to requesting socket only (not broadcast) |
| `submitGameOver { result, notes, tags }` | Trigger `finaliseGame()` |
| `cancelGameOver` | Broadcast `gameOverCancelled` to all clients |
| `endSession` | Record abandoned outcome; transition to `GAME_OVER` |
| `sendMessage { text }` | Append to chat log; broadcast |

**Core methods:**

`broadcastGameState()`:
1. Serialise game state per-player (call `game.getState(playerName)` per socket — hero
   hands are hidden for non-owners).
2. Call `saveState()` (async, not awaited in hot path).
3. Call `logEvent()` for the triggering event (fire-and-forget).
4. Emit serialised state to each connected socket on channel `gamestate`.

`saveState()`:
- Upsert full serialised game state to `gameStates` MongoDB collection keyed by
  `gameId`. Enables async play and game node rehydration on reconnect.

`loadState(gameId)`:
- Load from `gameStates` collection and rehydrate all controller/manager objects.
- Called by game node when a socket connects to a game with no live in-memory instance.

`logEvent(eventType, actorId, payload)`:
- Insert one document to `gameEvents` collection (fire-and-forget; log errors but
  do not throw).
- Include `gameId`, `round`, `phase`, `timestamp`, `actorId`, `actorName`,
  `eventType`, `payload`.

`finaliseGame(result, notes, tags)`:
- Guard: return immediately if phase is already `GAME_OVER`.
- Derive version auto-tags: `deck:{id}@{version}` and `char:{id}@{version}` for
  every deck and character card currently in memory.
- Merge auto-tags with `tags` argument; deduplicate.
- Write to `gameOutcomes` collection (awaited).
- Set phase to `GAME_OVER`; broadcast.

`game.getState(forPlayerName)`:
- Returns the full broadcast state shape (see Phase 7, Step 7.1).
- Note: one socket user may control multiple heroes — expose the hands of ALL heroes
  whose `controllerPlayerId === forPlayerName`.

**`broadcastGameState()` architecture note:** Do NOT emit socket events directly from
`game.js`. Instead, implement `game.getState(forPlayerName)` and let
`server/gamenode/GameStateWriter.js` call it per player and emit on channel
`gamestate`. The `gamestate` string is the socket channel name the client subscribes
to (see `client/redux/reducers/lobby.js` `case 'gamestate':`). By Phase 7,
`GameStateWriter` will be rewritten to call `game.getState(playerName)` directly.

### Step 3.7 — Async play: game node stateless mode

Modify `server/gamenode.js`:

- On socket connection to a game, check whether an in-memory game object exists.
  If not, call `game.loadState(gameId)` to rehydrate from MongoDB before handling
  any events.
- On socket disconnect, do not destroy the game object immediately. Instead, set a
  short TTL (e.g. 60 seconds) after which the object is evicted from memory if no
  players have reconnected. State is already persisted to MongoDB so eviction is safe.
- The `lastActivityAt` field on `TurnManager` is updated on every `advance()`. A
  separate worker process (or a periodic MongoDB query) checks for games where
  `lastActivityAt` is older than `config.inactivityTimeoutHours` and calls
  `endSession()` on them, recording result as `"abandoned"`.

**Turn notification:**

In `TurnManager.advance()`, when the new phase is `HERO_START`, look up the active
hero player's user record and, if `config.notificationEmail.enabled`, send a
plain-text email notifying them it is their turn. Use nodemailer with the SMTP config
from `config.notificationEmail`. Wrap in try/catch; a failed notification must never
crash a game.

### Step 3.8 — Update game setup payload in the lobby

**`server/pendinggame.js`** stores all pre-game state and produces the payload sent
to the game node. The following changes are required:

1. **Add new fields** to the `PendingGame` constructor:
   ```js
   this.villainDeckId = details.villainDeckId || null;
   this.environmentDeckId = details.environmentDeckId || null;
   // heroSelection: { [playerName]: deckId[] } — each player may claim 1+ heroes
   this.heroSelection = {};
   // heroOrder: [{ heroId (=deckId), controllerPlayerId (=playerName) }]
   // ordered list built when the host locks in hero order before starting
   this.heroOrder = [];
   ```

2. **Add `addHeroDeck(playerName, deckId)` and `removeHeroDeck(playerName, deckId)`
   methods.** `addHeroDeck` validates: deck exists, `deckType === 'hero'`, deckId is
   not already claimed by any other player. Stores in `this.heroSelection[playerName]`.

3. **Add `setHeroOrder(orderedDeckIds)` method** called by the host to set the
   final turn order. Validates that `orderedDeckIds` is a permutation of all
   `deckId`s across all `heroSelection` entries. Validates that no two players have
   selected the same hero deck. Builds `this.heroOrder`.

4. **Replace the 2-player gate** at line ~147
   (`if (_.size(this.players) === 2 || this.started)`) with:
   ```js
   if (_.size(this.players) >= 1 && this.allHeroesSelected() || this.started)
   ```
   Add `allHeroesSelected()` helper: returns `true` when every player in
   `this.players` has at least one deckId in `this.heroSelection`, AND
   `this.villainDeckId` and `this.environmentDeckId` are both non-null, AND
   `this.heroOrder.length > 0`.

5. **Update `getStartGameDetails()`** to include the new fields:
   ```js
   villainDeckId: this.villainDeckId,
   environmentDeckId: this.environmentDeckId,
   heroSelection: this.heroSelection,   // { [playerName]: deckId[] }
   heroOrder: this.heroOrder,           // [{ heroId, controllerPlayerId }] in turn order
   ```
   Remove `solo`, `soloLevel`, `soloStage`, `pairing`, `league` from the returned
   object (removed from constructor in Step 1.7).

6. **Lobby server handler** (`server/lobbyserver.js` or `server/lobby.js`): update the
   game-creation socket handler to read `villainDeckId` and `environmentDeckId` from
   the client payload and set them on the pending game. Validate that each deck exists
   in MongoDB and has the correct `deckType` before accepting. Add handlers for
   `addhero { deckId }`, `removehero { deckId }`, and `setheroorder { orderedDeckIds }`
   socket events.

7. **Card data injection** (`server/gamenode/gameserver.js`): update the lobby's
   card-data sender to include the full card records for all three selected decks
   (hero decks for all players + villain + environment) keyed by card id, so
   `gameserver.js` can pass them to `new Game(pendingGame, { cardData })` as before.

---

## Phase 4 — Client: Lobby Changes

All client code lives under `client/`. It is a React app built with Vite.

### Step 4.1 — Update the deck/hero selection flow

**Architecture note:** In Ashteki, deck selection does NOT happen in `NewGame.jsx`.
`NewGame.jsx` is the game-creation form (name, format, spectator options). Deck
selection happens *after* the game is created, in the pending game lobby screen, via
`client/Components/Games/PendingGamePlayers.jsx` which opens `SelectDeckModal.jsx`.

Changes required:

**`NewGame.jsx`** — add two new dropdowns to the game creation form:
1. Add `villainDeckId: ''` and `environmentDeckId: ''` to `initialValues`.
2. Add a `useEffect` that fetches `/api/sotm/decks?type=villain` and
   `/api/sotm/decks?type=environment` on mount, storing results in local state.
3. Render two `<Form.Select>` fields inside the Formik form, each populated from the
   fetch state. Each option shows deck name, version badge, card count, and setup
   instructions snippet.
4. Add `.required()` validation for both new fields to the Yup schema.
5. Disable "Create Game" until both are selected and no two players share a hero.
6. Strip Ashes-specific fields: ranked, format selector, clock type, time limit, solo,
   saveReplay. The simplified form should have: name, password, allowSpectators,
   villainDeckId, environmentDeckId.

**`SotmDeckGrid.jsx`** — create as a thin adaptation of the existing `DeckGrid.jsx`
(do not modify the original). The only substantive change: render
`<img src={deck.characterCard?.imageUrl} alt={deck.name} />` instead of
`<div className={d.phoenixborn[0].id}>`. Click handler, selection highlight, and
grid layout CSS are reusable.

**`SotmHeroSelectModal.jsx`** — create using `SelectDeckModal.jsx`'s Bootstrap Modal
shell (`<Modal show onHide>`) with the Ashes-specific tab/deck-list contents replaced
by `SotmDeckGrid`. The modal:
- Fetches `/api/sotm/decks?type=hero` on mount.
- Passes the deck list to `SotmDeckGrid`.
- Heroes already claimed by any player arrive via `currentGame.heroSelection` from
  lobby state; grey them out in the grid.
- On selection, emits `addhero { deckId }` socket event.
- Players can also emit `removehero { deckId }` to deselect.

**`PendingGamePlayers.jsx`** — keep the player-row iteration structure; replace the
insides. Each player's row shows a list of their claimed hero names as Bootstrap
badges/chips, with an `[+ Add Hero]` button that opens `SotmHeroSelectModal`. Remove
all Chimera/solo controls, `DeckStatus`, and the existing `sendSocketMessage('selectdeck', ...)`.

**Hero turn order panel** — `react-dnd` is already installed and used by
`client/Components/GameBoard/Card.jsx` (drag source) and `Droppable.jsx` (drop
target). Create `HeroOrderPanel.jsx` below the player rows. The host sees each
claimed hero as a draggable item; dropping reorders the list. When satisfied, the
host clicks "Confirm Order" which emits `setheroorder { orderedDeckIds: string[] }`.
Once confirmed, the panel shows the final order as a numbered read-only list visible
to all players.

**`PendingGame.jsx`** — update to display the chosen villain and environment deck
names (with version badge) in the game details sidebar.

### Step 4.2 — Remove ashes.live deck import

- Delete or stub `client/Components/Decks/` components that interface with ashes.live.
- Remove the "My Decks" nav item.
- Add "Card Library" nav item: browse all cards, filterable by source and deck.
  Visibility rules: official and manual cards visible to all authenticated users;
  user-source cards visible only to their owner and admins.

### Step 4.3 — Add user deck upload UI

Create `client/Components/Decks/UploadDeck.jsx`:

- File picker accepting `.json` only.
- On selection, POST to `POST /api/sotm/decks/upload`.
- Display structured response: list of warnings (deck size, broken image URLs) and
  confirmation of cards imported.
- After successful import, run client-side image preload check: attempt to load each
  `imageUrl` as an `Image` object and display a warning list for any that fail.
- Show "My Uploaded Decks" list with delete option for each.

### Step 4.4 — Add admin card image upload UI

Create `client/Components/Admin/UploadCardImage.jsx`, visible only to admin role.

- Card ID input (autocomplete from card library).
- File picker accepting JPEG/PNG/WebP only.
- POST to `POST /api/admin/cards/upload-image`.
- On success, display the new `imageUrl` and update the card preview.

### Step 4.5 — Update player profile and lobby sidebar

Remove any Ashes-specific stats (win/loss by Phoenixborn, etc.). Keep generic stats
(games played, wins).

---

## Phase 5 — Client: Game Board UI

This is the most visible change. Work in `client/Components/GameBoard/`.

**Ashteki prompt-system dead code:** The existing `client/Components/GameBoard/`
folder contains a prompt-driven turn system that assumes the server pushes
"here are your choices" prompts to the client. These components become dead code
the moment `SotmBoard.jsx` goes live — do NOT import them in any new component:

- `ActivePlayerPrompt.jsx` — prompt widget with buttons, title, timer
- `SplashPlayerPrompt.jsx` — full-screen prompt overlay
- `AlertSplash.jsx` — alert overlay triggered by `promptState.showAlert`
- `ActivePromptControls.jsx`, `ActivePromptButtons.jsx` — prompt sub-components
- `Sidebar.jsx` — currently passes `currentPhase` and `promptState` from game state;
  SotmBoard should either not use it or render a replacement sidebar that reads from
  the new state shape
- `PlayerStats.jsx` — renders `activePlayer` badge and `firstPlayer` token; replaced
  entirely by `HeroArea` per-hero column layout
- `ReplayControls.jsx` — replay system disabled in Phase 1
- `ChimeraRow.jsx`, `PlayerPBRow.jsx`, `PlayerRow.jsx` — Ashes-specific player rows

All of the above are deleted in Phase 10. Until then they are unused but harmless.

### Step 5.1 — Define the new layout grid

Replace the existing two-player battlefield layout with a three-row layout:

```
┌────────────────────────────────────────────────┐
│  VILLAIN AREA                                  │
│  [ Char card + HP ] [ Play area ] [ Deck/Trash ]│
├────────────────────────────────────────────────┤
│  ENVIRONMENT AREA                              │
│  [ Play area ] [ Deck/Trash ]                  │
├────────────────────────────────────────────────┤
│  HERO AREAS (one column per hero player)       │
│  [ Char card ] [ Play area ] [ Hand ] [ Deck ] │
└────────────────────────────────────────────────┘
```

For 1–5 heroes, the hero areas should be horizontally scrollable if they overflow.
The active hero's column is highlighted with a coloured border.

Create `client/Components/GameBoard/SotmBoard.jsx` as the new top-level board
component. Wire it into `client/AppRoutes.jsx` in place of the existing `GameBoard`
import:
```jsx
// AppRoutes.jsx — replace:
import GameBoard from './Components/GameBoard/GameBoard.jsx';
// with:
import SotmBoard from './Components/GameBoard/SotmBoard.jsx';
```
The two route entries that render `<GameBoard />` when `currentGame?.started` should
render `<SotmBoard />` instead.

### Step 5.2 — Create `VillainArea` component

`client/Components/GameBoard/VillainArea.jsx`

Props: `{ villain: VillainState, isActiveTurn: bool, onAction: fn }`

Renders:
- Character card widget (name, HP dial, flip indicator, "FLIPPED" badge if flipped,
  **token badges** — render one badge per entry in `characterCard.tokens`:
  `label ×count`, e.g. `bounty ×2`)
- Play area (each card: name, type, HP dial if `card.maxHp !== null`, **token badges**
  for each entry in `card.tokens`, context menu)
- Deck pile (card count, "Play Top Card" button, "Shuffle" button)
- Trash pile (card count, click to browse)
- Auxiliary zone widgets if `villain.auxiliaryZones.length > 0`

### Step 5.3 — Create `EnvironmentArea` component

`client/Components/GameBoard/EnvironmentArea.jsx`

Props: `{ environment: EnvironmentState, isActiveTurn: bool, onAction: fn }`

No character card or HP. Play-area cards still render token badges and HP dials
where applicable. Otherwise same zone widgets as `VillainArea`.

### Step 5.4 — Create `HeroArea` component

`client/Components/GameBoard/HeroArea.jsx`

Props: `{ hero: HeroState, isMe: bool, isActiveTurn: bool, onAction: fn }`

Renders:
- Character card (name, HP dial, "INCAPACITATED" overlay when `isIncapacitated`,
  **token badges** from `hero.characterCard.tokens` — cleared automatically when
  `incapacitate()` was called, so no special hiding needed)
- Play area (each card: HP dial if `card.maxHp !== null`, **token badges** from
  `card.tokens`, context menu)
- Hand (face-up if `isMe`; face-down card backs otherwise)
- Deck pile + Trash pile
- Auxiliary zone widgets if present

When `isMe && isActiveTurn`:
- Cards in hand are draggable/clickable to play
- "End Phase" button is active

### Step 5.5 — Create `TurnTracker` component

`client/Components/GameBoard/TurnTracker.jsx`

Props: `{ turnState: TurnState, myPlayerId: string }`

Displays:
- Round number
- **H value** — always visible, e.g. `H = 3`. Display it prominently (badge or
  labelled chip). H is fixed for the entire game; do not grey it out when heroes are
  incapacitated.
- Current phase label, e.g. `"Legacy — Play Phase"` or `"Villain — Play Phase"`
- Active controller name (hero name during hero phases; "Villain" / "Environment"
  during those phases)
- **"Advance Phase" button** — enabled for any player when `turnState.phase` is a
  villain or environment phase; enabled only for the player whose
  `turnState.activeControllerPlayerId === myPlayerId` during hero phases.
- **"End Game" button** — always visible, muted styling, distinct from Advance Phase.
  Opens `GameOverModal` on all clients simultaneously (emits `initiateGameOver` to
  server which broadcasts `gameOverPrompt` to all clients).

Position: fixed top bar above the board layout.

### Step 5.6 — Create the card context menu

`client/Components/GameBoard/CardContextMenu.jsx`

A right-click / long-press popup on any card in any zone. Available actions depend
on which zone the card is in:

| Zone | Actions |
|---|---|
| Hand (own) | Play, Discard |
| Play area | Move to Trash, Return to Hand, Return to Deck, **Add Keyword**, **Remove Keyword** (submenu of current keywords), **Set Max HP** (only if `card.maxHp === null`), **Adjust HP** (+1, −1 — only if `card.hp !== null`), **Add Token**, **Remove Token** (submenu of current token labels) |
| Deck (top) | Look at Top Card, Shuffle Deck |
| Trash | Return to Deck, Return to Play |
| Character card | Adjust HP (+1, −1, set value), Flip (villain only), **Add Token**, **Remove Token** (submenu of current token labels) |

"Set Max HP" dispatches `modifyCard { ..., updates: { hp: n, maxHp: n } }` and is
only shown when `card.maxHp === null`. Cards with a JSON `hp` value already have
`maxHp` set at construction and will never show this action — they show only
"Adjust HP".

"Adjust HP" on a play-area card dispatches
`modifyCard { ..., updates: { hp: card.hp + delta } }`,
**not** `adjustHp` (which is reserved for controller-level character card HP).

"Add Token" opens a small input for a label string and dispatches
`modifyCard { ..., updates: { token: { label, delta: 1 } } }`.
If the label already exists, each subsequent "Add Token" for the same label
increments the count.

"Remove Token" shows a submenu of the card's current token labels (from
`card.tokens`); selecting one dispatches
`modifyCard { ..., updates: { token: { label, delta: -1 } } }`.

Token labels that reach 0 are removed automatically by `applyUpdates()`. Tokens are
displayed on the card face as small labelled badges (e.g. `bounty ×3`).

All actions dispatch a socket event to the server (see Phase 3, Step 3.6).

### Step 5.7 — Create the deck search modal

`client/Components/GameBoard/DeckSearchModal.jsx`

Triggered by a "Search Deck" button on any deck pile. Shows all cards in the deck as
a scrollable list (card name, type, keywords). Selecting a card and pressing "Move to
Hand" dispatches a `moveCard` event. The deck is not revealed to other players through
this view — server sends deck contents only to the requesting socket.

### Step 5.8 — Wire the HP dial

Create a reusable `HpDial.jsx` component. It must work in two contexts:

**On a character card** (hero or villain, always has HP):
- Props: `{ hp, maxHp, onAdjust: (delta) => void, isIncapacitated }`
- `+` / `−` buttons dispatch the `adjustHp { controllerId, delta }` event
- Turns red below 25% of `maxHp`
- Shows "INCAPACITATED" overlay at `hp <= 0`

**On a play-area card** (conditionally — only rendered when `card.maxHp !== null`):
- Props: `{ hp, maxHp, onAdjust: (delta) => void }`
- Same `+` / `−` buttons, but dispatch `modifyCard { cardId, controllerId, updates: { hp: newHp } }` instead of `adjustHp`
- No incapacitated state (applies only to heroes)
- Display as `hp / maxHp` (e.g. `4 / 6`)

**Gate on `maxHp !== null`, NOT `hp !== null`:** Use `maxHp` as the condition to
show the dial. `hp` can legitimately be 0 (damaged to zero) which must still show
the dial. `maxHp` is null only for cards that have never had HP assigned.

The component itself is identical in both contexts — the difference is which event
the parent dispatches via the `onAdjust` callback.

### Step 5.9 — Auxiliary zone widgets

`client/Components/GameBoard/AuxZone.jsx`

Reusable widget rendering one auxiliary zone (side deck). Props:
`{ zone: AuxZoneState, label: string, onAction: fn }`

Renders a deck pile and trash pile with the zone's name label. Supports the same
context menu actions as the main deck/trash.

### Step 5.10 — Game Over modal

`client/Components/GameBoard/GameOverModal.jsx`

Opens on all clients simultaneously when any player presses "End Game" (server
broadcasts `gameOverPrompt`). Contains:

- Result selector: "Heroes Won" / "Villain Won"
- Free-text notes field
- Tag input (add/remove tags; displays existing tags as removable chips).
  Pre-populate with auto-tags derived client-side from the current game state
  (matching what the server will compute) so players can see what will be recorded.
- "Cancel" button — emits `cancelGameOver`; closes modal on all clients on receipt
  of `gameOverCancelled`
- "End Game & Record" button — emits `submitGameOver { result, notes, tags }`

### Step 5.11 — Post-game summary screen

Shown after `GAME_OVER` phase is received. Displays:
- Result (win/loss)
- Decks used with version badges
- Round count, duration, final HP values
- Auto-generated tags
- Manual notes (editable if not yet submitted; read-only after)
- "View Event Log" link
- "Return to Lobby" button

Board becomes non-interactive at `GAME_OVER`: apply a darkened overlay to all play
areas. Cards cannot be dragged or clicked. HP dials are disabled. Chat log remains
readable.

---

## Phase 6 — API Routes

### Step 6.1 — Deck listing endpoint

`GET /api/sotm/decks?type=hero|villain|environment&source=official|manual|user`

Returns array of `{ id, name, deckType, version, characterVersion, cardCount,
setupInstructions, source }`. Used by game creation screen and card library.

### Step 6.2 — Card library endpoint

`GET /api/sotm/cards?deckId=xxx&source=official|manual|user`

Returns all cards for the given query. Filters `source: "user"` to
`uploadedBy === req.user.id` unless requester is admin.

### Step 6.3 — User deck upload endpoint

`POST /api/sotm/decks/upload`

Accepts JSON body:
```json
{
  "deck": { ...deck fields... },
  "characterCard": { ...card fields... },
  "cards": [ ...card fields... ]
}
```

Server-side:
1. Validate required fields on all cards and deck.
2. Check for `id` collisions with existing cards; return error listing collisions.
3. Set `source: "user"`, `uploadedBy: req.user.id` on all documents.
4. Validate `version` present on deck; default card `version` to deck version if null.
5. Compute and store `cardCount`.
6. Check deck size against expected (40/25/15 for declared `deckType`); include
   warning in response if mismatch but do not reject.
7. Upsert cards and deck into MongoDB.
8. Trigger placeholder generation for any card with null or missing `imageUrl`.
9. Return `{ success: true, warnings: [...], cardCount, deckId }`.

### Step 6.4 — Admin card image upload endpoint

`POST /api/admin/cards/upload-image` — admin role required.

Uses Multer. Accepts JPEG/PNG/WebP only; max 3 MB. Generates UUID filename. Writes
to `public/card-images/manual/`. Updates card document's `imageUrl` in MongoDB.
Returns new `imageUrl`.

### Step 6.5 — Admin stats endpoints

`GET /api/admin/stats/outcomes` — admin role required.

Returns aggregated outcomes: total games, win rate by villain deck+version, win rate
by hero deck+version, average duration, most common hero combinations. Supports query
params: `villainDeckId`, `heroDeckId`, `version`, `result`, `dateFrom`, `dateTo`.

`GET /api/admin/stats/games` — admin role required.

Paginated list of completed games: result, decks+versions used, duration, round
count. Each row links to the event log.

`GET /api/admin/stats/games/:gameId/events` — admin role required.

Full ordered event log for one game. Supports `eventType` filter query param.

### Step 6.6 — Protect Ashes-only routes

Existing `GET /api/decks` (ashes.live import) should return 404. Do not delete —
may be referenced in tests.

---

## Phase 7 — Game State Serialisation

### Step 7.1 — Define the game state shape sent to clients

`game.getState(forPlayerName)` must return:

```js
{
  gameId: string,
  round: number,
  phase: TurnPhase,
  H: number,                              // fixed for the game; number of hero decks
  activeHeroId: string | null,            // heroId whose turn it is; null during villain/env
  activeControllerPlayerId: string | null, // socket user id in control; null during villain/env
  villain: VillainState,
  environment: EnvironmentState,
  heroes: HeroState[],                    // in heroOrder sequence
  chatLog: ChatMessage[],
  setupInstructions: string | null,       // shown until phase leaves SETUP
  isGameOver: boolean,
}
```

`VillainState` and `EnvironmentState` expose all zones (no hidden information).
`HeroState` exposes hand contents only when the serialisation target is that hero's
`controllerPlayerId`; all other players see hand as an array of `{ faceDown: true }`
placeholders. Note that one socket user may control multiple heroes —
`game.getState(playerName)` must expose the hands of ALL heroes whose
`controllerPlayerId === playerName`.

Serialisation must be player-specific: call `game.getState(playerId)` per socket.

### Step 7.2 — Rewrite `GameStateWriter.js` and delete stale writers

These files in `server/gamenode/` were stubbed in Phase 1 (Step 1.6).

**`server/gamenode/GameStateWriter.js`** — rewrite to delegate to `game.getState()`:
```js
class GameStateWriter {
    constructor(game) { this.game = game; }

    getStateForPlayer(player) {
        return this.game.getState(player.name);
    }

    getStateForReplay() {
        return this.game.getState(null);
    }

    getState(userName) {
        return this.game.getState(userName);
    }
}
module.exports = GameStateWriter;
```

**`server/gamenode/PlayerStateWriter.js`** and **`CardStateWriter.js`** — delete
these files entirely. The SotMDE serialization is handled directly by
`HeroPlayer.getState()`, `VillainController.getState()`, and
`EnvironmentController.getState()`, called from `game.getState()`.

**`server/gamenode/DieStateWriter.js`** — delete this file.

### Step 7.3 — Implement Redux / state management wiring on the client

**Architecture note:** Ashteki's game state arrives at the client via the `gamestate`
socket channel and is stored in `client/redux/reducers/lobby.js` as
`state.lobby.currentGame` (not in a separate game reducer). The reducer handles
`case 'gamestate':` at line ~268 and writes to `newState.currentGame`. Do **not**
create a new reducer; update the existing one.

The `gamestate` case currently copies the payload to `currentGame` as-is. After this
step it will receive the new SotMDE shape from Step 7.1. No structural reducer change
is needed.

Add selectors in a new file `client/redux/selectors/game.js`:
```js
export const selectVillain     = (state) => state.lobby.currentGame?.villain;
export const selectEnvironment = (state) => state.lobby.currentGame?.environment;
export const selectHeroes      = (state) => state.lobby.currentGame?.heroes ?? [];

// All heroes controlled by the given socket user (may be more than one)
export const selectMyHeroes    = (state, myPlayerId) =>
    state.lobby.currentGame?.heroes?.filter(h => h.controllerPlayerId === myPlayerId) ?? [];

// The hero currently taking their turn (null outside hero phases)
export const selectActiveHero  = (state) =>
    state.lobby.currentGame?.heroes?.find(
        h => h.id === state.lobby.currentGame?.activeHeroId
    ) ?? null;

export const selectTurnState   = (state) => ({
    round:                    state.lobby.currentGame?.round,
    phase:                    state.lobby.currentGame?.phase,
    H:                        state.lobby.currentGame?.H,
    activeHeroId:             state.lobby.currentGame?.activeHeroId,
    activeControllerPlayerId: state.lobby.currentGame?.activeControllerPlayerId,
});

export const selectIsGameOver        = (state) =>
    state.lobby.currentGame?.isGameOver ?? false;

export const selectSetupInstructions = (state) =>
    state.lobby.currentGame?.setupInstructions ?? null;
```

`selectMyHeroes` returns an array so a single player can render and interact with
all of their assigned hero columns.

---

## Phase 8 — Chat and Game Log

### Step 8.1 — Adapt the existing chat panel

Confirm the `sendMessage` socket event works end-to-end. One change is required
in `client/Components/GameBoard/Messages.jsx`: it currently applies CSS classes
`this-player` / `other-player` based on `message.activePlayer` (an Ashes concept).
Replace this logic with styling based on `message.type`:
- `type: 'system'` — muted/italic, no player attribution
- `type: 'action'` — normal weight, player name prefix
- `type: 'chat'` — standard chat styling

Remove any reference to `message.activePlayer` from `Messages.jsx`.

### Step 8.2 — Auto-log phase transitions

In `TurnManager.advance()`, after changing phase, push to the game's chat log:
```js
{ type: 'system', text: `Round ${round} — ${getCurrentTurnLabel()}` }
```

### Step 8.3 — Auto-log card moves

In `game.js`, after every `moveCard` / `playCard` / `discardCard` / `adjustHp`
event, push:
```js
{ type: 'action', text: `${playerName}: ${actionDescription}` }
```

---

## Phase 8.5 — Playtesting Data Logging

### Step 8.5.1 — Create MongoDB collections and indexes

`gameEvents` collection indexes:
- `{ gameId: 1, round: 1, timestamp: 1 }` — primary query pattern
- `{ gameId: 1, eventType: 1 }` — for filtered event log views

`gameOutcomes` collection indexes:
- `{ villainDeckId: 1, result: 1 }`
- `{ 'heroes.heroDeckId': 1, result: 1 }` (multikey)
- `{ villainDeckId: 1, villainDeckVersion: 1, result: 1 }`
- `{ endedAt: 1 }` — for date-range queries

`gameStates` collection indexes:
- `{ gameId: 1 }` unique — for async state persistence and rehydration

### Step 8.5.2 — Implement `logEvent()` in `game.js`

```js
logEvent(eventType, actorId, payload) {
  db.collection('gameEvents').insertOne({
    gameId: this.id,
    round: this.turnManager.round,
    phase: this.turnManager.phase,
    timestamp: new Date(),
    actorId,
    actorName: this.getPlayerName(actorId),
    eventType,
    payload,
  }).catch(err => logger.error('gameEvents insert failed', err));
}
```

Wire a `logEvent` call into every socket event handler in `game.js` using the
vocabulary from `eventTypes.js`.

### Step 8.5.3a — Implement `finaliseGame()` in `game.js`

```js
async finaliseGame(result, notes, tags) {
  if (this.turnManager.phase === TurnPhase.GAME_OVER) return;

  const autoTags = this.deriveVersionTags();
  const mergedTags = [...new Set([...autoTags, ...tags])];

  await db.collection('gameOutcomes').insertOne({
    gameId: this.id,
    startedAt: this.startedAt,
    endedAt: new Date(),
    durationMinutes: Math.round((Date.now() - this.startedAt) / 60000),
    rounds: this.turnManager.round,
    result,
    villainDeckId: this.villain.deckId,
    villainDeckVersion: this.villain.deckVersion,
    villainCharacterVersion: this.villain.characterCard?.version ?? null,
    villainFinalHp: this.villain.hp,
    villainWasFlipped: this.villain.isFlipped,
    environmentDeckId: this.environment.deckId,
    environmentDeckVersion: this.environment.deckVersion,
    heroes: this.heroPlayers.map(h => ({
      playerId: h.id,
      playerName: h.name,
      heroDeckId: h.deckId,
      heroDeckVersion: h.deckVersion,
      heroCharacterVersion: h.characterCard?.version ?? null,
      finalHp: h.hp,
      wasIncapacitated: h.isIncapacitated,
      cardsPlayed: this.countEventsForPlayer(h.id, EVENT_TYPES.PLAY_CARD),
    })),
    notes,
    tags: mergedTags,
  });
}
```

`deriveVersionTags()` — constructs tags of the form `deck:{id}@{version}` and
`char:{id}@{version}` from all loaded deck and character card objects in memory.

### Step 8.5.3b — Game Over socket event wiring

Socket events to add to `game.js`:

`initiateGameOver` (from any client — triggers the modal on all clients):
1. Broadcast `gameOverPrompt` to all connected sockets.

`submitGameOver { result, notes, tags }`:
1. Guard: if phase is already `GAME_OVER`, return.
2. Call `logEvent(EVENT_TYPES.GAME_OVER, actorId, { result })`.
3. Await `finaliseGame(result, notes, tags)`.
4. Set phase to `GAME_OVER`; broadcast.

`cancelGameOver`:
1. Broadcast `gameOverCancelled` event to all clients.
2. Clients close the modal on receipt.

### Step 8.5.3c — Post-game summary screen

See Step 5.11.

### Step 8.5.3d — Board non-interactive overlay

On receipt of `isGameOver: true` in Redux state, apply a CSS overlay class to all
play areas. Cards cannot be dragged or clicked. HP dials are disabled. Chat and
summary screen remain interactive.

### Step 8.5.4 — Notes and tags in the Game Over modal

See Step 5.10. Tags field supports free-text entry with enter-to-add and
click-to-remove chip UI.

### Step 8.5.5 — Abandoned game handling

Two triggers for `result: "abandoned"`:

1. **Explicit:** "End Session" button (in addition to "End Game"). Skips the result
   selector; sets result to `"abandoned"` directly. Still captures notes and tags.
   Emits `endSession` socket event.

2. **Inactivity TTL:** A periodic process (cron job or MongoDB TTL index on
   `gameStates.lastActivityAt`) identifies games inactive longer than
   `config.inactivityTimeoutHours`. For each, call `finaliseGame("abandoned", "", [])`.
   Log the auto-abandonment to the console.

### Step 8.5.6 — Admin stats API

See Step 6.5.

### Step 8.5.7 — Admin stats React page

`client/Components/Admin/StatsPage.jsx` — admin role gated.

Views:
- **Overview:** total games, win rate by villain (with version breakdown), win rate
  by hero (with version breakdown), average duration.
- **Game list:** paginated, sortable by date/result/duration. Version badges next to
  deck names. Rows link to event log viewer.
- **Event log viewer:** full event log for one game, filterable by `eventType`.
  Displays round, phase, actor, and payload for each event.
- **Filters:** deck version selector (shows count of games per version), date range,
  result filter.

When a deck version has changed since previous games, display a notice on the deck's
stats row: e.g. "23 games on v1.1.0 · 4 games on v1.2.0."

---

## Phase 9 — Testing & Smoke Checks

### Step 9.1 — Manual smoke test checklist

Run with two browser windows logged in as different users:

**Lobby and setup:**
- [ ] Basic Auth gate works when `privateMode: true`
- [ ] Two users can create and join a game with valid hero/villain/environment selections
- [ ] Duplicate hero selection is rejected
- [ ] Setup instructions for a side-deck character appear in chat and as a banner
- [ ] All hero hands are dealt (4 cards each)
- [ ] Character cards appear with correct HP

**Gameplay:**
- [ ] "Advance Phase" cycles through the full round sequence and returns to Villain Start
- [ ] Phase transitions appear as system messages in chat log
- [ ] A hero plays a card; it appears in play area on both browsers
- [ ] One-shot card goes to trash rather than play area
- [ ] An incapacitated hero's play area shows overlay; tokens are cleared
- [ ] "Play Top Card" on villain deck moves card to villain play area on both browsers
- [ ] Deck auto-reshuffles from trash when empty
- [ ] Card context menu appears with correct actions per zone
- [ ] Token add/remove via context menu updates badge count on both browsers
- [ ] Tokens are cleared when card is moved out of play area
- [ ] Card moves appear as action messages in chat log
- [ ] HP dial adjusts and turns red below 25%; shows INCAPACITATED at 0
- [ ] `modifyCard` sets HP on a play-area card; dial appears after Set Max HP
- [ ] Villain flip toggles badge on both browsers
- [ ] Deck search modal shows only to requesting player
- [ ] Side deck zones render for characters with a `sideDeck` definition
- [ ] Placeholder images render for cards with no `imageUrl`
- [ ] Cards with a `template` override render via the correct template (or default)
- [ ] H value shown in TurnTracker; correct for game hero count; doesn't change on incapacitation

**Game over and logging:**
- [ ] "End Game" button opens modal on all connected browsers simultaneously
- [ ] "Cancel" closes modal on all browsers
- [ ] Submitting with result, notes, and tags writes to `gameOutcomes`
- [ ] Auto-tags include all deck and character versions
- [ ] Post-game summary screen shows correct derived stats
- [ ] Board is non-interactive after game over
- [ ] "End Session" records `result: "abandoned"`
- [ ] `gameEvents` collection has one document per socket event

**Async play:**
- [ ] Closing browser and reconnecting rehydrates game state from MongoDB
- [ ] Turn notification email fires when hero turn begins (if configured)

**Admin:**
- [ ] Card image upload endpoint writes to `public/card-images/manual/`
- [ ] User deck upload returns warnings for non-standard deck sizes
- [ ] Admin stats page shows win rates with version breakdown
- [ ] Event log viewer shows all events for a completed game

### Step 9.2 — Test suite

Run `npm test`. Expected failures: all tests under `test/server/game/cards/` — delete
these. Retain and fix tests covering lobby, user, and socket plumbing.

New test files to write:
- `test/server/game/sotm/turnManager.test.js` — full phase transition sequence,
  H value, `isMyTurn` for all player/phase combinations, `lastActivityAt` update
- `test/server/game/sotm/heroPlayer.test.js` — `drawCard` auto-reshuffle, `playCard`
  one-shot routing, `getState` hand hiding, token clear on `discardCard` from playArea
- `test/server/game/sotm/cardImageGenerator.test.js` — placeholder generation,
  `shouldGeneratePlaceholder` logic
- `test/server/game/sotm/cardTemplates/textUtils.test.js` — `escapeXml` special
  characters, `wrapText` edge cases (empty string, very long word, null input)
- `test/server/game/sotm/finaliseGame.test.js` — auto-tag derivation, duplicate
  guard, `GAME_OVER` phase guard

---

## Phase 10 — Cleanup and Documentation

### Step 10.1 — Remove dead code

- Delete all stubbed-out files from Phase 1 that are no longer imported anywhere.
- Delete the Ashteki prompt-system components that became dead code when `SotmBoard`
  replaced `GameBoard` (none of these are imported by any SotMDE component):
  `ActivePlayerPrompt.jsx`, `SplashPlayerPrompt.jsx`, `AlertSplash.jsx`,
  `ActivePromptControls.jsx`, `ActivePromptButtons.jsx`,
  `ChimeraRow.jsx`, `PlayerPBRow.jsx`, `PlayerRow.jsx`, `PlayerPBRow.scss`,
  `PlayerStats.jsx`, `ReplayControls.jsx`, `GameBoard.jsx`, `GameBoard.scss`.
  Verify each is not imported before deleting (`grep -r 'GameBoard' client/` etc.).
- Run `npm run lint` and fix all warnings.
- Delete `.vscode/` settings referencing Ashes-specific paths.

### Step 10.2 — Update the docs folder

Replace existing Ashes/Keyteki guides with:
- `docs/setup.md` — local development setup; privateMode configuration
- `docs/card-data.md` — official and manual card/deck JSON format; running the
  import script; version bump workflow; `imageUrl` heterogeneity (root-relative,
  absolute external, or placeholder paths)
- `docs/user-decks.md` — user deck JSON upload format; image URL guidance; version
  field; side decks
- `docs/card-templates.md` — SVG template contract `(card) => svgString`; how to
  create a new named template; shared utilities reference
- `docs/game-model.md` — HeroPlayer, VillainController, EnvironmentController,
  TurnManager; zone types; event types vocabulary; H value and HeroSlot model
- `docs/logging.md` — gameEvents and gameOutcomes schemas; auto-tag format; how to
  query outcomes by deck version
- `docs/admin.md` — making a superuser; card image upload; stats page; private mode
  configuration

### Step 10.3 — Update Docker configuration

- Rename service labels in `docker-compose.yml` from `ashteki` to `sentinels`.
- Update README import command to `node server/scripts/importSotmData.js`.
- Document the `privateMode` environment variable override for Docker deployments
  (e.g. `PRIVATE_MODE=true` passed via `docker-compose.override.yml`).

---

## Dependency Map Between Steps

```
0.1 → 0.2 → 0.3
0.3 → 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 → 1.8
1.8 → 2.1 → 2.2 → 2.3 → 2.4 → 2.5
      2.5 → 2.6.1 → 2.6.2 → 2.6.3 → 2.6.4 → 2.6.5 → 2.6.6 → 2.6.7 → 2.6.8
      2.5 → 2.7
2.6.8 + 2.7 → 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6 → 3.7 → 3.8
3.8  → 4.1 → 4.2 → 4.3 → 4.4 → 4.5
3.6  → 5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.6 → 5.7 → 5.8 → 5.9 → 5.10 → 5.11
3.6  → 6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 6.6
5.x + 6.x → 7.1 → 7.2 → 7.3
7.3  → 8.1 → 8.2 → 8.3
8.3  → 8.5.1 → 8.5.2 → 8.5.3a → 8.5.3b → 8.5.3c → 8.5.3d
              → 8.5.4 → 8.5.5 → 8.5.6 → 8.5.7
8.5.7 → 9.1 → 9.2
9.2  → 10.1 → 10.2 → 10.3
10.3 → 11.x (playtesting feedback loop — unordered)
```

Phases 4, 5, and 6 can proceed in parallel once Phase 3 is complete and the socket
event contract (Step 3.6 event table) is agreed on. Step 7.x (serialization) depends
on Phase 3 being complete; it can run in parallel with 4/5/6.

Phase 11 steps are unordered and may run repeatedly as playtesting feedback arrives.

---

## Risk Areas & Notes for the Agent

**`game.js` size.** In the Keyteki lineage this file is typically 1,000–2,000 lines.
Read it in full and map every method before beginning Step 3.6.

**`GameStateWriter` is the real serialization layer.** The plan refers to
`game.broadcastGameState()` as a conceptual shorthand, but the actual mechanism is
`gameserver.js` calling `new GameStateWriter(game).getStateForPlayer(player)` and then
`player.socket.send('gamestate', state)`. `gamestate` is the socket channel name the
client subscribes to. Step 7.2 (rewriting GameStateWriter) is what connects game.js
state to the client.

**`pendinggame.js` is the handshake point.** Everything the game node receives arrives
via `getStartGameDetails()`. If a field is not added there, the game constructor never
sees it.

**Async play and the game node memory model.** Step 3.7 changes how the game node
manages game object lifetime. This is a cross-cutting concern — test reconnection and
rehydration thoroughly before moving to Phase 4.

**CARD_TYPES breaking rename.** `'hero'`, `'villain'`, `'environment'` are now
`'heroCard'`, `'villainCard'`, `'environmentCard'`. Any existing card data or code
using the old strings must be updated consistently across schema, import script,
models, and client components.

**SVG text wrapping.** SVG has no native word wrap. The `wrapText` utility in
Step 2.6.2 is the fiddliest part of placeholder generation. Test it against edge
cases before wiring it into the generator: empty string, null, very long words with
no spaces, and text containing XML special characters.

**`escapeXml` is non-negotiable.** Any card text containing `<`, `>`, `&`, `"`, or
`'` will silently break SVG rendering if not escaped. Unit tests for this function
must be written and passing before the placeholder generator is wired into the import
script.

**Side decks during setup.** Setup instructions may say things like "remove the top
5 cards before shuffling." Surface these as prominent dismissible banners; do not
attempt to automate them.

**Hero incapacitation.** Track `isIncapacitated: true` when HP ≤ 0. This is a
display flag only — no automatic enforcement. H does not change when a hero is
incapacitated.

**Deck auto-reshuffle.** Implement in `drawCard()` on all three controller types.
This is the one piece of mechanical automation that is always safe to apply.

**Villain flip.** Toggle `isFlipped`; client swaps which face of the character card
SVG is shown. Triggered manually; not automated.

**Image URL heterogeneity.** `imageUrl` fields may be root-relative paths
(`/card-images/official/...`), absolute external URLs, or placeholder paths.
The client card image component handles all three transparently via standard `<img
src>` behaviour, but this should be noted in `docs/card-data.md` so contributors
don't assume a single format.

**Token clearing edge cases.** `clearPlayState()` is called in multiple code paths —
`discardCard` (from playArea), `discardFromPlay`, `moveCard` generic handler, and
`incapacitate()`. Test each path explicitly in the smoke tests to ensure no path
accidentally skips the clear.

**Card data content effort.** The plan creates 3–5 exemplar JSON cards to prove the
pipeline. Populating full card data for even one hero+villain+environment set (~80–100
cards) is manual content work that must happen before end-to-end smoke testing.
Plan for this separately from the code work.

---

## Phase 11 — Playtesting Iteration

This phase is intentionally open-ended. It begins after Phase 10 and repeats as many
times as needed based on playtesting feedback. Each cycle is a small contained
change, not a re-architecting.

**The stable contract that should NOT change between iteration cycles:**

- Socket event names and their payload shapes (Step 3.6 table)
- Game state shape emitted by `game.getState()` (Step 7.1)
- MongoDB collection schemas (`gameEvents`, `gameOutcomes`, `gameStates`)
- `TurnPhase` enum string values (changing these invalidates persisted game states)

Changes within Phase 11 that do NOT break the contract (and are freely iteratable):

- Any React component in `client/Components/GameBoard/` — layout, styling, new widgets
- `TurnPhase` enum keys and `advance()` transitions in `TurnManager.js` — add or
  reorder phases without touching anything else (just update enum keys and `advance()`)
- `TurnTracker.jsx` labels
- `CardContextMenu.jsx` — add new right-click actions that dispatch existing events
- CSS/SCSS throughout

Changes within Phase 11 that DO touch the contract (require coordinated server +
client update):

- Adding a new socket event — add handler in `game.js`, add to `eventTypes.js`,
  add client dispatch; broadcast state shape is unaffected unless you add a field
- Adding a new field to the broadcast state shape — add to `game.getState()`,
  add a selector in `client/redux/selectors/game.js`; no schema migration needed
  since game state is recomputed from live objects on every emit

### Step 11.1 — Board layout changes

Expected trigger: initial play reveals the three-row grid is hard to read, or hero
columns need different sizing at different player counts.

Scope: `SotmBoard.jsx` and its CSS. `VillainArea`, `EnvironmentArea`, `HeroArea`
props are unchanged — only the container grid changes.

### Step 11.2 — Turn structure changes

Expected trigger: playtesting reveals missing phases (e.g. a distinct "Villain
Power" phase), or phases that should be combined.

Scope: `server/game/sotm/TurnManager.js` only.

Procedure:
1. Add/remove/rename keys in `TurnPhase` enum.
2. Update the transition sequence in `advance()`.
3. Update label strings in `getCurrentTurnLabel()`.
4. Update `TurnTracker.jsx` if any phase needs special UI treatment.
5. If a new phase changes who can "Advance Phase", update `isMyTurn()` logic.

No other files need touching. The broadcast state shape carries `phase` as a string,
so clients automatically display the new label once `TurnTracker` is updated.

### Step 11.3 — Card display changes

Expected trigger: cards need more visible information (e.g. showing full card text
on hover, richer keyword display, different token badge placement).

Scope: card widget sub-components inside `VillainArea`, `HeroArea`, etc. The
`SotmCard.getSummary()` shape already includes all card fields; no server change
needed unless an entirely new field is required.

### Step 11.4 — New context menu actions

Expected trigger: playtesting reveals common manual operations that need a
shortcut (e.g. "Put on top of deck", "Look at top N cards", "Give to other player").

Procedure:
1. If the action maps to an existing socket event (`moveCard`, `modifyCard`): add
   the menu item to `CardContextMenu.jsx` only.
2. If a new socket event is needed: add handler in `game.js` + `eventTypes.js` +
   `CardContextMenu.jsx` dispatch.

### Step 11.5 — HP and token display changes

Expected trigger: HP dials are hard to use, or token counts need different visual
treatment.

Scope: `HpDial.jsx` and token badge sub-components. The underlying `modifyCard`
event contract is unchanged.

### Step 11.6 — Game Over and post-game summary changes

Expected trigger: playtesting reveals missing stats in the summary screen, or the
game over flow is confusing.

Scope: `GameOverModal.jsx`, `SotmBoard.jsx` post-game view, `StatsPage.jsx`.
If new fields are needed in `gameOutcomes`, update `finaliseGame()` in `game.js`
and the corresponding admin stats API (Step 6.5).
