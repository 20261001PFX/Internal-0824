-- Adds alt text and SEO fields to blog posts. Run once, after setup.sql:
-- Supabase dashboard -> SQL Editor -> New query -> paste this file -> Run.
-- Safe to run again.
alter table public.posts
  add column if not exists image_alt text not null default '',
  add column if not exists seo_title text not null default '',
  add column if not exists seo_description text not null default '';

notify pgrst, 'reload schema';
