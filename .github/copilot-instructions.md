<!-- Repo-specific guidance for AI coding agents. Keep this short and current. -->
# Copilot instructions — SotMDE Online

## What this project is

A browser-based **manual-play** facilitator for *Sentinels of the Multiverse: Definitive
Edition* (SotMDE). **No card rules are automated** — the server only tracks zone contents,
HP, tokens, turn phase, chat, and event/outcome logs. Players resolve every card effect
themselves.

It is a fork of [Ashteki](https://github.com/Ashteki/ashteki) (← ringteki/keyteki). The
Node/React/Socket.IO/MongoDB/Redis infrastructure was kept; the Ashes rules engine was
removed and replaced with the SotMDE model in `server/game/sotm/`. The full conversion
(phases 0–10) is complete — see `IMPLEMENTATION_LOG.md`. Ashes-era files still linger in
`server/services/Ashes*.js`, `server/stats_old.js`, parts of `client/Components/GameBoard/`,
and `test/helpers/` — treat anything Ashes/Ashteki/Phoenixborn/dice/Chimera as dead unless
you can trace a live import to it.

## Runtime shape

Two processes, both started from the repo root:

```bash
node .                # lobby server (Express + REST API + static/dev client) → http://localhost:4000
node server/gamenode  # game node (raw http + socket.io, all in-game events) → :9500
```

- **Build tool is Vite** (`vite.config.mjs`), not Webpack. Dev client: `npm run dev`.
  Production bundle: `npm run build` (`vite build`). There are no webpack configs.
- **DB access is `monk`** (not Mongoose). Use the shared singleton from `server/db.js`
  (`getDb()`) — do not open per-request connections and do not call `.close()`.
- Card/deck data lives in MongoDB collections **`sotmCards`** and **`sotmDecks`**.
- Config: the `config` package reads `config/default.json5` + `config/local.json5`
  (gitignored) + the `NODE_CONFIG` env override. Never hardcode connection strings.
- Auth: passport-jwt (Bearer tokens); see `server/lobbyserver.js`. Optional site-wide
  HTTP Basic Auth gate when `config.privateMode` is true (`server/index.js`).

## Where things are

- `server/game/sotm/` — the game model: `HeroPlayer`, `VillainController`,
  `EnvironmentController`, `TurnManager`, `SotmCard`, `zones.js`, `eventTypes.js`.
  `server/game/game.js` is the orchestrator that socket commands dispatch into.
- `server/gamenode/` — the game node process and `GameStateWriter` (per-player state
  serialization broadcast on the `gamestate` socket channel).
- `server/api/` — REST routes. SotMDE endpoints are under `/api/sotm/*`
  (`sotmDecks.js`, `sotmCards.js`) and `/api/admin/*` (`adminCards.js`, `adminStats.js`).
- `server/models/` — monk wrapper classes (`sotmCard.js`, `sotmDeck.js`) with
  `ensureIndexes()`.
- `server/scripts/importSotmData.js` — seeds `sotmCards`/`sotmDecks` from
  `data/sotm/cards/` and `data/sotm/decks/`, and generates placeholder card PNGs.
- `client/` — React + Redux. Board entry point is
  `client/Components/GameBoard/SotmBoard.jsx` (wired in `client/AppRoutes.jsx`).
  Game-state selectors: `client/redux/selectors/game.js`.

## Game-state shape (important)

`game.getState(playerName)` returns
`{ gameId, round, phase, H, activeHeroId, activeControllerPlayerId, villain, environment,
heroes[], chatLog, setupInstructions, isGameOver }`.

- There is **no `currentGame.players` map** (that was Ashteki). Use `heroes[]`, each with a
  `controllerPlayerId`. `H` is the fixed hero-deck count and never changes.
- `playersAndSpectators` is keyed by username — one entry per human regardless of how many
  heroes they control.

See `docs/game-model.md` for the full model, zone list, event types, and the socket
command table.

## Conventions

- Server game-model changes **must** come with Jasmine tests under
  `test/server/game/sotm/`. Run `npm test` (jasmine) and `npm run lint` (ESLint, airbnb +
  prettier — `npm run lint:js:fix` to auto-fix).
- All logging is fire-and-forget: log failures are caught and never crash a game
  (`docs/logging.md`).
- Node version: 22.12.0, pinned in `.nvmrc` / `.node-version` (22.12 is the Vite 8
  floor). CI reads `.nvmrc`.

## Docs

`README.md` plus `docs/`: `setup.md`, `card-data.md`, `user-decks.md`, `card-templates.md`,
`game-model.md`, `logging.md`, `admin.md`, `development-process.md`,
`azure-storage-migration.md`.
