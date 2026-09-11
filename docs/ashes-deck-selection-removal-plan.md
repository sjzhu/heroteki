# Plan: remove the Ashes card-preload & deck-selection subsystem

## Why

SotMDE selects **heroes** in the pending game (`addhero` / `removehero` /
`setheroorder` → `game.heroSelection` / `heroOrder`), and the game node loads card
data straight from the `sotmCards` / `sotmDecks` collections at game start. The
inherited Ashes **deck-selection** path — pre-caching an Ashes card list, a
`selectdeck` socket flow, precon/coaloff/solo/chimera deck resolution, and
campaign-deck validation — is never exercised. It still runs on every lobby
startup and every client page-load, and it was the source of the
`Cannot set properties of undefined (setting 'isChained')` log line
(fixed defensively in `5bf1b80ff`; this plan removes it at the root).

## Scope

**In scope** — the card-preload + deck-selection path:

- `/api/cards` (the deck-selection card preload — **not** `/api/cards/alts`,
  which stays; see below)
- `server/CampaignDeckValidator.js`
- `lobby.js`: `selectDeck()`, `onSelectDeck()`, the `selectdeck` event, the
  `coaloff` / `game.solo` branches in `onNewGame` / `onJoinGame`,
  `checkConjurations()`, `onSetSoloLevel()` / `onSetSoloStage()`,
  `this.cards` / `this.precons` / `this.cardService`, the `CampaignDeckValidator`
  and `ServiceFactory` imports, and the rematch calls into `onSelectDeck()`
- client: `Application.jsx` `loadCards()` / `loadAllPreconsDecks()` dispatch,
  `client/redux/actions/cards.js` `loadCards`, and the reducer / selector code
  that only it feeds

**Explicitly out of scope** (larger, separate efforts — noted at the end):

- The Ashes deck-**building** backend: `server/api/decks.js`,
  `server/services/AshesDeckService.js`, and their scripts
- **Alt-art admin** — `/api/cards/alts`, `server/services/ServiceFactory.js` +
  `AshesCardService.js` (kept alive for this one route),
  `client/redux/actions/cards.js` `loadAlts`, and the consumers in
  `UserAdmin.jsx` / `UserAltAdmin.jsx`. **Correction:** an earlier pass of this
  plan deleted `/api/cards/alts` alongside `/api/cards` in Step 1, breaking the
  nav-linked, permission-gated `/useralts` page — it was restored in a follow-up
  commit on the Step 3 branch. `server/api/cards.js` now contains only the
  `/api/cards/alts` route.
- Dead-but-URL-reachable pages: `/cards`, `/decks/edit`, `/chimera`, `/results`,
  `/decks/import`
- A SotMDE-native rematch flow

## Pre-work: confirm the dead paths (no code change)

All already verified while writing this plan, re-confirm before starting:

1. `client/Components/Games/NewGame.jsx` always sends `gameFormat: 'standard'`
   and never a `solo` field → the `coaloff` and `game.solo` branches in
   `onNewGame` / `onJoinGame` cannot be reached.
2. `PendingGame` never assigns `this.solo` → `game.solo` is always `undefined`.
3. No client code dispatches `selectdeck`, `setsololevel`, or `setsolostage`
   (`PendingGamePlayers.jsx` header comment already records the `selectdeck`
   removal).
4. `onStartGame` gates on `game.allHeroesSelected()`, not `player.deck`.
5. `Decks.jsx` (the "Card Library" nav item) fetches `/api/sotm/*`, not
   `/api/cards` or `/api/decks`.
6. `state.cards.cards` is read only by `DeckFilter`, `DeckEditor`, `CardsPage`
   (all Ashes deck-building UI, none nav-linked); `state.cards.alts` only by the
   alt-art admin pages.

## Step 1 — server: delete the card-preload endpoint (DONE, `7fa22089d` + `74a4c281d`)

