// SotMDE game state selectors.
// All components read Redux state via these selectors (Step 7.3).
// State shape: state.lobby.currentGame is the SotMDE game state object.

export const selectVillain = (state) => state.lobby.currentGame?.villain;
export const selectEnvironment = (state) => state.lobby.currentGame?.environment;
export const selectHeroes = (state) => state.lobby.currentGame?.heroes ?? [];

// All heroes controlled by the given socket user (may be more than one)
export const selectMyHeroes = (state, myPlayerId) =>
    state.lobby.currentGame?.heroes?.filter((h) => h.controllerPlayerId === myPlayerId) ?? [];

// The hero currently taking their turn (null outside hero phases)
export const selectActiveHero = (state) =>
    state.lobby.currentGame?.heroes?.find(
        (h) => h.id === state.lobby.currentGame?.activeHeroId
    ) ?? null;

export const selectTurnState = (state) => ({
    round: state.lobby.currentGame?.round,
    phase: state.lobby.currentGame?.phase,
    H: state.lobby.currentGame?.H,
    activeHeroId: state.lobby.currentGame?.activeHeroId,
    activeControllerPlayerId: state.lobby.currentGame?.activeControllerPlayerId,
});

export const selectIsGameOver = (state) => state.lobby.currentGame?.isGameOver ?? false;

export const selectSetupInstructions = (state) =>
    state.lobby.currentGame?.setupInstructions ?? null;

export const selectChatLog = (state) => state.lobby.currentGame?.chatLog ?? [];

export const selectCurrentGame = (state) => state.lobby.currentGame;

// True when the server has broadcast a gameOverPrompt to all clients
export const selectGameOverPrompt = (state) => state.lobby.gameOverPrompt ?? false;
