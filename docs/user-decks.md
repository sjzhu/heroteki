# User Deck Upload

Players can upload their own custom decks in JSON format without needing admin access.
Uploaded decks are tagged with `source: "user"` and are visible only to their owner
and admins.

## Upload Endpoint

```
POST /api/sotm/decks/upload
Content-Type: application/json
Authorization: <session cookie>
```

## Upload JSON Format

The request body must be a self-contained JSON package containing the deck metadata,
the character card, and all play cards inline:

```json
{
  "deck": {
    "id": "my-custom-hero",
    "name": "My Custom Hero",
    "deckType": "hero",
    "version": "1.0.0",
    "characterCardId": "my-custom-hero-char",
    "characterVersion": "1.0.0",
    "setupInstructions": null
  },
  "characterCard": {
    "id": "my-custom-hero-char",
    "name": "My Custom Hero",
    "deckId": "my-custom-hero",
    "type": "heroCharacter",
    "keywords": [],
    "text": "Power: Do something.",
    "hp": 30,
    "imageUrl": "https://example.com/my-hero-char.png",
    "version": "1.0.0"
  },
  "cards": [
    {
      "id": "my-custom-hero-01",
      "name": "First Card",
      "deckId": "my-custom-hero",
      "type": "heroCard",
      "keywords": ["ongoing"],
      "text": "Ongoing: Do something.",
      "hp": null,
      "imageUrl": "https://example.com/my-first-card.png",
      "version": "1.0.0"
    }
  ]
}
```

## Response Format

```json
{
  "success": true,
  "warnings": ["Hero deck has 1 card(s); expected 40"],
  "cardCount": 1,
  "deckId": "my-custom-hero"
}
```

Warnings are returned for non-standard deck sizes (below 40/25/15 for hero/villain/environment)
but the upload is not rejected. This allows uploading partial or experimental decks.

## Image URL Guidance

For user uploads, `imageUrl` fields should be **absolute external URLs** pointing to
publicly accessible images:

```json
"imageUrl": "https://drive.google.com/uc?id=YOUR_FILE_ID"
```

The server stores the URL as-is. The client loads it via a standard `<img>` tag. Broken
URLs result in a broken image icon; the client UI performs a preload check and displays
a warning list for any images that fail to load after upload.

If `imageUrl` is `null` or omitted, the server generates a text-only PNG placeholder
image and stores it under `public/card-images/placeholders/`.

## Version Field Requirement

The `version` field is required on the deck. Card `version` fields default to the deck
version if omitted. Version values are stored as strings — semantic versioning is
recommended but not enforced.

## Side Deck Format

Include an optional `sideDeck` field on the deck object:

```json
{
  "deck": {
    ...
    "sideDeck": {
      "id": "my-side-deck",
      "name": "My Side Deck",
      "version": "1.0.0",
      "cardIds": ["my-custom-hero-side-01", "my-custom-hero-side-02"],
      "setupInstructions": "Set these aside before shuffling the main deck."
    }
  }
}
```

Cards referenced in `cardIds` must appear in the `cards` array of the same upload payload.

## Managing Your Uploads

The Card Library page (`/decks`) shows only official and manual cards by default.
Navigate to `/decks/add` to:
- Upload a new deck JSON file
- View your uploaded decks
- Delete an uploaded deck (removes deck and all associated cards)
