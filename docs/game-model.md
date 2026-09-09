# Server-Side Game Model

All game logic lives in `server/game/sotm/`, orchestrated by `server/game/game.js`.
This document describes the key classes, their state shapes, and how they interact.

No card effects are automated. Every method here just moves cards between zones,
adjusts counters, or advances the turn phase — players resolve all rules themselves.

## Zone Types

Defined in `server/game/sotm/zones.js`:

```js
const ZONE_TYPES = {
  HAND:      'hand',        // Hero's hand of cards
  DECK:      'deck',        // Face-down draw pile
  TRASH:     'trash',       // Discard pile
  PLAY_AREA: 'playArea',    // Cards currently in play
  CHARACTER: 'character',   // Character card (always visible, never moves)
  AUX_DECK:  'auxDeck',     // Side deck draw pile
  AUX_TRASH: 'auxTrash',    // Side deck discard
};
```

## Event Types

Defined in `server/game/sotm/eventTypes.js`. Used in socket event handlers and written
to the `gameEvents` MongoDB collection:

```js
const EVENT_TYPES = {
  GAME_SETUP:          'gameSetup',
  PHASE_ADVANCE:       'phaseAdvance',
  PLAY_CARD:           'playCard',
  MOVE_CARD:           'moveCard',
  DISCARD_CARD:        'discardCard',
  PLAY_TOP_CARD:       'playTopCard',
  SHUFFLE_DECK:        'shuffleDeck',
  ADJUST_HP:           'adjustHp',
  TOGGLE_INCAPACITATE: 'toggleIncapacitate',
  FLIP_VILLAIN:        'flipVillain',
  DRAW_CARD:           'drawCard',
  MODIFY_CARD:         'modifyCard',
  SEARCH_DECK:         'searchDeck',
  GAME_OVER:           'gameOver',
  SESSION_END:         'sessionEnd',
};
```

## SotmCard

File: `server/game/sotm/SotmCard.js`

Runtime wrapper around a card data record. One instance per physical card in the game.

```js
{
  id,        // unique instance id (dataId + UUID suffix)
  dataId,    // matches the MongoDB card record id
  name, type, keywords, text, imageUrl,
  hp,        // current HP (null for cards with no printed HP)
  maxHp,     // printed/baseline HP; only changes via modifyCard
  zone,      // set by the controller when the card enters a zone
  faceDown,  // boolean
  tokens: { [label: string]: number },  // player-defined labels, non-negative counts
}
```

- `applyUpdates(updates)` — applies a `modifyCard` payload (`hp`, `maxHp`, `addKeyword`,
  `removeKeyword`, `token`)
- `clearPlayState()` — resets transient in-play state (currently: empties `tokens`).
  Called whenever the card leaves `playArea` or the `character` zone.

## HeroPlayer

File: `server/game/sotm/HeroPlayer.js`

One instance per hero deck in the game. A single human player may control multiple heroes.

### State Shape

```js
{
  id,                  // socket user id (controllerPlayerId)
  name,                // display name
  deckId,              // which hero deck they chose
  deckVersion,         // set by game.js after construction
  hand: SotmCard[],
  deck: SotmCard[],
  trash: SotmCard[],
  playArea: SotmCard[],
  characterCard: SotmCard,  // always visible; never in hand/deck
  auxiliaryZones: [],       // [{ id, name, deck: [], trash: [] }]
  hp: number,
  maxHp: number,
  isIncapacitated: boolean,
}
```

`getState(forPlayerId)` additionally emits `handCount`, `deckCount`, and
`controllerPlayerId`. Hand cards are serialized as `{ faceDown: true }` for non-owners.

### Key Methods

- `drawCard(n = 1, logEvent?)` — Moves n cards from deck to hand; auto-shuffles trash → deck
  (Fisher-Yates) when the deck runs dry mid-draw
- `playCard(cardId)` — Moves a card from hand to `playArea`. **One-shots also go to the
  play area** — players resolve the effect manually, then move the card to trash themselves
- `discardCard(cardId, fromZone)` — Moves a card (`'hand'` | `'playArea'` | `'deck'`) to
  trash; calls `card.clearPlayState()` first when leaving `playArea`
