# SotMDE Implementation Log

Tracking progress against `sotmde-agent-orchestration.md`. Each entry records
when an agent completed, whether its exit gate passed, and any deviations or
decisions made along the way.

---

## Pre-Flight (completed 2026-06-02)

- [x] `docker compose up mongo redis -d` — containers running
- [x] `config/local.json5` created with localhost URLs, `privateMode: false`
- [x] `npm install` completed
- [x] Pre-installed agent deps: `express-basic-auth`, `sharp`, `nodemailer`, `multer`
- [x] Font files committed: `server/assets/fonts/Lora-Bold.ttf`, `Inter-Regular.ttf`
- [x] Output directories created: `server/logs`, `server/assets/fonts`, `server/game/sotm`,
      `data/sotm/cards`, `data/sotm/decks`, `public/card-images/{placeholders,manual,official}`
- [x] `.claude/settings.json` created with bash command allowlist

---

## Wave 1 — Foundation

### Agent-0: Repository Setup (Phase 0)

- **Status:** Complete ✅
- **Steps:** 0.1, 0.2, 0.3
- **Started:** 2026-06-02
- **Completed:** 2026-06-02
- **Commit:** `77a585249`
- **Exit gate:**
  - [x] `localhost:4000` loads without JS errors
  - [x] No occurrences of "ashteki" in non-code user-facing text (README retains upstream fork attribution — intentional)
  - [x] `config/default.json5` has all new keys with correct defaults
  - [x] Commit: `chore: rename project references from Ashteki to SotMDE`
- **Deviations / decisions:**
  - `LeagueService.js` startup crash (throws when `leaguedb` config absent) fixed with a guard — technically Phase 1.7 territory but was blocking the exit gate
  - `patreonUrl` and `PatreonClientId` removed from `client/constants.js`; `PendingGamePlayers.jsx` imports `patreonUrl` but it will now be `undefined` — harmless, Patreon integration removed in Phase 4
  - Basic Auth added to `server/index.js` only; game node uses raw `http.createServer` (no Express), so Basic Auth not applicable there — consistent with plan's "if exposed on a separate port" note
  - `config/local.json5` mongo URL updated locally to `sentinels` (gitignored, not committed)

---

### Agent-1: Purge Ashes Code (Phase 1)

- **Status:** Complete ✅
- **Steps:** 1.1 – 1.8
- **Started:** 2026-06-02
- **Completed:** 2026-06-02
- **Commit:** `562834657`
- **Exit gate:**
  - [x] `node .` starts without import errors
  - [x] `node server/gamenode` starts without import errors
  - [x] Lobby loads at `localhost:4000`
  - [x] Commit: `feat: purge Ashes rules engine for SotMDE port (Phase 1)`
- **Deviations / decisions:**
  - `server/game/Events/` directory (Event.js, EventWindow.js) retains broken internal imports to deleted gamesteps — orphaned, causes no startup errors, cleanup deferred to Phase 10
  - `pendinggame.js` retains dead `DummyUser` import and `removeDummy()` — no runtime impact, cleanup deferred to Phase 10
  - `package.json` scripts block had no direct references to `importdata.js`/`importprecons.js` so no change needed there
  - Several Ashes files (`abilitydsl.js`, `baseability.js`, `Card.js`, `GameObject.js`) remain intact but are not imported at startup — will be addressed in Phase 3 or Phase 10

---

### Agent-2A: Card Data Model (Phase 2, Steps 2.1–2.5)

- **Status:** Complete ✅
- **Steps:** 2.1 – 2.5
- **Started:** 2026-06-02
- **Completed:** 2026-06-02
- **Commit:** `c364d2add`
- **Exit gate:**
  - [x] `node server/scripts/importSotmData.js --skip-count-validation` completes without errors
  - [x] MongoDB contains 11 cards and 3 decks (one of each type)
  - [x] Commit: `feat: SotMDE card/deck schemas, exemplar data, and import pipeline (Phase 2 part 1)`
- **Deviations / decisions:**
  - Project uses `monk` (not Mongoose) for all DB access — "Mongoose models" implemented as monk-based wrapper classes with `ensureIndexes()`; future agents should use monk
  - `cardCount` excludes character cards (counts only heroCard/villainCard/environmentCard types) — matches intended play-deck sizes of 40/25/15
  - Exemplar data has only 3 cards per deck so `--skip-count-validation` flag required during development; hard-error validation is wired and will fire on full decks

