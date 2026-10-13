# Postman API Collection Guide

This repository includes a comprehensive, ready-to-import Postman Collection covering all endpoints for **Article Management System** and external integrations (such as **SupplementScience / External Blog Integration**).

---

## 📁 Included Files

1. [`postman_collection.json`](file:///home/khadka27/dishant/article_management/postman_collection.json): Full Postman Collection v2.1.0 with 50+ organized endpoints across 14 categories.
2. [`postman_environment.json`](file:///home/khadka27/dishant/article_management/postman_environment.json): Pre-configured environment file with local server variables (`baseUrl`, `serviceToken`, `slug`, `id`).

---

## 🚀 How to Import into Postman

1. Open **Postman**.
2. Click **Import** (top left).
3. Drag & drop or select both:
   - `postman_collection.json`
   - `postman_environment.json`
4. In the top-right environment selector in Postman, choose **"Article Management - Local Environment"**.

---

## 🔑 Authentication Guide

### 1. Web App Session Authentication (Cookie-Based)
Most `/api/*` endpoints in Article Management require an authenticated session (`next-auth.session-token`).

- **Option A (Browser Cookie Interceptor)**:
  1. Open your browser and log into `http://localhost:3000`.
  2. Enable Postman Interceptor or Postman Desktop Agent to capture cookies automatically.
- **Option B (Dev Switch Role Endpoint)**:
  - Call `POST /api/dev/switch-role` with `{ "role": "ADMIN" }` or `{ "role": "TEAM_LEAD" }` to switch roles on the fly during local testing.

### 2. Service Token Authentication (M2M / External Blog)
For endpoints under **14. SupplementScience / External Blog Integration**:
- Set the `serviceToken` environment variable in Postman to your valid service token.
- Postman sends this token automatically in headers via `Authorization: Bearer {{serviceToken}}` or in request bodies where required.

---

## 🗂️ Collection Structure

| Folder | Category | Description |
|---|---|---|
| **1** | **Authentication & Session** | Session validation and role switching utilities |
| **2** | **Articles** | Full article lifecycle: listing, creation, updating status/links/timer, deletion |
| **3** | **Reviews & Approvals** | Team Lead approvals, redo requests with feedback, and special edit requests |
| **4** | **Products & Catalog** | Product catalog, bulk imports, site availability, duplicate checks, comparisons |
| **5** | **Trendmap Opportunities** | Researched trend opportunities, demand scores, and competitor links |
| **6** | **Links & Affiliate Networks** | Multi-geo affiliate link logs, audit history, affiliate networks & stats |
| **7** | **Sites, Categories & Geos** | Multi-site network management, categories, and country geo targets |
| **8** | **Work Calendar & Activity Logs** | User monthly work calendar (NPT UTC+5:45) and system audit trails |
| **9** | **Dashboard & Reports** | Aggregated dashboard metrics and monthly production reports |
| **10** | **Commissions & Payouts** | User commission tracking, payout execution, and pricing models |
| **11** | **Notices & Notifications** | Role-targeted announcements, acknowledgment workflow, and user alerts |
| **12** | **Users & Team Access** | User administration, approval status, and per-site permissions |
| **13** | **Backups & System Settings** | Google Drive automated snapshots, manual dumps, restores, and settings |
| **14** | **SupplementScience / Blog** | External blog publishing, post management, and service token verification |

---

## 📝 Common Endpoints Quick Reference

### Articles & Reviews
- `GET /api/articles?status=PENDING`
- `PATCH /api/articles/:slug` (Update article status, link, writing time)
- `POST /api/reviews` (Submit review approval or redo with feedback)
- `POST /api/approvals` (Approve/reject special article edit requests)

### Products
- `GET /api/products?search=Nutricost`
- `POST /api/products` (Create and distribute product)
- `GET /api/products/:id/site-availability` (Network sites publication status)

### Calendar
- `GET /api/calendar?userId=1&month=2026-10` (Monthly activities in Nepal Time UTC+5:45)

### External Blog Integration
- `POST /api/service/verify` (Check service token validity)
- `POST /api/blog/posts` (Publish post to external blog)
- `GET /api/admin/posts/:id` (Admin post retrieval)
