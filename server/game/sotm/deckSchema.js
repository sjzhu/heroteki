/**
 * SotMDE deck schema definition.
 * All deck JSON in data/sotm/decks/ must conform to this shape.
 *
 * Deck JSON object shape:
 *
 * | Field               | Type           | Required   | Notes |
 * |---|---|---|---|
 * | id                  | string         | Yes        | e.g. "legacy" |
 * | name                | string         | Yes        | Display name |
 * | deckType            | string         | Yes        | "hero" | "villain" | "environment" |
 * | version             | string         | Yes        | e.g. "1.2.0"; no default — must be explicit |
 * | characterCardId     | string|null    | Yes        | Null for environment decks |
 * | characterVersion    | string|null    | Yes        | Version of the character card; null for environment |
 * | cardCount           | number         | Derived    | Computed from card list on import; not manually set |
 * | sideDeck            | SideDeck|null  | No         | See SideDeck shape below |
 * | setupInstructions   | string|null    | No         | Displayed as setup banner |
 * | source              | string         | Set by server | "official" | "manual" | "user" |
 * | uploadedBy          | string|null    | Set by server | User ID for "user" source decks |
 *
 * SideDeck shape:
 * {
 *   id: string,
 *   name: string,
 *   version: string,
 *   cardIds: string[],
 *   setupInstructions: string | null
 * }
 */

const DECK_TYPES = ['hero', 'villain', 'environment'];

/**
 * Expected deck sizes for official/manual deck validation.
 * User-uploaded decks receive warnings (not errors) on mismatch.
 */
const EXPECTED_DECK_SIZES = {
    hero: 40,
    villain: 25,
    environment: 15
};

module.exports = { DECK_TYPES, EXPECTED_DECK_SIZES };