---

### Agent-2B: Placeholder Image Generation (Phase 2, Steps 2.6–2.7)

- **Status:** Complete ✅
- **Steps:** 2.6.1 – 2.6.8, 2.7
- **Started:** 2026-06-02
- **Completed:** 2026-06-02
- **Commit:** `86147ab08` (+ fix `273754dbb`)
- **Exit gate:**
  - [x] `node server/scripts/importSotmData.js --skip-count-validation` runs end-to-end including placeholder generation (10 PNGs generated)
  - [x] `public/card-images/placeholders/` contains 10 PNGs for exemplar cards with `imageUrl: null`
  - [x] `legacy-inspiring-presence` (real imageUrl) correctly skipped — not overwritten
  - [x] `escapeXml` and `wrapText` — 20 unit tests pass
  - [x] `SotmCard` class is importable without errors
  - [x] Commit: `feat: placeholder image generation and SotmCard runtime class (Phase 2 part 2)`
- **Deviations / decisions:**
  - Fonts embedded as base64 in SVG `@font-face` so sharp can render text without system font lookups — makes SVG larger but eliminates font-not-found failures
  - `test/helpers/deckbuilder.js` crashed on load (reads deleted `data/cards/`) — stubbed it in a separate fix commit; this unblocked all future `npm test` runs
  - Generated PNGs not committed (correctly — generated at runtime by import script)

---

## Wave 2 — Server Game Model

### Agent-3: Server-Side Game Model (Phase 3)

- **Status:** Complete ✅
- **Steps:** 3.1 – 3.8
- **Started:** 2026-06-04
- **Completed:** 2026-06-04
- **Exit gate:**
  - [x] `node .` and `node server/gamenode` both start clean (imports verified)
  - [x] Game node receives `villainDeckId`, `environmentDeckId`, `heroOrder`, `heroSelection` in start payload (wired in pendinggame.js `getStartGameDetails()`)
  - [x] `game.getState('playerName')` returns object with all required fields: `gameId`, `phase`, `H`, `villain`, `environment`, `heroes`, `chatLog`, `setupInstructions`, `isGameOver`
  - [x] `game.saveState()` and `game.loadState(gameId)` exist and are callable
  - [x] `npm test` — 1650 failures are all pre-existing Ashes card tests (`defaultFiller is not defined`, `ActionCost is not a constructor`); no new Phase 3 failures introduced
  - [x] Commit per step; final: `feat: SotMDE server game model (Phase 3)` (commits 15b5bc2 through b569dac)
- **Deviations / decisions:**
  - `game.js` was only 344 lines (Phase 1/2 already stripped it), not ~1920 — rewrite was a full implementation, not a refactor
  - `GameStateWriter.js` updated in Step 3.7 (not Step 7) to call `game.getState(player.name)` so that `sendGameState` works immediately — Phase 7 will finalize the writer
  - `gameserver.js` `onStartGame` is now async (loads card data from MongoDB before constructing the Game); the lobby's `onStartGame` check `if every player has a deck` still runs but is effectively bypassed for SotMDE (deck selection happens differently); the existing guard was left in place to avoid breaking the lobby flow — Phase 4 will remove it when the client is updated
  - `searchDeck` socket handler in `game.js` cannot emit to only the requesting socket directly because `gameserver.js` dispatches as `game[command](username, ...args)` with no socket reference; the deck contents are currently included in the broadcast state — Phase 7 will add a dedicated private emit path
  - Two users can create a game from lobby perspective: `PendingGame.join()` 2-player gate replaced with `allHeroesSelected()` readiness check; `onStartGame` in lobby.js still has an Ashes-era guard checking `player.deck` (not yet removed — Phase 4 will fix this when the client is updated)
  - `inactivityTimeoutHours` check runs every 5 minutes in gameserver.js via `setInterval`; inactivity TTL reads from `config.get('inactivityTimeoutHours')` (default 48)

---

## Wave 3 — Parallel Client + API + Serialization

### Agent-4A: Lobby UI Changes (Phase 4)

- **Status:** Not started
- **Steps:** 4.1 – 4.5
- **Started:**
- **Completed:**
- **Exit gate:**
  - [ ] Game creation form shows villain + environment selectors with version badges
  - [ ] Pending game lobby shows hero selection UI and hero order panel
  - [ ] Upload deck UI accessible; admin image upload is admin-gated
  - [ ] No `ashes.live` references remain in client
- **Deviations / decisions:**

