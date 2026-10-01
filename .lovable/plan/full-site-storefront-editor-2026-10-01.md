# Full-site storefront editor

## Goal
Turn CertiSME Admin into the control centre for the entire visible storefront. The storefront will remain static and fast, but its pages will be generated from editable content saved to GitHub; each save remains auditable and triggers the existing GitHub → Cloudflare production flow.

## What you will be able to manage

- Add, rename, duplicate, reorder, publish/unpublish, and remove pages.
- Build each page from reorderable sections: hero, rich text, image, feature list, cards, product grid, framework grid, FAQ, call-to-action, contact, and custom embed.
- Add, edit, remove, and reorder header and footer navigation links, including external links.
- Edit every visible label and message: buttons, product-card wording, checkout labels, contact text, footer/legal text, empty states, and the 404 page.
- Edit guides and template landing pages, including introductions, sections, FAQs, related products, and calls to action.
- Manage branding: logo, favicon, colours, fonts, spacing density, corner style, and reusable button styles.
- Upload and choose page imagery and other public assets, with previews and alt text.
- Manage page SEO: URL slug, browser title, description, sharing image, indexing setting, and canonical URL.
- Preview desktop and mobile before saving, with drafts clearly separated from the live version.
- View the GitHub commit created by every save and restore an earlier content revision.

## Admin experience

1. Add a **Site Builder** area with Pages, Navigation, Branding, Media, and Global Content views.
2. Build a page editor with a page list, section outline, selected-section form, reorder controls, and live preview.
3. Use structured controls instead of exposing source code for normal editing; include an advanced custom HTML section for exceptional content.
4. Add unsaved-change warnings, validation, delete confirmations, loading/error states, and clear save/publish status.
5. Keep Products, Frameworks, Documents, Images, Settings, Deploy, and Audit available, linking related records into the page editor.

## Storefront changes

- Move hardcoded navigation, hero copy, homepage sections, document-packs page copy, FAQ, contact, footer, 404 copy, guide content, template-page content, and visible commerce labels into a versioned content file in the storefront repository.
- Extend the storefront generator to render the new page/section model while preserving products, checkout, download delivery, structured data, sitemap, redirects, and Cloudflare security headers.
- Generate navigation, footer, metadata, sitemap entries, redirects, guide pages, template pages, and new custom pages from the same content model.
- Keep safe defaults and migrate every piece of existing site content so the storefront looks unchanged immediately after migration.

## Saving, preview, and publishing

- Draft edits are stored in a separate draft file in GitHub and do not affect production.
- **Save draft** commits only the draft content.
- **Publish** validates the complete site, promotes the draft to live content, creates a GitHub commit, and triggers the existing Cloudflare workflow.
- Preview renders from the draft model inside the admin without exposing repository credentials.
- Restore creates a new commit from a selected earlier version rather than rewriting Git history.

## Protected areas

The visible site is fully editable, but credentials, payment signatures, authentication, delivery controls, Cloudflare security headers, and executable server code remain unavailable in the visual editor. This prevents an accidental text or layout change from disabling payments or exposing customer files. Payment status and public checkout wording remain manageable; secret values never appear in the browser.

## Technical implementation

- Define and validate a versioned `site-content.yaml` schema covering theme, navigation, globals, pages, sections, guides, and template landing pages.
- Add migration logic that converts current hardcoded content into the initial schema without losing text or URLs.
- Add authenticated server functions for content CRUD, page/section ordering, media uploads, draft preview data, validation, publish, and revision restore.
- Use GitHub file SHAs for conflict detection and grouped commits so one editor save produces one coherent revision.
- Refactor the storefront builder to consume the schema and HTML-escape user content; sanitize custom HTML using a strict allowlist.
- Preserve existing `catalog.yaml` product/framework/payment data and reference those records by stable IDs from page sections.
- Add reusable admin forms for text arrays, links, SEO, colours, asset selection, section settings, and reorder actions.
- Update the implementation guide and operational documentation to describe the new content model and recovery flow.

## Validation

- Verify migrated output against the current storefront before enabling edits.
- Test page and section add/edit/remove/reorder flows, navigation, branding, media, guides, templates, SEO, drafts, publish, and restore.
- Confirm generated links, sitemap, metadata, checkout forms, downloads, and deployment status remain correct.
- Check desktop and mobile admin layouts plus desktop and mobile storefront previews.
- Perform a non-destructive draft save first; production publication remains a deliberate confirmed action.

## Delivery order

1. Content schema and lossless migration.
2. Storefront generator support and output comparison.
3. Admin Site Builder, global content, navigation, branding, media, and SEO.
4. Draft preview, validation, publishing, and revision restore.
5. End-to-end verification and updated documentation.
