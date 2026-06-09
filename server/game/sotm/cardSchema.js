/**
 * SotMDE card schema definition.
 * All card JSON in data/sotm/ must conform to this shape.
 *
 * Breaking rename from v1: 'hero', 'villain', 'environment' are replaced by
 * 'heroCard', 'villainCard', 'environmentCard' to avoid ambiguity with deckType
 * and to match the template registry keys.
 */
const CARD_TYPES = [
    'heroCard',
    'villainCard',
    'environmentCard',
    'heroCharacter',
    'villainCharacter'
];
const KEYWORDS = ['one-shot', 'ongoing', 'equipment', 'limited', 'power'];

/**
 * Card JSON object shape:
 *
 * | Field        | Type          | Required   | Notes |
 * |---|---|---|---|
 * | id           | string        | Yes        | Unique slug, e.g. "legacy-02" |
 * | name         | string        | Yes        | Display name |
 * | deckId       | string        | Yes        | Owning deck, e.g. "legacy" |
 * | type         | string        | Yes        | One of CARD_TYPES |
 * | keywords     | string[]      | Yes        | Subset of KEYWORDS; may be empty array |
 * | text         | string        | Yes        | Full card text (display only; not parsed) |
 * | hp           | number|null   | Yes        | Character cards only; null for all others |
 * | imageUrl     | string|null   | No         | Null triggers placeholder generation |
 * | version      | string|null   | No         | Inherited from deck version if null |
 * | source       | string        | Set by server | "official" | "manual" | "user" |
 * | uploadedBy   | string|null   | Set by server | User ID for "user" source cards |
 * | template     | string|null   | No         | Override SVG template key; null = type-based lookup |
 */

module.exports = { CARD_TYPES, KEYWORDS };
