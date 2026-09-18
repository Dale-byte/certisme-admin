# CertiSME Admin

Single-user admin dashboard for the CertiSME static storefront. Products, frameworks,
documents, images and site settings are edited here and committed straight to the
`Dale-byte/CertiSME` GitHub repository (branch `main`) through this project's GitHub
connection. GitHub Actions rebuilds the site and Cloudflare serves it.

Sign in with the administrator username and password stored securely in the project;
sessions last 24 hours. The browser never holds a secret and there is no separate API to
deploy.

```bash
bun install
bun run dev      # http://localhost:8080
```

Full documentation: [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md).
