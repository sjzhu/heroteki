# SotMDE Online

A web-based facilitator for playing Sentinels of the Multiverse: Definitive Edition in your browser.

## What is it?

SotMDE Online is a manual-play game board for Sentinels of the Multiverse: Definitive Edition (SotMDE).
No rules are automated — all card effects are resolved by the players. The server tracks zone contents,
HP, turn phase, and game state only.

This project is a fork of [Ashteki](https://github.com/Ashteki/ashteki) (which descends from
ringteki/keyteki), retaining the Node.js/React/Socket.IO/MongoDB infrastructure while replacing
the Ashes rules engine with the SotMDE cooperative game model.

## Development

### Prerequisites

- Git
- Node.js 18
- MongoDB
- Redis

The best way to install Node is using nvm (node version manager).

### Docker (infrastructure only)

Bring up MongoDB and Redis via Docker Compose, then run the app natively:

```bash
docker compose up mongo redis -d
```

### Setup

Clone the repository, then run:

```bash
npm install
mkdir server/logs
```

Create `config/local.json5` with local overrides (this file is gitignored — do not commit it):

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

### Running

There are two executable components:

```bash
node .                 # lobby server (http://localhost:4000)
node server/gamenode   # game node server
```

### Admin user

To escalate a registered user to admin role:

```bash
node server/scripts/user/makeSuperuser <username>
```

### Private Mode (HTTP Basic Auth)

When `privateMode: true` is set in config, the entire lobby is protected by HTTP Basic Auth.
Set `privateUser` and `privatePassword` in `config/local.json5` (never commit credentials).

```json5
{
  privateMode: true,
  privateUser: 'youruser',
  privatePassword: 'yourpassword'
}
```

**Note:** HTTP Basic Auth can alternatively be applied at the reverse proxy level (nginx/Caddy)
to cover both the lobby and game node with a single rule. HTTPS is required for Basic Auth to
be secure — credentials are base64-encoded, not encrypted, without TLS.

### Testing

```bash
npm test
npm run lint
```

### Coding Guidelines

All JavaScript should pass ESLint according to the rules in `.eslintrc`.

## License

MIT
