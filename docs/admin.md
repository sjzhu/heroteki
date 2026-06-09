# Admin Operations

## Making a Superuser

To grant admin access to a registered user:

```bash
node server/scripts/user/makeSuperuser <username>
```

This sets `permissions.isAdmin: true` on the user's MongoDB document. The admin role
gates the card image upload endpoint, the admin stats page, and all `/api/admin/` routes.

## Card Image Upload

Admin users can upload an image for any card via the admin panel at `/cardstats`.

### Endpoint

```
POST /api/admin/cards/upload-image
Content-Type: multipart/form-data
Authorization: <admin session cookie>
```

### Form Fields

- `cardId` (string, required) — ID of the card to update
- `image` (file, required) — JPEG, PNG, or WebP; maximum 3 MB

### Behavior

1. Validates the card exists in MongoDB
2. Generates a UUID filename to prevent collisions
3. Writes the file to `public/card-images/manual/`
4. Updates the card's `imageUrl` field in MongoDB to `/card-images/manual/{uuid}.{ext}`
5. Returns `{ success: true, imageUrl: '/card-images/manual/{uuid}.{ext}' }`

### Admin UI

The upload form is accessible at `/cardstats` (admin-only route). It includes:
- Card ID text input with autocomplete
- File picker restricted to JPEG/PNG/WebP
- Preview of the uploaded image after success

## Admin Stats Page

Available at `/admin/stats` (admin-only).

Tabs:
- **Overview** — total games, win rate by villain deck+version, win rate by hero deck+version, average duration
- **Game List** — paginated list of completed games with version badges; rows link to event log viewer
- **Event Log Viewer** — full ordered event log for any completed game, filterable by event type

Query parameters supported on the overview and game list:
- `villainDeckId` — filter by villain deck
- `heroDeckId` — filter by hero deck
- `result` — `heroVictory` | `villainVictory` | `abandoned`
- `dateFrom` / `dateTo` — date range (ISO 8601)

## privateMode Configuration

HTTP Basic Auth gates the entire lobby when `privateMode: true`.

### Local Development

Add to `config/local.json5`:

```json5
{
  privateMode: true,
  privateUser: 'your-username',
  privatePassword: 'your-password'
}
```

### Docker Deployment

Pass overrides via environment variables in `docker-compose.override.yml`:

```yaml
# docker-compose.override.yml
version: '3.5'
services:
  lobby:
    environment:
      - NODE_CONFIG={"privateMode":true,"privateUser":"user","privatePassword":"pass"}
  node:
    environment:
      - NODE_CONFIG={"privateMode":true,"privateUser":"user","privatePassword":"pass"}
```

The `NODE_CONFIG` environment variable is read by the `config` npm package as a JSON
override on top of `config/default.json5`.

Alternatively, add a `config/local.json5` file into the Docker image (or mount it as a
volume) for persistent configuration.

> **Security note:** HTTPS is required when using HTTP Basic Auth. Credentials are
> base64-encoded over the wire — without TLS they are trivially readable. Use a reverse
> proxy (nginx/Caddy) with a TLS certificate in production.