- `shuffleDeck()` — Fisher-Yates in-place shuffle of the deck array
- `setHp(n)` — Sets `hp` to `n`. Does **not** touch `isIncapacitated`
- `adjustHp(delta)` — Adds `delta` to `hp`. **No-op while `isIncapacitated`** — call
  `restore()` first
- `incapacitate()` — Sets `isIncapacitated = true`, forces `hp = 0`, and calls
  `characterCard.clearPlayState()`. This is an explicit manual action: HP reaching 0 on
  its own does **not** incapacitate, and healing does **not** restore
- `restore()` — Sets `isIncapacitated = false` (HP is left at whatever it was)
- `getState(forPlayerId)` — Serializes; see above

## VillainController

File: `server/game/sotm/VillainController.js`

### State Shape

```js
{
  deckId,
  deckVersion,          // set by game.js after construction
  deck: SotmCard[],
  trash: SotmCard[],
  playArea: SotmCard[],
  characterCard: SotmCard,
  auxiliaryZones: [],
  hp: number,
  maxHp: number,
  isFlipped: boolean,
}
```

No hidden information — all zones are fully visible to all players.

### Key Methods

- `playTopCard()` — Moves top of deck to `playArea`; auto-shuffles trash → deck if the
  deck is empty
- `discardFromPlay(cardId)` — Calls `card.clearPlayState()` then moves to trash
- `flip()` — Toggles `isFlipped`
- `setHp(n)` / `adjustHp(delta)` — Plain HP assignment/delta (no incapacitation concept
  for the villain)

## EnvironmentController

File: `server/game/sotm/EnvironmentController.js`

Same structure as VillainController but without `characterCard`, `hp`, `maxHp`, or
`isFlipped`. Serializes `deckId`, `deckVersion`, `deck`, `deckCount`, `trash`, `playArea`,
`auxiliaryZones`. Methods: `playTopCard()`, `discardFromPlay(cardId)`, `shuffleDeck()`.

## Token Model

Cards track tokens as `tokens: { [label: string]: number }`. `game.modifyCard()` applies
a delta object via `SotmCard.applyUpdates()`:

```js
// game.modifyCard(playerName, { cardId, controllerId, updates })

// Add a token (label is any player-defined string)
updates = { token: { label: 'bounty', delta: 1 } }
// Remove a token (decrement; count reaching 0 removes the key entirely)
updates = { token: { label: 'bounty', delta: -1 } }

// Other allowed updates keys: hp, maxHp, addKeyword, removeKeyword
updates = { hp: 3 }
updates = { addKeyword: 'ongoing' }
```

Allowed `updates` keys are enforced by `MODIFY_CARD_ALLOWED_KEYS` in `game.js`;
unknown keys are rejected with a warning.

Token clearing: `card.clearPlayState()` is called whenever a card leaves `playArea` or
the `character` zone (on incapacitation). This removes all tokens.

## TurnManager

File: `server/game/sotm/TurnManager.js` (exports `{ TurnManager, TurnPhase }`)

### State Shape

```js
{
  round: number,
  phase: TurnPhase,                 // current phase string, e.g. 'hero_play'
  H: number,                        // FIXED: number of hero decks; never changes
  activeHeroId: string | null,      // null during villain/env phases
  activeControllerPlayerId: string | null,  // null during villain/env phases
  heroOrder: HeroSlot[],            // ordered list, one entry per hero deck
  currentHeroIndex: number,
  lastActivityAt: Date,             // updated on every advance()
}
```

### HeroSlot

```js
{ heroId: string, controllerPlayerId: string }
```

One player can control multiple heroes — `controllerPlayerId` may appear in multiple slots.

### H Value

H = total number of hero decks at game construction. H is **never** changed by hero
incapacitation. It is displayed prominently in the TurnTracker so players can evaluate
card effects (e.g. "deal 1 damage to each hero target" = deal H damage total).

### Phase Sequence

```
setup → villain_start → villain_play → villain_end
      → hero_start(0) → hero_play(0) → hero_power(0) → hero_draw(0) → hero_end(0)
      → hero_start(1) → ... → hero_end(H-1)
      → env_start → env_play → env_end
      → villain_start (round++)
```