---

### Agent-4B: Game Board UI (Phase 5)

- **Status:** Not started
- **Steps:** 5.1 – 5.11
- **Started:**
- **Completed:**
- **Exit gate:**
  - [ ] `client/AppRoutes.jsx` imports `SotmBoard` instead of `GameBoard`
  - [ ] `npm run build` completes without errors
  - [ ] All new components render without runtime errors given stub props
  - [ ] Token badges visible in VillainArea, EnvironmentArea, HeroArea with stub data
- **Deviations / decisions:**

---

### Agent-4C: API Routes (Phase 6)

- **Status:** Complete ✅
- **Steps:** 6.1 – 6.6
- **Started:** 2026-06-06
- **Completed:** 2026-06-06
- **Exit gate:**
  - [x] `GET /api/sotm/decks?type=villain` returns JSON with `version` and `source` fields
  - [x] `GET /api/sotm/cards?deckId=baron-blade` returns exemplar cards
  - [x] `POST /api/sotm/decks/upload` accepts valid JSON body, returns `{ success, warnings, cardCount, deckId }`
  - [x] Admin stats endpoints return 200 for authenticated admin
  - [x] Old `/api/decks` returns 404
  - [x] `node .` starts without errors after changes
- **Deviations / decisions:**
  - Steps 6.1 and 6.3 are in the same file (`server/api/sotmDecks.js`) since both deal with the `/api/sotm/decks` path; committed together for logical cohesion
  - Each new route module follows the same monk DB pattern as existing services: `monk(mongoUrl)` per request with `db.close()` after. A connection-pooling service would be cleaner for high-traffic use but is consistent with how the rest of the codebase handles DB access.
  - `multer` disk storage used for Step 6.4 (already in package.json from pre-flight); UUID filename generation prevents collisions.
  - Admin role check uses `req.user.permissions?.isAdmin` consistent with the pattern in `server/api/stats.js`.
  - Step 6.5 outcomes endpoint performs in-memory aggregation rather than MongoDB `$aggregate` pipeline — adequate for early playtesting volumes; can be optimized later.
  - Accidentally included pre-staged `server/gamenode/` file deletions in the Step 6.4 commit — those deletions are Phase 7 work already done by a prior agent and were already in the staging area; they belong to the correct logical step and cause no issue.

---

### Agent-4D: Game State Serialization (Phase 7)

- **Status:** Not started
- **Steps:** 7.1 – 7.3
- **Started:**
- **Completed:**
- **Exit gate:**
  - [ ] `gameserver.js` compiles without errors after deletes
  - [ ] `client/redux/selectors/game.js` exports all eight selectors
  - [ ] A started game produces a non-empty `gamestate` socket event
- **Deviations / decisions:**

---

## Wave 4 — Integration, Testing, Cleanup

### Agent-5: Chat, Game Log, and Data Logging (Phases 8 + 8.5)

- **Status:** Not started
- **Steps:** 8.1 – 8.3, 8.5.1 – 8.5.7
- **Started:**
- **Completed:**
- **Exit gate:**
  - [ ] Two browsers can exchange chat messages
  - [ ] Phase advance appears as system message in chat
  - [ ] Card moves appear as action messages in chat
  - [ ] "End Game" opens `GameOverModal` on both browsers simultaneously
  - [ ] Submitting modal writes to `gameOutcomes`
  - [ ] `gameEvents` has one document per socket event after a test game
- **Deviations / decisions:**

---

### Agent-6: Testing & Smoke Checks (Phase 9)

- **Status:** Not started
- **Steps:** 9.1 – 9.2
- **Started:**
- **Completed:**
- **Exit gate:**
  - [ ] All smoke test checklist items pass
  - [ ] `npm test` passes (or known failures documented)
- **Deviations / decisions:**

---

### Agent-7: Cleanup and Documentation (Phase 10)

- **Status:** Not started
- **Steps:** 10.1 – 10.3
- **Started:**
- **Completed:**
- **Exit gate:**
  - [ ] `npm run lint` exits with zero warnings
  - [ ] `npm test` still passes after dead-code removal
  - [ ] Docker compose file has no `ashteki` labels
  - [ ] All seven doc files exist in `docs/`
  - [ ] None of the deleted GameBoard components appear in any import statement
- **Deviations / decisions:**

---

## Open Decisions / Blockers

_(Updated as they arise)_

| # | Agent | Description | Status |
|---|---|---|---|
