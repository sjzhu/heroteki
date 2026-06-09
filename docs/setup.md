# Local Development Setup

## Prerequisites

- **Node.js 18** — Use [nvm](https://github.com/nvm-sh/nvm) to manage versions
- **Docker** — For running MongoDB and Redis infrastructure

## Infrastructure

Bring up MongoDB and Redis with Docker Compose:

```bash
docker compose up mongo redis -d
docker compose ps   # verify both show 'running'
```

## Install Dependencies

```bash
npm install
mkdir server/logs   # required on first run
```

## Configuration

Create `config/local.json5` (gitignored — never commit):

```json5
{
  mongo: 'mongodb://localhost:27017/sentinels',
  redisUrl: 'redis://localhost:6379/',
  gameNode: {
    hostname: 'localhost',
    origin: '*'
  }
}
```

## Seed Card Data

```bash
node server/scripts/importSotmData.js --skip-count-validation
```

The `--skip-count-validation` flag bypasses the strict 40/25/15 card count check for
the exemplar data (3 cards per deck). Omit it when importing full production decks.

The script imports all cards from `data/sotm/cards/` and decks from `data/sotm/decks/`,
generates PNG placeholder images for cards with `imageUrl: null` into
`public/card-images/placeholders/`, and logs version diffs for updated records.

## Running the App

```bash
node .                 # Lobby server — http://localhost:4000
node server/gamenode   # Game node  — ws://localhost:9500
```

Both processes must be running. The lobby handles auth, game creation, and deck management.
The game node handles all real-time socket events during active games.

## privateMode (HTTP Basic Auth)

Add to `config/local.json5`:

```json5
{
  privateMode: true,
  privateUser: 'your-username',
  privatePassword: 'your-password'
}
```

For Docker deployments, pass as environment variable overrides in
`docker-compose.override.yml` (see `docs/admin.md`). Basic Auth is applied at the lobby
server level. For production, apply at the reverse proxy (nginx/Caddy) to cover both ports.
HTTPS is required — credentials are base64-encoded without TLS.

## Admin User

```bash
node server/scripts/user/makeSuperuser <username>
```

## Testing

```bash
npm test        # 133 Jasmine specs
npm run lint    # ESLint + Prettier check
npm run build   # Production Vite build
```
