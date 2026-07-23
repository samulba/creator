# Supabase workflow

Creator keeps Supabase schema changes in version-controlled migrations under `supabase/migrations`.

Recommended workflow:

1. Create or edit a timestamped SQL migration locally.
2. Review the SQL in Git, including RLS policies and security-definer functions.
3. If the Supabase CLI is available, run migrations against a local Supabase database with `supabase db reset`.
4. Regenerate database types with `npm run db:types` after applying migrations locally or set `SUPABASE_PROJECT_ID` to generate from a reviewed remote project.
5. Run `npm run lint`, `npm run typecheck`, and `npm run build` before opening a PR.
6. Apply reviewed migrations to staging/production through the controlled Supabase deployment workflow. Do not edit production tables manually in the dashboard.

This repository intentionally does not contain Supabase service-role credentials.
