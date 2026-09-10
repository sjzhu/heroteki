---
name: project-sotmde-status
description: SotMDE implementation status — completed work, current state, and key architectural facts
metadata:
  type: project
---

This repo (working dir `/mnt/data/sentinels/heroteki`, project name `heroteki` /
"SotMDE Online") is a fork of Ashteki converted into a **manual-play** facilitator for
Sentinels of the Multiverse: Definitive Edition. No card rules are automated — the server
only tracks zones, HP, tokens, turn phase, chat, and event/outcome logs.

Plan files (historical, conversion is done): `sotmde-implementation-plan.md`,
`sotmde-agent-orchestration.md`. Per-phase notes: `IMPLEMENTATION_LOG.md`.

## Status — conversion complete

**Phases 0–10 all complete** (finished 2026-06-11):
- 0 repo rename/setup · 1 purge Ashes engine · 2 card/deck schemas + import + placeholder
  images · 3 server game model · 4 lobby UI · 5 game board UI (`SotmBoard`) · 6 `/api/sotm/*`
  routes · 7 state serialization · 8 + 8.5 chat/log/outcomes + admin stats · 9 tests ·
  10 dead-code cleanup + docs

**Post-orchestration gameplay work** (2026-06-11, not tracked per-phase in the log until
the "Post-orchestration feature work" section was added):
- Move/play cards to any play area (`_genericMoveCard`, cross-controller) + destination
  validation
- Deck search modal: deck-order display, Play action, per-hero Move to Hand
- Explicit incapacitate/restore toggle; HP frozen while incapacitated
- One-shots go to the play area for manual resolution (not auto-trashed)
- Infra: single cached monk connection (`server/db.js`), standardized on `sotmCards` /
  `sotmDecks` collections, surface card-load failures, persist SotMDE fields in
  `PendingGame.getSaveState`

## Dependency / security state (as of 2026-09-10)

- `npm audit` is at **2 moderate** (`express` → `qs`), down from 57. Clearing the last
  two needs an **express 4 → 5 migration** (breaking: routing wildcards, `req.query`
  getter, error handling).
- `@sentry/node` is still v6; its vulnerable `cookie` transitive is pinned via a
  `package.json` `overrides` block. A proper `@sentry/node` v6 → v10 migration
  (`Sentry.Handlers.*` / `configureScope` are gone) is deferred — touches
  `lobbyserver.js`, `gameserver.js`, `socket.js`, pairs with `@sentry/browser@8`.
- Removed this session: `request` (→ native fetch in `server/util.js`), the whole
  Patreon integration, `@sendgrid/mail` (mail goes through `MailJetSender`), `jest` /
  `babel-jest`, and a pile of unused eslint/build deps. `bcrypt`→6, `sharp`→0.35,
  `nodemailer`→10, `uuid`→11.
- `.eslintrc.js` now extends only `eslint:recommended` + react/react-hooks/prettier/
  jasmine. No airbnb/import/node/jsx-a11y/typescript-eslint.

## Known leftovers / tech debt

- Ashes-era cruft still present: `server/services/Ashes*.js`, `server/stats_old.js`,
  `server/api/{decks,games,banlist}.js`, much of `client/Components/GameBoard/`,
  `test/helpers/` (deckbuilder/integrationhelper/gameflowwrapper — Ashteki chain). Kept
  where an import chain still touches them (e.g. `ChimeraPage` → DeckList → DeckDice).
- `searchDeck` in `game.js` has a dead `socket.send('deckContents')` path — `socket` is
  never passed by `gameserver.js`. Deck contents already ride in broadcast state; the
  client `DeckSearchModal` reads from there.
- 10 file-level `react-hooks/exhaustive-deps` eslint-disables in legacy client components.
- `test/` coverage is server-only: 6 spec files under `test/server/game/sotm/`. No client
  tests.

## Key architectural facts

- DB: `monk` (not Mongoose), shared singleton via `server/db.js` `getDb()` — never
  `.close()` it.
- Two processes: `node .` (lobby, :4000) and `node server/gamenode` (game node, :9500).
- Build: **Vite** (`vite.config.mjs`), not Webpack. `npm run dev` / `npm run build`.
- Socket channel for game state: `gamestate`.
- `game.getState(forPlayerName)` shape: `{ gameId, round, phase, H, activeHeroId,
  activeControllerPlayerId, villain, environment, heroes[], chatLog, setupInstructions,
  isGameOver }`.
- **No `currentGame.players` map** (Ashteki-ism) — use `heroes[]` with `controllerPlayerId`.
  `H` is the fixed hero-deck count, never changes on incapacitation.
- `playersAndSpectators` keyed by username — one entry per human regardless of hero count.
- `controllerId` in socket payloads = `'villain'` | `'environment'` | hero `deckId`.
- Node 22.12.0, pinned in `.nvmrc` + `.node-version` (22.12 is the Vite 8 floor). CI
  (`.github/workflows/node.js.yml`) reads `.nvmrc` and runs on `main`. The committed
  `package-lock.json` was regenerated 2026-09-09 to un-stick `npm ci`.

## How to apply

Read `IMPLEMENTATION_LOG.md` for per-agent deviations before touching converted areas.
`docs/game-model.md` has the current server model + socket command table.
