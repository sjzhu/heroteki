// SotMDE zone type constants.
// All zone identifiers used in game state and socket events must use these values.
const ZONE_TYPES = {
    HAND: 'hand',
    DECK: 'deck',
    TRASH: 'trash',
    PLAY_AREA: 'playArea',
    CHARACTER: 'character',   // single face-up card, never moves
    AUX_DECK: 'auxDeck',      // side deck draw pile
    AUX_TRASH: 'auxTrash',    // side deck discard
};
module.exports = ZONE_TYPES;
