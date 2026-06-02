# SotMDE Agent Orchestration Plan

This document describes how to run the implementation defined in
`sotmde-implementation-plan.md` using a fleet of specialized agents. Read that
document first — this one only covers scheduling, hand-offs, and coordination.

---

## Overview

The implementation is divided into **12 agents** across four sequential waves.
Waves 1–3 are strictly sequential (each wave depends on the previous). Within
Wave 3, four agents run in parallel.

```
Wave 1 (sequential): Agent-0 → Agent-1 → Agent-2A → Agent-2B
Wave 2 (sequential): Agent-3 (Phase 3 — largest phase)
Wave 3 (parallel):   Agent-4A  Agent-4B  Agent-4C  Agent-4D
Wave 4 (sequential): Agent-5 → Agent-6 → Agent-7
```

Total minimum elapsed time assuming no blockers: roughly **10 sequential agent
sessions** (Wave 3 saves 3 sessions by running in parallel).

---

## Verification Gate Protocol

After each agent completes, a human operator (or a dedicated review agent) must
confirm the **exit gate** before the next wave starts. Gates are listed per agent
below. Do not start the next agent until its gate passes.

---

## Wave 1 — Foundation (Agents 0, 1, 2A, 2B — sequential)

### Agent-0: Repository Setup (Phase 0)

**Steps covered:** 0.1, 0.2, 0.3

**Context to provide:**
> You are implementing `sotmde-implementation-plan.md` Phase 0. The repo is a fork
> of Ashteki at `/Users/sjzhu/repos/heroteki`. The goal is to rename all project
> references from Ashteki/Ashes to SotMDE/Sentinels, add Basic Auth middleware, and
> confirm the base app starts. Read the plan file first in its entirety before
> touching any code.

**Work:**
- Rename `package.json`, `README.md`, `config/default.json5`, HTML titles, About
  text, email templates (grep for "ashteki" case-insensitively).
- Add new config keys (`privateMode`, `privateUser`, `privatePassword`,
  `inactivityTimeoutHours`, `notificationEmail` block) to `config/default.json5`.
- Add `express-basic-auth` dependency and Basic Auth middleware guarded by
  `config.privateMode`.
- Run `npm install && node . &` and confirm the lobby loads at `localhost:4000`.
- Fix any Node version / dependency issues.

**Exit gate:**
- `localhost:4000` loads without JS errors.
- No occurrences of "ashteki" remain in non-code user-facing text.
- `config/default.json5` has all new keys with correct defaults.
- Commit message: `chore: rename project references from Ashteki to SotMDE`.

---

### Agent-1: Purge Ashes Code (Phase 1)

**Steps covered:** 1.1 – 1.8

**Context to provide:**
> You are implementing `sotmde-implementation-plan.md` Phase 1 (Steps 1.1–1.8).
> The repo is at `/Users/sjzhu/repos/heroteki`. Phase 0 (renaming) is already done.
> Read the plan file in full before touching any code. This phase removes all Ashes
> rules-engine code. Work on one step at a time and verify `node .` still starts
> after each step.

**Work (in order):**
1. Delete `server/game/cards/`
2. Stub rules-engine files and the additional directories: `gamesteps/`, `solo/`,
   `Clocks/`, `EffectEngine.js`, `GamePipeline.js`, `CardVisibility.js`,
   `chatcommands.js`, `loader.js`, `deck.js`, `gamechat.js`
3. Strip `game.js` (remove imports, constructor instantiations, Ashes methods)
4. Strip `player.js`
5. Delete Ashes data scripts and `data/` directory
6. Stub gamenode serialization layer (`GameStateWriter`, `PlayerStateWriter`,
   `CardStateWriter`, `DieStateWriter`)
7. Clean up `GameTypes`, league system, replay system in `constants.js`,
   `pendinggame.js`, `server/api/`
8. Verify app still starts

**Exit gate:**
- `node .` starts without import errors.
- `node server/gamenode` starts without import errors.
- Lobby loads at `localhost:4000`.
- A game room may fail to start — acceptable.
- Commit: `feat: purge Ashes rules engine for SotMDE port (Phase 1)`.

