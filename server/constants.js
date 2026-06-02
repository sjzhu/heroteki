// SotMDE: Ashes card-type constants removed in Phase 1.
// Only GameTypes (SotMDE-appropriate) and generic Location retained.

const Location = {
    Deck: 'deck',
    Hand: 'hand',
    Discard: 'discard',
    PlayArea: 'play area'
};

// SotMDE game types — replaces Ashes pvp/chimera/league
const GameTypes = Object.freeze({ standard: 'standard', casual: 'casual' });

module.exports = {
    Location,
    GameTypes
};
