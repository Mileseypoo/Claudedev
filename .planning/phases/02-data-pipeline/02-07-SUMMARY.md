---
plan: 02-07
phase: 02-data-pipeline
status: complete
wave: 4
---

# Plan 02-07 Summary — Deploy + Verification

## Completed
- Added OPENAI_API_KEY to Vercel environment variables
- Created vercel.json with 300s maxDuration for upload route
- Fixed: await params for Next.js 15 compatibility in DELETE route
- Fixed: empty sold_date converted to null before listings upsert (PostgreSQL date column rejects '')
- Added upload error display in admin portal UI (was silently swallowing errors)
- Added public/sample-listings.csv for testing

## Bugs Fixed During Verification
1. **Missing tenant row** — `tenants` table had no row for DEFAULT_TENANT_ID; all inserts failed with FK violation. Fixed by running seed SQL in Supabase.
2. **sold_date empty string** — PapaParse returns '' for blank optional columns; PostgreSQL date column rejects ''. Fixed by converting `row.sold_date || null` before upsert.
3. **Next.js 15 params** — Route handler params are now a Promise in Next.js 15+; fixed with `await params`.

## Verification (Human Confirmed)
- CSV upload → status Indexed, 5 listings indexed, stats correct ✓
- PDF upload → Processing immediately, transitioned to Indexed within 2 min ✓
- 5-second polling updated badge without page refresh ✓
- Delete upload removes row from list ✓
- Stats preview shows accurate counts ✓