---

### Agent-2A: Card Data Model (Phase 2, Steps 2.1–2.5)

**Steps covered:** 2.1 – 2.5

**Context to provide:**
> You are implementing `sotmde-implementation-plan.md` Phase 2 Steps 2.1–2.5.
> The repo is at `/Users/sjzhu/repos/heroteki`. Phases 0–1 are complete (Ashes code
> is purged). Read the plan file fully before starting.
> This sub-phase creates the SotMDE card/deck schemas, exemplar JSON, MongoDB import
> script, and Mongoose models. Do NOT start Step 2.6 (placeholder generation) or
> Step 2.7 (SotmCard class).

**Critical notes:**
- `CARD_TYPES` = `['heroCard','villainCard','environmentCard','heroCharacter','villainCharacter']`.
  This is a breaking rename from any v1 strings (`'hero'`, `'villain'`, `'environment'`).
- At least one exemplar card must have `imageUrl: null` to exercise placeholder generation later.
- At least one exemplar card must have a `template` override value.
- Import script deck size validation must be a hard **error** for official decks (not a warning).
- `cardCount` is derived (computed by the import script), not manually set.

**Work:**
- Create `server/game/sotm/cardSchema.js` and `deckSchema.js`
- Create `data/sotm/cards/` and `data/sotm/decks/` with exemplar JSON
- Create `server/scripts/importSotmData.js` (import + validation only; placeholder
  generation will be added in Agent-2B)
- Extend Mongoose models with explicit indexes (`cards`: `id` unique, `deckId`,
  `source`; `decks`: `id` unique, `deckType`, `source`, `uploadedBy`)

**Exit gate:**
- `node server/scripts/importSotmData.js` completes without errors.
- MongoDB contains at least one card and one deck of each type.
- Commit: `feat: SotMDE card/deck schemas, exemplar data, and import pipeline (Phase 2 part 1)`.

---

### Agent-2B: Placeholder Image Generation (Phase 2, Steps 2.6–2.7)

**Steps covered:** 2.6.1 – 2.6.8, 2.7

**Context to provide:**
> You are implementing `sotmde-implementation-plan.md` Phase 2 Steps 2.6 and 2.7.
> The repo is at `/Users/sjzhu/repos/heroteki`. Steps 2.1–2.5 are complete (schemas,
> exemplar data, and import script exist). Read the plan file fully before starting.
> This sub-phase adds placeholder image generation (Sharp, SVG templates) and the
> runtime SotmCard class with full token support.

**Critical notes:**
- `escapeXml` unit tests must pass before the generator is wired into the import script.
- The `default` template must be a complete working implementation, not a stub.
- The `SotmCard` class (Step 2.7) has a `tokens: {}` map, `applyUpdates()` with token
  delta support, and `clearPlayState()` — these are critical for Phase 3.

**Work:**
- Add `sharp` dependency; commit font files to `server/assets/fonts/`
- Create `server/game/sotm/cardTemplates/shared/` (layout.js, textUtils.js, fragments.js)
- Write `textUtils.test.js` for `escapeXml` and `wrapText` — must pass before proceeding
- Create template registry (`cardTemplates/index.js`)
- Create `default.js` template (complete, functional)
- Create named template stubs re-exporting default
- Create `server/game/sotm/cardImageGenerator.js`
- Create `server/scripts/generatePlaceholders.js`
- Wire placeholder generation into `importSotmData.js`
- Create `server/game/sotm/SotmCard.js` runtime class

**Exit gate:**
- `node server/scripts/importSotmData.js` runs end-to-end including placeholder generation.
- `public/card-images/placeholders/` contains PNGs for exemplar cards with `imageUrl: null`.
- Cards with existing non-placeholder `imageUrl` are not overwritten.
- `escapeXml` and `wrapText` unit tests pass.
- `SotmCard` class is importable without errors.
- Commit: `feat: placeholder image generation and SotmCard runtime class (Phase 2 part 2)`.

---

## Wave 2 — Server Game Model (Agent 3 — solo, largest phase)

### Agent-3: Server-Side Game Model (Phase 3)