1. Remove only the `/api/cards` route from `server/api/cards.js` — leave
   `/api/cards/alts` in place (`UserAltAdmin.jsx` / `/useralts` needs it; the
   first pass of this step deleted both and had to be corrected).
2. Keep `ServiceFactory` / `AshesCardService` — `/api/cards/alts` still needs
   `cardService.getAltArts()`. They are no longer a "delete in this plan" item;
   see the "what stays" table.
3. `grep -rn "/api/cards'" server/` → only the alts route.

Gate: `node -e "require('./server/api/index.js')"` loads; `node .` boots and no
longer logs the `isChained` line.

## Step 2 — server: strip deck-selection from `lobby.js`

Remove, in `server/lobby.js`:

- imports: `ServiceFactory` (line ~10), `AshesDeckService` (line ~11),
  `CampaignDeckValidator` (line ~17). Confirmed: `this.cardService` and
  `this.deckService` are referenced **only** in `init()` and `selectDeck()`, so
  both — and both imports — go.
- constructor: `this.cardService = …` (line ~26), `this.deckService = …`
  (line ~28).
- `init()`: `this.cards` / `this.precons` are read only by `init()` and
  `selectDeck()`. Delete the method entirely and the `await lobby.init()` call
  in `server/index.js:37` (or, if you want a hook for future startup work, leave
  `async init() {}` and keep the call).
- `socket.registerEvent('selectdeck', …)`, `socket.registerEvent('setsololevel', …)`,
  `socket.registerEvent('setsolostage', …)` (lines ~355–357)
- methods: `onSelectDeck()`, `selectDeck()`, `checkConjurations()`,
  `onSetSoloLevel()`, `onSetSoloStage()`
- `onNewGame()`: the `if (gameDetails.gameFormat === 'coaloff') { … }` block and
  the `if (game.solo) { … }` block
- `onJoinGame()`: the `if (game.gameFormat === 'coaloff') { … }` block
- `onGameRematch()` (lines ~936–1040): it calls `onSelectDeck()` with
  `owner.deck._id` / `player.deck._id`. SotMDE has no `player.deck`, so rematch is
  **already broken** — remove the `onSelectDeck` calls and the surrounding
  `promises` array; leave a `// TODO: SotMDE rematch needs hero-selection copy`
  where the deck copy was. (Full rematch rework is out of scope.)
- the `game.solo` / `DummyUser.DUMMY_USERNAME` handling in `onLeaveGame`
  (line ~630) and the `player.name === 'Chimera' ? new DummyUser()` branch in the
  reconnect/sync path (line ~1143) — `DummyUser` stays imported (still used by
  `pendinggame.js` and `gameserver.js`), just drop the dead branches.

Delete `server/CampaignDeckValidator.js`.

Gate: `node .` boots; create a game from two browsers, both pick heroes, start —
verify `onNewGame` / `onJoinGame` / `onStartGame` still work end to end.

## Step 3 — client: drop the preload dispatches & dead actions

1. `client/Application.jsx`: remove `dispatch(actions.loadCards());` and
   `dispatch(actions.loadAllPreconsDecks());` (lines ~84–85).
2. `client/redux/actions/cards.js`: delete `loadCards()` and `loadAlts()`.
   Check `client/redux/actions/index.js` re-exports still resolve.
3. `client/redux/actions/deck.js`: delete `loadAllPreconsDecks()` and, if now
   unused, `loadDecks()` / `loadStandaloneDecks()` (only `SelectDeckModal`, an
   out-of-scope dead component, uses `loadDecks`).
4. `client/redux/reducers/cards.js`: remove the `RECEIVE_CARDS`, `REQUEST_CARDS`,
   `RECEIVE_ALTS`, `REQUEST_ALTS`, `PRECON_DECKS_LOADED`, `LOAD_PRECON_DECKS`
   cases and the `cards` / `alts` / `precons` slices of initial state — **only
   if** Step "out of scope" isn't being deferred. If alt-art admin stays, keep
   `RECEIVE_ALTS` / `REQUEST_ALTS`.
