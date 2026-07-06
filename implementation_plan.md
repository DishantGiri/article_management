# Full Feature Implementation Plan

## Features from PRD
1. **Adding Product** — ✅ Done (Step 1-3 form)
2. **Writing Article** — Status workflow: PENDING → IN_PROGRESS → COMPLETED
3. **Adding Links** — Multi-link per product, multi-GEO, link status management
4. **Team Lead Review** — Approve articles, send notifications, special approvals

## Files to Create/Update

### Seed
- `prisma/seed.ts` — Users, Sites, Categories sample data

### API Routes
- UPDATE `api/products/route.ts` — auto-create Article on product creation
- NEW `api/articles/route.ts` — GET list
- NEW `api/articles/[id]/route.ts` — GET, PATCH (status, link)
- NEW `api/links/route.ts` — GET list, POST create
- NEW `api/links/[id]/route.ts` — PATCH link status
- NEW `api/dashboard/route.ts` — Stats counts
- NEW `api/reviews/route.ts` — POST review/suggestions
- NEW `api/approvals/route.ts` — POST special approval
- NEW `api/notifications/route.ts` — GET, PATCH

### UI Components
- `src/components/Sidebar.tsx` — Navigation sidebar
- UPDATE `src/app/layout.tsx` — Add sidebar layout
- UPDATE `src/app/globals.css` — Enhanced design system

### Pages
- UPDATE `src/app/page.tsx` — Dashboard with stats
- NEW `src/app/products/page.tsx` — Products list
- NEW `src/app/articles/page.tsx` — Articles list (writer view)
- NEW `src/app/articles/[id]/page.tsx` — Article detail + status management
- NEW `src/app/links/page.tsx` — Links management
- NEW `src/app/reviews/page.tsx` — Team Lead review panel
