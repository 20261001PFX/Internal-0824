# PFX Internal

Internal tools for PFX. Sign-in is through Supabase, and only emails on the team list can see drafts or change anything. No secrets are stored in this repo.

- `index.html`, `website.js`: the site
- `supabase/setup.sql`: run once in the Supabase SQL Editor
- `supabase/blog-seo.sql`: adds blog alt text and SEO fields; run after `setup.sql`
- `supabase/functions/publish-site`: rebuilds poweredbypfx.com when website text is published
- `content-schema.json`: backup copy of the editable fields; the live copy comes from the website

Hosting: GitHub Pages, Settings → Pages → Deploy from a branch → `main`, `/ (root)`.