5. `npm run build` + load the app: `/`, `/decks` (Card Library), `/profile`,
   `/faq`, create-game modal — no console errors, no failed `/api/cards*`
   requests in the network tab.

## Step 4 — sweep

- `grep -rn "isChained\|getChainedList\|coaloff\|CoalOff\|soloLevel\|soloStage\|selectdeck\|loadCards\b\|CampaignDeckValidator" server/ client/ --include=*.js --include=*.jsx | grep -v node_modules`
  — every remaining hit should be either a test, an out-of-scope file, or a
  deliberate keep (document each). `ServiceFactory` / `AshesCardService` are
  excluded from this grep — they're a permanent keep for `/api/cards/alts`.
- `client/util.js` `coaloff` format entry and
  `client/Components/Games/GameFormatInfo.jsx` `case 'coaloff':` — remove.
- `npm run lint` clean (watch for newly-unused imports/vars).
- `npm test` — 144/0 (no server test touches this path; if one does, it's a
  stale Ashes test to delete).

## What stays, and why

| Kept | Reason |
|---|---|
| `server/services/AshesDeckService.js` | backs the out-of-scope `/api/decks*` routes and `server/scripts/{decklist,tournament}.js` |
| `server/services/ServiceFactory.js` + `AshesCardService.js` | back the surviving `/api/cards/alts` route (alt-art admin, out of scope) |
| `server/models/DummyUser.js` | still imported by `pendinggame.js` and `gameserver.js` (dead there too, but a separate cleanup) |
| `client/redux/reducers/cards.js` deck slices | feed `SelectDeckModal` / `DeckList*` / `ChimeraPage` — out-of-scope dead UI |
| `RECEIVE_ALTS` / alt-art code | only if the alt-art admin cleanup is deferred |

## Testing plan

Unit/CI (`npm test`, `npm run lint`, `npm run build`) will not catch a
regression here — the risk is entirely in the lobby socket handlers. Manual,
two browsers, Mongo + Redis up, `node .` + `node server/gamenode`:

1. **Create game** (browser A): New Game → pick villain + environment → Create.
   Game appears in the list; no server error.
2. **Join** (browser B): join the game; pending lobby renders for both.
3. **Hero select**: each browser adds a hero; host sets hero order; `Start`
   becomes enabled only once `allHeroesSelected()`.
4. **Start**: game hands off to the game node; board renders for both; a turn can
   be taken.
5. **Spectator**: a third browser spectates a started game.
6. **Reconnect**: reload browser A mid-game; state resyncs.
7. **Leave / empty**: both players leave; game is removed from the list.
8. Confirm the lobby log is clean across all of the above (no `isChained`, no
   `Cannot read/set properties of undefined`).

## Rollout

Three PRs, each independently green and boot-tested:

1. **`chore/remove-ashes-card-preload`** — Step 1 (endpoint + services). Small,
   low-risk, removes the startup error at the source.
2. **`chore/remove-ashes-deck-selection`** — Steps 2 + 4 (lobby.js). The risky
   one — needs the full two-browser test pass above before merge.
3. **`chore/remove-ashes-card-client`** — Step 3 (client dispatches/actions).

Do 1 first (safe), then 3 (client stops calling the deleted endpoint), then 2.

## Follow-ups (separate plans)

- Ashes deck-building removal: `/api/decks*`, `AshesDeckService`, `SelectDeckModal`,
  `DeckList` / `DeckGrid` / `DeckListEx`, `DeckEditor`, `CardsPage`, `ChimeraPage`,
  `/results`, the bulk of `client/redux/{actions,reducers}` `deck` / `cards` code,
  and the `data/` Ashes card import scripts.
- Alt-art admin removal (`/useralts`, `UserAltAdmin.jsx`, alt fields in
  `UserAdmin.jsx`, `/api/cards/alts`).
- SotMDE-native rematch (`onGameRematch` currently assumes `player.deck`).
- `DummyUser` / `removeDummy()` removal from `pendinggame.js` + `gameserver.js`.
