---
name: project-sotmde-status
description: SotMDE implementation status — current phase, completed work, and what's next
metadata:
  type: project
---

This repo (`/home/sjzhu/repos/heroteki`) is a fork of Ashteki being converted into a Sentinels of the Multiverse: Definitive Edition (SotMDE) online facilitator. The plan files are `sotmde-implementation-plan.md` and `sotmde-agent-orchestration.md`. Progress is tracked in `IMPLEMENTATION_LOG.md`.

**Waves 1–3 complete (as of 2026-06-06):**
- Phase 0 — repo rename/setup
- Phase 1 — purge Ashes rules engine
- Phase 2A/2B — card/deck schemas, import script, placeholder image gen, SotmCard class
- Phase 3 — server-side game model (HeroPlayer, VillainController, EnvironmentController, TurnManager, game.js rewrite, async play, pendinggame/lobby wiring)
- Phase 4 — lobby UI (villain/env dropdowns, SotmHeroSelectModal, HeroOrderPanel, UploadDeck, Card Library)
- Phase 5 — game board UI (SotmBoard, VillainArea, EnvironmentArea, HeroArea, TurnTracker, CardContextMenu, HpDial, GameOverModal, PostGameSummary, AppRoutes wired)
- Phase 6 — API routes (/api/sotm/decks, /api/sotm/cards, deck upload, admin image upload, stats endpoints)
- Phase 7 — game state serialization (GameStateWriter finalized, 3 stale writers deleted, 8 Redux selectors)

**Inter-wave fix (2026-06-09):** `Application.jsx` `blinkTab` updated to use `activeControllerPlayerId` instead of the missing `currentGame.players` field.

**Next: Wave 4 — sequential (Agent-5 → Agent-6 → Agent-7)**
- Agent-5: Phases 8 + 8.5 — chat log styling, phase-transition log entries, card-move log entries, MongoDB indexes for gameEvents/gameOutcomes/gameStates, logEvent() wiring, finaliseGame(), abandoned game handling, admin stats React page
- Agent-6: Phase 9 — manual smoke tests + new test files
- Agent-7: Phase 10 — dead code cleanup, docs, Docker labels

**Critical known deviations Agent-5 must know:**
- Agent-4B already implemented `initiateGameOver`/`cancelGameOver` socket wiring and `gameOverPrompt`/`gameOverCancelled` Redux handling (Phase 8.5.3b) — Agent-5 must NOT redo this; verify it exists before touching those handlers
- `searchDeck` currently broadcasts deck contents to all players (not just requester) — noted as known limitation; Phase 7 exit gate item deferred; Agent-5 or later should address via a private emit path
- Two `cdn.ashes.live` refs remain in `client/util.js` and `client/Components/Decks/DeckSummary.jsx` — unreachable in SotMDE paths, Phase 10 cleanup

**Key architectural facts:**
- DB: uses monk (not Mongoose) everywhere
- Socket channel for game state: `gamestate`
- `game.getState(forPlayerName)` shape: `{ gameId, round, phase, H, activeHeroId, activeControllerPlayerId, villain, environment, heroes[], chatLog, setupInstructions, isGameOver }`
- `currentGame.players` does NOT exist in SotMDE game state — use `heroes[]` with `controllerPlayerId` field instead
- `playersAndSpectators` is keyed by username (one entry per human, regardless of hero count) — no duplicate socket emissions

**How to apply:** For Wave 4, use `sotmde-agent-orchestration.md` Agent-5 section for the exact prompt. Always read IMPLEMENTATION_LOG.md first for deviations from prior agents.
