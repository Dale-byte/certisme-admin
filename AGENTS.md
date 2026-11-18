<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Storefront-wide edits use a versioned `tools/certisme/data/site-content.yaml`; drafts are separate from live content so ordinary saves cannot affect production.
- Product documents are read/written in Cloudflare R2 via the Cloudflare connector (repo.server.ts); GitHub holds only the catalog file path — why: R2 is where /download serves files from.
