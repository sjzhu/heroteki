# Game Event and Outcome Logging

All logging is fire-and-forget — log failures are caught and printed to console but
never crash a game.

## gameEvents Collection

One document is written per socket event, alongside every `broadcastGameState()` call.

### Schema

```js
{
  gameId:     string,   // UUID of the game
  round:      number,   // current round number
  phase:      string,   // TurnPhase value, e.g. "hero_play"
  timestamp:  Date,     // new Date() at time of event
  actorId:    string,   // socket user id of the player who triggered the event
  actorName:  string,   // display name of the actor
  eventType:  string,   // one of EVENT_TYPES values (see eventTypes.js)
  payload:    object,   // event-specific data (cardId, delta, zone, etc.)
}
```

### Indexes

```js
{ gameId: 1, round: 1, timestamp: 1 }  // primary query pattern
{ gameId: 1, eventType: 1 }            // filtered event log views
```

### Querying Events for a Game

```js
db.collection('gameEvents')
  .find({ gameId: 'abc-123' })
  .sort({ timestamp: 1 })
```

Filter by event type:
```js
db.collection('gameEvents')
  .find({ gameId: 'abc-123', eventType: 'playCard' })
```

## gameOutcomes Collection

One document per completed game, written by `finaliseGame()`.

### Schema

```js
{
  gameId:                 string,
  startedAt:              Date,
  endedAt:                Date,
  durationMinutes:        number,
  rounds:                 number,
  result:                 string,   // 'heroVictory' | 'villainVictory' | 'abandoned'
  villainDeckId:          string,
  villainDeckVersion:     string,
  villainCharacterVersion: string | null,
  villainFinalHp:         number,
  villainWasFlipped:      boolean,
  environmentDeckId:      string,
  environmentDeckVersion: string,
  heroes: [
    {
      playerId:             string,
      playerName:           string,
      heroDeckId:           string,
      heroDeckVersion:      string,
      heroCharacterVersion: string | null,
      finalHp:              number,
      wasIncapacitated:     boolean,
      cardsPlayed:          number,
    }
  ],
  notes:  string,       // free-text from the Game Over modal
  tags:   string[],     // merged auto-tags + manual tags
}
```

### Indexes

```js
{ villainDeckId: 1, result: 1 }
{ 'heroes.heroDeckId': 1, result: 1 }   // multikey
{ villainDeckId: 1, villainDeckVersion: 1, result: 1 }
{ endedAt: 1 }
```

## Auto-Tag Format

Auto-tags are derived from every deck and character card in the game at the moment
`finaliseGame()` is called:

- **Deck tag**: `deck:{deckId}@{version}` — e.g. `deck:legacy@1.2.0`
- **Character tag**: `char:{cardId}@{version}` — e.g. `char:legacy-char@1.2.0`

One deck tag and one character tag are generated for each deck type (all hero decks,
the villain deck, the environment deck). Auto-tags are merged with any manual tags
entered in the Game Over modal; duplicates are removed.

### Querying Outcomes by Deck Version

Find all games played with Legacy v1.2.0:

```js
db.collection('gameOutcomes')
  .find({ tags: 'deck:legacy@1.2.0' })
```

Find win rate for Baron Blade v2.0.0:

```js
const games = await db.collection('gameOutcomes')
  .find({ tags: 'deck:baron-blade@2.0.0' })
  .toArray();
const wins = games.filter(g => g.result === 'heroVictory').length;
const winRate = wins / games.length;
```

Find all games where a specific hero version appeared:

```js
db.collection('gameOutcomes')
  .find({ 'heroes.heroDeckVersion': '1.1.0', 'heroes.heroDeckId': 'the-wraith' })
```

## gameStates Collection

Async play state persistence. One document per active game, upserted after every mutation.

### Schema

```js
{
  gameId: string,       // unique key
  state: object,        // full serialized game state (from game.getState(null))
  lastActivityAt: Date, // updated on every advance(); used for inactivity TTL
}
```

### Indexes

```js
{ gameId: 1 }  // unique
```

The game node rehydrates from this collection when a socket connects to a game that
has no live in-memory instance (e.g. after a server restart or after a 60-second
eviction TTL fires). Games where `lastActivityAt` is older than
`config.inactivityTimeoutHours` (default 48h) are auto-ended with
`result: "abandoned"`.
