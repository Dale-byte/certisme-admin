# CertiSME Admin API (Cloudflare Worker)

Reference backend for the CertiSME Admin dashboard. It reads and writes your
storefront repository on GitHub, so every change made in the dashboard becomes a
commit, and publishing triggers your GitHub Actions deploy workflow.

## 1. Install

```bash
cd worker
npm install
```

## 2. Configure

Edit `wrangler.toml` and set `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`,
paths, `ADMIN_USERNAME`, and `ALLOWED_ORIGINS` (the dashboard's URL plus
`http://localhost:8080` for local development).

Then set the secrets:

```bash
# GitHub fine-grained token: Contents read/write + Actions read/write on the repo
npx wrangler secret put GITHUB_TOKEN

# Session signing key
openssl rand -hex 32          # copy the output
npx wrangler secret put SESSION_SECRET

# Your admin password, stored as a sha256 hash
printf 'YOUR-PASSWORD' | shasum -a 256   # copy the hex part
npx wrangler secret put ADMIN_PASSWORD_HASH

# Optional payment credentials surfaced in Site Settings
npx wrangler secret put MERCHANT_ID
npx wrangler secret put MERCHANT_KEY
```

## 3. Deploy

```bash
npx wrangler deploy
```

Wrangler prints a URL like `https://certisme-api.<subdomain>.workers.dev`.
Put that in the dashboard's `.env`:

```
VITE_API_BASE_URL=https://certisme-api.<subdomain>.workers.dev
VITE_SITE_BASE_URL=https://certisme.co.za
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/login` | `{username, password}` → `{token, user}` (24h) |
| GET | `/auth/me` | Validates the bearer token |
| GET/POST | `/frameworks` | List / create framework → frameworks array |
| PUT/DELETE | `/frameworks/:id` | Update / delete → frameworks array |
| GET/POST | `/products` | List / create product → products array |
| PUT/DELETE | `/products/:id` | Update / delete → products array |
| GET | `/documents` | Which products have a document, and its size |
| POST | `/documents?product=<id>` | Raw file body → commits the document |
| POST | `/images/:productId` | Raw image body → commits the product image |
| GET/PUT | `/settings` | Site settings (merchant fields are write-only) |
| POST | `/deploy` | Triggers the deploy workflow, returns commit URL |
| GET | `/deploy/status` | Latest workflow run status |
| GET | `/audit` | 50 most recent commits |

Errors are returned as `{ "error": "human readable message" }` with a matching
HTTP status.
