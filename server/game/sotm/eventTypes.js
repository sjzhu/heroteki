// SotMDE event type constants.
// Controlled vocabulary for all socket events written to the gameEvents collection.
const EVENT_TYPES = {
    GAME_SETUP: 'gameSetup',
    PHASE_ADVANCE: 'phaseAdvance',
    PLAY_CARD: 'playCard',
    MOVE_CARD: 'moveCard',
    DISCARD_CARD: 'discardCard',
    PLAY_TOP_CARD: 'playTopCard',
    SHUFFLE_DECK: 'shuffleDeck',
    ADJUST_HP: 'adjustHp',
    FLIP_VILLAIN: 'flipVillain',
    DRAW_CARD: 'drawCard',
    MODIFY_CARD: 'modifyCard',
    SEARCH_DECK: 'searchDeck',
    GAME_OVER: 'gameOver',
    SESSION_END: 'sessionEnd'
};
module.exports = EVENT_TYPES;
