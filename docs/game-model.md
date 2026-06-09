# Server-Side Game Model

All game logic lives in `server/game/sotm/`. This document describes the key classes,
their state shapes, and how they interact.

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
  GAME_SETUP, PHASE_ADVANCE, PLAY_CARD, MOVE_CARD, DISCARD_CARD,
  PLAY_TOP_CARD, SHUFFLE_DECK, ADJUST_HP, FLIP_VILLAIN, DRAW_CARD,
  MODIFY_CARD, SEARCH_DECK, GAME_OVER, SESSION_END
};
```

## HeroPlayer

File: `server/game/sotm/HeroPlayer.js`

One instance per hero deck in the game. A single human player may control multiple heroes.

### State Shape

```js
{
  id,                  // socket user id (controllerPlayerId)
  name,                // display name
  deckId,              // which hero deck they chose
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

### Key Methods

- `drawCard(n = 1)` — Moves n cards from deck to hand; auto-shuffles trash → deck when deck is empty (Fisher-Yates)
- `playCard(cardId)` — Moves card from hand to playArea; if card has keyword `'one-shot'`, goes to trash instead
- `discardCard(cardId, fromZone)` — Moves card to trash; calls `card.clearPlayState()` first when leaving playArea
- `shuffleDeck()` — Fisher-Yates in-place shuffle of the deck array
- `setHp(n)` / `adjustHp(delta)` — Sets HP; sets `isIncapacitated = true` when `n <= 0`
- `incapacitate()` — Sets `isIncapacitated = true`; calls `characterCard.clearPlayState()`
- `getState(forPlayerId)` — Serializes; hand cards are `{ faceDown: true }` for non-owners

## VillainController

File: `server/game/sotm/VillainController.js`

### State Shape

```js
{
  deckId,
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

- `playTopCard()` — Moves top of deck to playArea; auto-shuffles if deck is empty
- `discardFromPlay(cardId)` — Calls `card.clearPlayState()` then moves to trash
- `flip()` — Toggles `isFlipped`
- `setHp(n)` / `adjustHp(delta)`

## EnvironmentController

File: `server/game/sotm/EnvironmentController.js`

Same structure as VillainController but without `characterCard`, `hp`, `maxHp`, or
`isFlipped`. Methods: `playTopCard()`, `discardFromPlay(cardId)`, `shuffleDeck()`.

## Token Model

Cards track tokens as `tokens: { [label: string]: number }`. Operations use a delta object:

```js
// Add a token
modifyCard({ cardId, updates: { token: { label: 'bounty', delta: 1 } } })
// Remove a token (decrements; 0 removes the key entirely)
modifyCard({ cardId, updates: { token: { label: 'bounty', delta: -1 } } })
```

Token clearing: `card.clearPlayState()` is called whenever a card leaves `playArea` or
the `character` zone (on incapacitation). This removes all tokens.

## TurnManager

File: `server/game/sotm/TurnManager.js`

### State Shape

```js
{
  round: number,
  phase: TurnPhase,                 // current phase string
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
SETUP → VILLAIN_START → VILLAIN_PLAY → VILLAIN_END
     → HERO_START(0) → HERO_PLAY(0) → HERO_POWER(0) → HERO_DRAW(0) → HERO_END(0)
     → HERO_START(1) → ... → HERO_END(N)
     → ENV_START → ENV_PLAY → ENV_END
     → VILLAIN_START (round++)
```

### Key Methods

- `advance()` — Moves to the next phase; updates `activeHeroId`, `activeControllerPlayerId`, `lastActivityAt`
- `isMyTurn(socketPlayerId)` — Returns `true` for ALL players during villain/env phases (cooperative); `true` only for `activeControllerPlayerId` during hero phases
- `getCurrentTurnLabel()` — Human-readable string, e.g. `"Round 3 — Legacy: Play Phase"`
- `getH()` — Returns `this.H` (fixed integer)
- `getState()` — Serialize for broadcast

To modify the turn structure (add/remove/reorder phases), edit only:
1. `TurnPhase` enum keys in `TurnManager.js`
2. The transition sequence in `advance()`
3. Label strings in `getCurrentTurnLabel()`
4. `TurnTracker.jsx` if a phase needs special UI treatment

No other files need touching.