**Steps covered:** 3.1 – 3.8

**Context to provide:**
> You are implementing `sotmde-implementation-plan.md` Phase 3 (Steps 3.1–3.8).
> The repo is at `/Users/sjzhu/repos/heroteki`. Phases 0–2 are complete (data model
> exists, placeholder generation works, SotmCard class exists). Read the plan file
> fully before starting.
> Phase 3 is the largest phase — it rewrites the server-side game model.
> Work one step at a time, committing after each.

**Critical notes to pass to the agent:**
- `game.js` is 1,920 lines — read it in full before editing.
- The socket channel name is `gamestate` (client subscribes to this in
  `client/redux/reducers/lobby.js`).
- `game.getState(forPlayerName)` is the method `GameStateWriter` will call in Phase 7.
- Card loading uses `options.cardData` injected by `gameserver.js` — do NOT query
  MongoDB from inside `game.js`.
- CARD_TYPES are `'heroCard'`, `'villainCard'`, `'environmentCard'` (not `'hero'` etc.).
- `TurnManager` state must include `H` (fixed integer), `activeHeroId` (string|null),
  `activeControllerPlayerId` (string|null), `heroOrder: HeroSlot[]` (not string[]),
  and `lastActivityAt: Date`.
- `HeroSlot = { heroId: string, controllerPlayerId: string }`. One player may own
  multiple `HeroSlot` entries.
- `isMyTurn(socketPlayerId)` returns `true` for ALL players during villain/env phases
  (cooperative), and only for `activeControllerPlayerId` during hero phases.
- `broadcastGameState()` must call `saveState()` (async, not awaited) and
  `logEvent()` (fire-and-forget) on every mutation.
- `modifyCard` event accepts `updates: { hp?, maxHp?, addKeyword?, removeKeyword?,
  token?: { label, delta } }` — this is the only event that mutates play-area card state.
- Token clearing: any code path that moves a card out of `playArea` or `character`
  zone must call `card.clearPlayState()` first.
- `pendinggame.js` line ~147 has a 2-player gate — replace with `allHeroesSelected()`.

**Work (in order):**
1. Create `server/game/sotm/zones.js` and `server/game/sotm/eventTypes.js`
2. Create `server/game/sotm/HeroPlayer.js`
3. Create `server/game/sotm/VillainController.js`
4. Create `server/game/sotm/EnvironmentController.js`
5. Create `server/game/sotm/TurnManager.js`
6. Rewrite `server/game/game.js` for SotMDE
7. Add async play / stateless game node mode to `server/gamenode.js` (Step 3.7)
8. Update `pendinggame.js` and lobby server (Step 3.8)

**Exit gate:**
- `node .` and `node server/gamenode` both start clean.
- Two users can create a game with villain/environment selection in lobby.
- Game node receives `villainDeckId`, `environmentDeckId`, `heroOrder`, and
  `heroSelection` in its start payload (verify via `console.log` in game.js
  constructor).
- `game.getState('playerName')` returns an object with `villain`, `environment`,
  `heroes`, `round`, `phase`, `H`, `activeHeroId`, `activeControllerPlayerId`,
  `isGameOver`, `setupInstructions` fields.
- `game.saveState()` and `game.loadState(gameId)` exist and are callable.
- Commit per step; final commit: `feat: SotMDE server game model (Phase 3)`.

---

## Wave 3 — Parallel Client + API + Serialization (Agents 4A–4D)

All four agents start after Agent-3's exit gate passes. They work in different
parts of the codebase and have no file-level conflicts.