`game_over` is entered directly by `setGameOver()` (called from `finaliseGame()`), not
through the normal sequence.

### Key Methods

- `advance()` — Moves to the next phase; updates `activeHeroId`, `activeControllerPlayerId`,
  `lastActivityAt`; fires the `onHeroStart` and `onAdvance` callbacks
- `isMyTurn(socketPlayerId)` — Returns `true` for ALL players during villain/env phases
  (cooperative); `true` only for `activeControllerPlayerId` during hero phases; `false`
  during setup/game over
- `getCurrentTurnLabel()` — Human-readable string, e.g.
  `"Round 3 — legacy: Hero — Play Phase"` during a hero phase, otherwise
  `"Round 3 — Villain — Play Card"`
- `getH()` — Returns `this.H` (fixed integer)
- `setGameOver()` — Forces `phase` to `game_over` and clears the active hero fields
- `getState()` — Serialize for broadcast

To modify the turn structure (add/remove/reorder phases), edit only:
1. `TurnPhase` enum keys in `TurnManager.js`
2. The transition logic in `advance()` (and `HERO_PHASE_SEQUENCE` / the phase `Set`s)
3. `PHASE_LABELS` in `TurnManager.js`
4. `TurnTracker.jsx` if a phase needs special UI treatment

## Game (orchestrator)

File: `server/game/game.js`

Holds `villain`, `environment`, `heroPlayers[]`, `turnManager`, and `gameChat`. Socket
events are dispatched by `gameserver.js` as `game[command](username, ...args)`.

### Player-facing actions

| Command | Payload | Effect |
|---|---|---|
| `advancePhase` | – | `turnManager.advance()` |
| `playCard` | `{ cardId, targetControllerId? }` | Active hero plays a card from hand to its own play area; with `targetControllerId`, moves it into another controller's play area |
| `discardCard` | `{ cardId, zone }` | Moves a card to its controller's trash |
| `moveCard` | `{ cardId, fromZone, toZone, controllerId? }` | Generic zone-to-zone move, within or between controllers (`_genericMoveCard`); `clearPlayState()` runs when leaving play for a non-play zone, but a card moving between play areas keeps its tokens |
| `shuffleDeck` | `{ controllerId, zoneId? }` | Shuffles a controller's deck (or `auxDeck`) |
| `playTopCard` | `{ controllerId }` | Villain/environment: top of deck → play area |
| `flipVillain` | – | Toggles `villain.isFlipped` |
| `adjustHp` | `{ controllerId, delta }` | Adjusts a controller's HP (ignored if that controller is incapacitated) |
| `toggleIncapacitate` | `{ controllerId }` | Toggles a hero between incapacitated and restored |
| `drawCard` | `{ heroId, count = 1 }` | Draws for a hero |
| `modifyCard` | `{ cardId, controllerId, updates }` | See [Token Model](#token-model) |
| `searchDeck` | `{ controllerId, zoneId? }` | Logs a `SEARCH_DECK` event. Deck contents are already present in the broadcast state (every deck zone is fully serialized), so the client `DeckSearchModal` renders directly from state — there is no separate private emit |
| `initiateGameOver` / `cancelGameOver` | – | Broadcasts `gameOverPrompt` / `gameOverCancelled` to all clients via `game._pendingBroadcast` |
| `submitGameOver` | `{ result, notes?, tags? }` | `finaliseGame()` → writes `gameOutcomes`, forces `game_over` |
| `endSession` / `concede` | – | `finaliseGame('abandoned', …)` |

`controllerId` accepts `'villain'`, `'environment'`, or a hero `deckId` (a hero's socket
`id` also resolves). See `_findController()` in `game.js`.

### `game.getState(forPlayerName)`

```js
{
  gameId, round, phase, H,
  activeHeroId, activeControllerPlayerId,
  villain, environment,          // controller getState() output (null before setup)
  heroes,                        // heroPlayers[].getState(forPlayerName)
  chatLog,                       // gameChat.messages
  setupInstructions,             // string, only during the 'setup' phase
  isGameOver,                    // phase === 'game_over'
}
```

`saveState()` persists `JSON.stringify(getState(null))` to the `gameStates` collection on
every mutation; `loadState(gameId)` rehydrates it on reconnect.
