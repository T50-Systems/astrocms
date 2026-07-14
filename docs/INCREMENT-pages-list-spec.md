# Increment (spec) — WordPress-style Pages list

Inspired by WordPress's "Pages" screen. Implemented **after** the Categories/Tags increment
to avoid conflicts in shared files (router, cms-server, cms-sdk, contracts).

## Backend

- **Search by title:** `entries.list` accepts `search?` (ILIKE over the current version's title).
- **Counters by status:** endpoint or field returning `{ all, draft, published, archived }` for the
  content type. Simple option: `GET /api/v1/pages/summary` → counts; or include `counts` in the list response.
- **Author:** the `Entry` contract adds `authorName` (join to `users.name`). Or an `author: { id, name }` summary.
- **Date:** `createdAt`/`updatedAt` already exist; show "Updated/Published" + local date/time.
- Keep the existing pagination and `status` filter.

## Frontend (apps/cms-admin/src/routes/pages-list.tsx)

WordPress-style layout within the shell:
- **Header:** "Pages" + "Add New" button + **search box** (input + submit) right-aligned.
- **Status filters** as links with a count: `All (N) · Published (N) · Drafts (N)` that
  change the filter (query param `status`).
- **Table** with columns: `[checkbox] · Title · Author · Date`. The title links to edit; below it,
  actions (Edit · Trash · if it's a builder page, "Edit visually").
- **Bulk actions:** per-row checkbox + "select all"; a "Bulk actions" select
  (Delete) + "Apply" button that deletes the selected rows (uses `cms.pages.remove`).
- Loading/error/empty states; accessible (labels, `scope` on th, aria).

## Out of scope (for now)
- Date filter ("All dates"): secondary.
- Page hierarchy (child pages): requires `parentId` on entries — future work.
- Comments column, Screen Options, Help.

## Verification
- `pnpm -r typecheck`; `pnpm --filter @astrocms/cms-server test` (search + counters test);
  `pnpm --filter @astrocms/cms-admin build`; browser check (search, filter by status,
  select and delete in bulk).