**Shared context block (prepend to each agent's prompt):**
> The socket event contract from Phase 3 is: the server emits on channel `gamestate`
> with shape `{ gameId, round, phase, H, activeHeroId, activeControllerPlayerId,
> villain, environment, heroes, chatLog, setupInstructions, isGameOver }`.
> Client socket events to server:
> `advancePhase`,
> `playCard { cardId }`, `discardCard { cardId, zone }`,
> `moveCard { cardId, fromZone, toZone, controllerId }`,
> `shuffleDeck { controllerId, zoneId }`, `playTopCard { controllerId }`,
> `flipVillain`, `adjustHp { controllerId, delta }`,
> `drawCard { heroId, count }`,
> `modifyCard { cardId, controllerId, updates }` (updates keys: hp, maxHp, addKeyword,
> removeKeyword, token: {label, delta}),
> `searchDeck { controllerId, zoneId }`,
> `initiateGameOver`, `submitGameOver { result, notes, tags }`, `cancelGameOver`,
> `endSession`, `sendMessage { text }`.
> Do not modify any file in `server/game/sotm/`. Do not modify `server/gamenode/`
> unless you are Agent-4D.

---

### Agent-4A: Lobby UI Changes (Phase 4)

**Steps covered:** 4.1 – 4.5

**Context to provide:**
> You are implementing `sotmde-implementation-plan.md` Phase 4 (Steps 4.1–4.5).
> The repo is at `/Users/sjzhu/repos/heroteki`. Phase 3 (server game model) is
> complete. Read the plan fully before starting.
> Work only in `client/` and `server/lobby.js` / `server/lobbyserver.js`.

**Work:**
- Update `NewGame.jsx` to add villain/environment deck dropdowns with version badges;
  disable Create until no duplicate heroes
- Create `SotmDeckGrid.jsx`, `SotmHeroSelectModal.jsx`, `HeroOrderPanel.jsx`
  (`react-dnd` is already installed — use `useDrag`/`useDrop` patterns from
  `Card.jsx` and `Droppable.jsx`)
- Update `PendingGamePlayers.jsx` to use the new modal and hero order panel
- Update `PendingGame.jsx` to show villain/environment choices with version badges
- Create `UploadDeck.jsx` (user deck upload UI, client-side image preload check)
- Create `UploadCardImage.jsx` (admin image upload, admin-role-gated)
- Add Card Library nav item with visibility rules; remove "My Decks" nav item
- Strip Ashes-specific stats from profile/sidebar

**Exit gate:**
- Game creation form shows villain + environment selectors with version badges.
- Pending game lobby shows each player's hero selection UI and hero order panel.
- Upload deck UI is accessible; admin image upload is admin-gated.
- No `ashes.live` references remain in client.

---

### Agent-4B: Game Board UI (Phase 5)

**Steps covered:** 5.1 – 5.11

**Context to provide:**
> You are implementing `sotmde-implementation-plan.md` Phase 5 (Steps 5.1–5.11).
> The repo is at `/Users/sjzhu/repos/heroteki`. Read the plan fully before starting.
> Work only in `client/Components/GameBoard/`. Do not modify `AppRoutes.jsx` until
> all components are created — add the AppRoutes wiring as the last sub-step.
>
> Key requirements:
> - Token badges (`label ×count`) on ALL play-area and character cards in all three
>   area components (VillainArea, EnvironmentArea, HeroArea).
> - HP dial shown when `card.maxHp !== null` (NOT `card.hp !== null` — hp can be 0).
> - H value displayed prominently in TurnTracker as a badge (e.g. "H = 3").
> - "Advance Phase" enabled for all players during villain/env phases; only for
>   `activeControllerPlayerId` during hero phases.
> - "End Game" button always visible in TurnTracker (emits `initiateGameOver`).
> - GameOverModal opens on all clients simultaneously on `gameOverPrompt` server event.
> - Board becomes non-interactive (`isGameOver: true` in Redux state).

**Work (in order):**
1. Create `SotmBoard.jsx` (layout grid)
2. Create `VillainArea.jsx` (token badges, HP dials)
3. Create `EnvironmentArea.jsx` (token badges, HP dials)
4. Create `HeroArea.jsx` (token badges, HP dials, incapacitated overlay)
5. Create `TurnTracker.jsx` (H badge, End Game button, Advance Phase logic)
6. Create `CardContextMenu.jsx` (Add/Remove Token, Set Max HP, Adjust HP, keywords)
7. Create `DeckSearchModal.jsx`
8. Create `HpDial.jsx` (gated on `maxHp !== null`, not `hp !== null`)
9. Create `AuxZone.jsx`
10. Create `GameOverModal.jsx` (result selector, notes, tags with auto-tag preview)
11. Create post-game summary screen
12. Wire `SotmBoard` into `client/AppRoutes.jsx`

**Exit gate:**
- `client/AppRoutes.jsx` imports `SotmBoard` instead of `GameBoard`.
- `npm run build` completes without errors.
- All new components render without runtime errors when given stub props.
- Token badges visible in VillainArea, EnvironmentArea, and HeroArea with stub data.

---

### Agent-4C: API Routes (Phase 6)

**Steps covered:** 6.1 – 6.6

**Context to provide:**
> You are implementing `sotmde-implementation-plan.md` Phase 6 (Steps 6.1–6.6).
> The repo is at `/Users/sjzhu/repos/heroteki`. Read the plan fully before starting.
> Work only in `server/api/`. The SotMDE Mongoose models from Phase 2 are available
> in `server/models/`. Admin role is the existing Ashteki superuser role.

**Work:**
- Add `GET /api/sotm/decks?type=...&source=...` (returns `version`, `characterVersion`,
  `source`)
- Add `GET /api/sotm/cards?deckId=...&source=...` with user-card visibility filter
- Add `POST /api/sotm/decks/upload` user deck upload endpoint (Multer optional, JSON body)
- Add `POST /api/admin/cards/upload-image` admin image upload (Multer, JPEG/PNG/WebP, 3 MB max)
- Add admin stats endpoints: `GET /api/admin/stats/outcomes`,
  `GET /api/admin/stats/games`, `GET /api/admin/stats/games/:gameId/events`
- Stub existing `/api/decks` Ashes routes to 404
- Register all new routes in `server/api/index.js`

**Exit gate:**
- `GET /api/sotm/decks?type=villain` returns JSON with `version` and `source` fields.
- `GET /api/sotm/cards?deckId=baron-blade` returns the exemplar cards.
- `POST /api/sotm/decks/upload` accepts a valid JSON body and returns
  `{ success, warnings, cardCount, deckId }`.
- Admin stats endpoints return 200 for an authenticated admin.
- Old `/api/decks` returns 404.

---

### Agent-4D: Game State Serialization (Phase 7)

**Steps covered:** 7.1 – 7.3

**Context to provide:**
> You are implementing `sotmde-implementation-plan.md` Phase 7 (Steps 7.1–7.3).
> The repo is at `/Users/sjzhu/repos/heroteki`. Phase 3 (server game model) is
> complete. Read the plan fully before starting.
> Work only in `server/gamenode/` and `client/redux/`.
>
> The broadcast state shape includes `H`, `activeHeroId`, `activeControllerPlayerId`,
> `isGameOver`, and `setupInstructions`. One player may control multiple heroes —
> `game.getState(playerName)` must reveal the hands of ALL heroes whose
> `controllerPlayerId === playerName`.

**Work:**
- Document and verify the game state shape from `game.getState()`
- Rewrite `server/gamenode/GameStateWriter.js` to delegate to `game.getState()`
- Delete `PlayerStateWriter.js`, `CardStateWriter.js`, `DieStateWriter.js`
- Verify `client/redux/reducers/lobby.js` `gamestate` case passes through correctly
- Create `client/redux/selectors/game.js` with all eight selectors:
  `selectVillain`, `selectEnvironment`, `selectHeroes`, `selectMyHeroes`,
  `selectActiveHero`, `selectTurnState`, `selectIsGameOver`, `selectSetupInstructions`

**Exit gate:**
- `gameserver.js` compiles without errors after the deletes.
- `client/redux/selectors/game.js` exports all eight selectors.
- A game started by Agent-3's test produces a non-empty `gamestate` socket event
  (verify via browser devtools Network > WS tab or a quick socket test script).

---

## Wave 4 — Integration, Testing, Cleanup (Agents 5, 6, 7 — sequential)

### Agent-5: Chat, Game Log, and Data Logging (Phases 8 + 8.5)

**Prerequisite:** All Wave 3 agents (4A, 4B, 4C, 4D) exit gates passed. Agent-5
modifies `SotmBoard.jsx` (created by Agent-4B) and `TurnManager.advance()` /
`game.js` (created by Agent-3); all must be complete before starting.

**Steps covered:** 8.1 – 8.3, 8.5.1 – 8.5.7

**Context to provide:**
> You are implementing `sotmde-implementation-plan.md` Phases 8 and 8.5.
> The repo is at `/Users/sjzhu/repos/heroteki`. Phases 1–7 are complete.
> Read the plan fully before starting.
> Phase 8 is small (confirm chat, auto-log transitions and moves).
> Phase 8.5 is larger — MongoDB collections/indexes, `logEvent()`, `finaliseGame()`,
> Game Over socket wiring, abandoned game handling, and the admin stats React page.

**Work:**
- Adapt `Messages.jsx`: replace `message.activePlayer` CSS logic with `message.type`-based
  styling (`system` / `action` / `chat`); confirm `sendMessage` works end-to-end (Phase 8.1)
- Add phase-transition log entries in `TurnManager.advance()` (Phase 8.2)
- Add card-move log entries in `game.js` (Phase 8.3)
- Create `gameEvents`, `gameOutcomes`, `gameStates` MongoDB indexes (8.5.1)
- Implement `logEvent()` and wire into all socket event handlers (8.5.2)
- Implement `finaliseGame()` with auto-tag derivation (8.5.3a)
- Add `initiateGameOver`, `submitGameOver`, `cancelGameOver` socket handlers (8.5.3b)
- Add non-interactive board overlay on `GAME_OVER` phase (8.5.3d)
- Add `endSession` handler and inactivity TTL worker (8.5.5)
- Create admin stats React page `StatsPage.jsx` (8.5.7)

**Exit gate:**
- Two browsers can exchange chat messages.
- Phase advance appears as a system message in chat.
- Card moves appear as action messages in chat.
- Pressing "End Game" opens `GameOverModal` on both browsers simultaneously.
- Submitting the modal writes a document to `gameOutcomes`.
- `gameEvents` collection has one document per socket event after a test game.

---

### Agent-6: Testing & Smoke Checks (Phase 9)

**Prerequisite:** Agent-5 exit gate passed.

**Steps covered:** 9.1 – 9.2

**Context to provide:**
> You are implementing `sotmde-implementation-plan.md` Phase 9.
> The repo is at `/Users/sjzhu/repos/heroteki`. Phases 1–8.5 are complete.
> Read the plan fully before starting.
> Run through the full manual smoke test checklist (including token, Game Over,
> async play, and admin sections) with two browser windows.
> Then delete Ashes card tests and write five new test files.

**Work:**
- Manual smoke test checklist (all items in Step 9.1 — includes token add/remove,
  token clear on zone exit, H value, async reconnect, admin stats, etc.)
- Delete `test/server/game/cards/` test files
- Fix broken tests under `test/server/` covering lobby/user/socket plumbing
- Write `test/server/game/sotm/turnManager.test.js`
- Write `test/server/game/sotm/heroPlayer.test.js`
- Write `test/server/game/sotm/cardImageGenerator.test.js`
- Write `test/server/game/sotm/cardTemplates/textUtils.test.js`
- Write `test/server/game/sotm/finaliseGame.test.js`

**Exit gate:**
- All smoke test checklist items pass.
- `npm test` passes (or known failures are documented with a clear reason).

---

### Agent-7: Cleanup and Documentation (Phase 10)

**Prerequisite:** Agent-6 exit gate passed.

**Steps covered:** 10.1 – 10.3

**Context to provide:**
> You are implementing `sotmde-implementation-plan.md` Phase 10.
> The repo is at `/Users/sjzhu/repos/heroteki`. All prior phases are complete.
> Read the plan fully before starting.

**Work:**
- Delete all stubbed-out files from Phase 1 that are no longer imported
- Delete the Ashteki prompt-system dead-code UI components (verify each is unimported
  before deleting): `ActivePlayerPrompt.jsx`, `SplashPlayerPrompt.jsx`, `AlertSplash.jsx`,
  `ActivePromptControls.jsx`, `ActivePromptButtons.jsx`, `ChimeraRow.jsx`,
  `PlayerPBRow.jsx`, `PlayerRow.jsx`, `PlayerStats.jsx`, `ReplayControls.jsx`,
  `GameBoard.jsx`, `GameBoard.scss`
- Run `npm run lint` and fix all warnings
- Replace `docs/` with the seven new SotMDE docs: `setup.md`, `card-data.md`,
  `user-decks.md`, `card-templates.md`, `game-model.md`, `logging.md`, `admin.md`
- Update `docker-compose.yml` and `README.md` for new import command and
  `privateMode` environment variable override

**Exit gate:**
- `npm run lint` exits with zero warnings.
- `npm test` still passes after dead-code removal.
- Docker compose file has no `ashteki` labels.
- All seven doc files exist in `docs/`.
- None of the deleted GameBoard components appear in any import statement.

---

## Parallelism Notes for the Orchestrator

When launching Wave 3, pass each agent a **read-only copy of the Phase 3 exit
artifacts** so they don't need to re-read the full codebase:

1. The socket event table (copy from Step 3.6 of the plan).
2. The game state shape (copy from Step 7.1).
3. The list of files each agent is allowed to touch (above).

This prevents agents from accidentally duplicating each other's work or causing
merge conflicts on shared files.

**Known file-level conflict risk in Wave 3:**
- `server/api/index.js` — Agent-4C will edit this. Agents 4A, 4B, 4D must not
  touch it.
- `client/AppRoutes.jsx` — Agent-4B edits this last. Agent-4A must not touch it.
- `server/lobby.js` / `server/lobbyserver.js` — Agent-4A edits this; no other
  Wave 3 agent should.
- `server/gamenode/` — Agent-4D edits this exclusively. Agents 4A, 4B, 4C must not
  touch it (see shared context restriction above).
- `client/redux/reducers/lobby.js` — Agent-4D touches this. No other Wave 3 agent
  should.

---

## Hand-Off Artifacts

Each agent should produce a short hand-off note (appended to its commit message or
as a comment in the PR description) listing:
- Which files were created or significantly changed
- Any assumptions made that differ from the plan
- Any known issues or TODOs left for the next agent

This is especially important for Agent-3 (Phase 3) whose output is consumed by
all four Wave 3 agents simultaneously.

---

## Phase 11 — Playtesting Iteration (ongoing, no fixed agent)

Phase 11 steps are driven by playtesting feedback and repeat as many times as
needed. Each step is a small self-contained change — no agent hand-off protocol
required. Provide any Phase 11 agent with:

1. The specific Step 11.x reference from the plan.
2. Which files are in scope (listed in the step).
3. The stable-contract reminder: do not change socket event names, payload shapes,
   or game state shape fields unless explicitly adding new ones.

**Turn structure changes (Step 11.2) are especially low-risk** — the entire
turn structure lives in `TurnManager.js` and `TurnTracker.jsx`. An agent can
add, remove, or reorder phases by editing those two files only.

---

## Estimated Complexity by Agent

| Agent | Phase | Complexity | Key risk |
|---|---|---|---|
| Agent-0 | 0 | Low | None |
| Agent-1 | 1 | Medium | `game.js` size; gamesteps/ import chains |
| Agent-2A | 2 (schemas) | Low | MongoDB connection during import |
| Agent-2B | 2 (images + SotmCard) | Medium | Sharp SVG rendering; `escapeXml` correctness |
| Agent-3 | 3 | **High** | `game.js` rewrite; TurnManager H/HeroSlot; async play |
| Agent-4A | 4 | Medium | PendingGamePlayers hero selection + order flow |
| Agent-4B | 5 | **Medium-High** | Many new components; token badges; GameOverModal |
| Agent-4C | 6 | Low-Medium | Route registration; Multer config |
| Agent-4D | 7 | Medium | GameStateWriter delegation; per-player serialization |
| Agent-5 | 8 + 8.5 | Medium | logEvent wiring; finaliseGame; admin stats page |
| Agent-6 | 9 | Medium | Smoke tests require running app |
| Agent-7 | 10 | Low | Lint cleanup; doc writing |
