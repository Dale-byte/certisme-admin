# certisme-admin

Build me a single-user admin dashboard called "CertiSME Admin" that manages the

public data for my static storefront. Everything it edits gets written to a

GitHub repository through a Cloudflare Worker API. The app is a pure frontend —

it must NEVER hold secrets, and it must call the API base URL from an env var I

set (VITE_API_BASE_URL).

DESIGN: Use Plus Jakarta Sans font. Match this exact palette from my storefront:

charcoal #111827, charcoal-mid #1F2937, slate #374151, coral #0D9488,

coral-dark #0F766E, coral-pale #F0FDFA, coral-border #99F6E4, blue #1D4ED8,

navy #194068, bg #FFFFFF, bg-alt #F9FAFB, border #E5E7EB. Sharp 2px corner

radius, dark sidebar, clean functional layout. Admin should feel professional

and trusted, not "demo".

LOGIN: Google sign-in restricted to one email (admin email comes from

VITE_ADMIN_EMAIL env var). After login, call GET /auth/me (Authorization:

Bearer <google-id-token>) at the API base to confirm the user is allowed.

Show a clear "you are not authorized" screen if the API rejects the token.

Store the session token in memory/localStorage; auto-logout after 24 hours.

MAIN SCREEN: a dashboard with tabs in the sidebar:

1) Products  2) Frameworks  3) Documents  4) Images  5) Site Settings  6) Deploy  7) Audit Log

[Products tab]

- List all products from GET /products (returns the products array from

  catalog.yaml). Each row: name, framework badge, price, format, image thumbnail

  (from /product-images/<id>.png on the live site), edit + delete buttons.

- Create/Edit form fields: id (slug, immutable on edit), framework (dropdown of

  existing frameworks), name, description (textarea), format (dropdown: docx,

  xlsx, pdf), file name, price (number in ZAR), includes (dynamic list of

  bullets, add/remove).

- On save call POST /products (create) or PUT /products/:id (edit). Delete calls

  DELETE /products/:id. All endpoints return the updated products array.

- Show a friendly confirmation toast on success and an inline error on failure.

[Frameworks tab]

- List frameworks from GET /frameworks. Each shows name, short id, full name,

  badge color.

- Create/Edit: name, id, full_name, and description. POST /frameworks,

  PUT /frameworks/:id, DELETE /frameworks/:id.

[Documents tab]

- For product document upload: pick a product (dropdown), choose a file

  (.docx/.xlsx/.pdf, max 25MB), upload via POST /documents with the product id as

  a query param and the file as the body (Content-Type from the file). Show

  upload progress bar and success/failure state. List existing upload status

  from GET /documents (shows which products already have a document and its size).

[Images tab]

- Pick a product, upload a .png/.jpg/.webp (max 5MB). POST /images/<product-id>

  with image bytes as body. Show the current image side by side with the

  uploaded candidate before confirming. After upload, show the resulting

  image URL on the live storefront.

[Site Settings tab]

- Form for site-wide settings loaded from GET /settings: site name, site url,

  contact email. Fields for merchant_id and merchant_key are shown but

  write-only (value hidden, shown as saved/unsaved state) since they are

  secrets. Save via PUT /settings. Warn that changing site URL updates

  canonical/og/sitemap references.

[Deploy tab]

- Big "Publish all changes" button. On click, call POST /deploy. Show the

  response: the commit URL on GitHub, and the GitHub Actions run status

  (from GET /deploy/status). Explain in copy that every change is only

  visible on the live site after this step.

[Audit Log tab]

- GET /audit returns the 50 most recent commits to the storefront repo

  (sha, author, date, message). Render as a table with GitHub links. This is

  the security trail — every change is a commit.

SECURITY: The app must never log or display tokens/secrets. Every API call

must include Authorization: Bearer <token>. Never store the API token or admin

email in the frontend source — use VITE_API_BASE_URL and VITE_ADMIN_EMAIL.

Handle API errors gracefully with human-readable messages.

RESPONSIVE: side nav collapses to a top bar on mobile; forms stack; tables

scroll horizontally on small screens.

AT THE END: Before finishing, produce a complete implementation guide as a

single markdown document titled "CERTISME-ADMIN-IMPLEMENTATION-GUIDE.md" that

documents: (1) every file and component in the generated app and what it does,

(2) the full API contract the app expects (each endpoint, method, request body,

response shape, headers, error format), (3) every environment variable the app

needs, (4) the auth flow step by step, (5) how the deploy/publish flow works

end to end, (6) how to run the app locally, and (7) any assumptions or

unresolved items. Print this guide in full so the user can copy it.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9b4f77ee-1cda-40d1-87b7-639f42ea271f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
