const fs = require("fs");
const path = require("path");

const baseUrl = "{{baseUrl}}";

function createRequest(name, method, endpoint, description, body = null, query = []) {
  const urlParts = endpoint.split("?")[0].replace(/^\//, "").split("/");
  const urlPath = urlParts.map((part) => (part.startsWith(":") ? `{{${part.slice(1)}}}` : part));

  const queryParams = query.map((q) => ({
    key: q.key,
    value: q.value,
    description: q.description || "",
    disabled: q.disabled || false,
  }));

  const req = {
    name,
    request: {
      method,
      header: [
        {
          key: "Content-Type",
          value: "application/json",
          type: "text",
        },
        {
          key: "Authorization",
          value: "Bearer {{serviceToken}}",
          type: "text",
          description: "Used for service-token protected routes",
          disabled: true,
        },
      ],
      url: {
        raw: `${baseUrl}${endpoint}`,
        host: ["{{baseUrl}}"],
        path: urlParts,
        query: queryParams.length > 0 ? queryParams : undefined,
      },
      description,
    },
  };

  if (body) {
    req.request.body = {
      mode: "raw",
      raw: JSON.stringify(body, null, 2),
      options: {
        raw: {
          language: "json",
        },
      },
    };
  }

  return req;
}

const collection = {
  info: {
    _postman_id: "article-management-all-apis-v1",
    name: "Article Management System - Complete API Collection",
    description:
      "Comprehensive Postman collection covering all REST API endpoints of Article Management System and External Blog / SupplementScience integrations.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  item: [
    {
      name: "1. Authentication & Session",
      item: [
        createRequest(
          "Get Current Session",
          "GET",
          "/api/auth/session",
          "Returns the currently logged in user session information."
        ),
        createRequest(
          "Dev - Switch User Role",
          "POST",
          "/api/dev/switch-role",
          "Development-only utility to switch active session role without re-logging in.",
          { role: "ADMIN" }
        ),
      ],
    },
    {
      name: "2. Articles",
      item: [
        createRequest(
          "List Articles",
          "GET",
          "/api/articles",
          "Fetch articles filtered by writerId, status, or productId.",
          null,
          [
            { key: "status", value: "PENDING", description: "PENDING | IN_PROGRESS | COMPLETED | APPROVED | REDO" },
            { key: "writerId", value: "1", description: "Filter by assigned writer ID", disabled: true },
            { key: "productId", value: "2036", description: "Filter by product ID", disabled: true },
          ]
        ),
        createRequest(
          "Get Article by Slug / ID",
          "GET",
          "/api/articles/:slug",
          "Retrieve article details by product slug or article ID."
        ),
        createRequest(
          "Update Article (Status / Link / Timer / Review)",
          "PATCH",
          "/api/articles/:slug",
          "Update article status, link, writing time, or request special edit approval.",
          {
            status: "COMPLETED",
            articleLink: "https://dailyhealthsupplement.com/nutricost-review",
            writingTimeMin: 45,
            notes: "Article completed and ready for review",
          }
        ),
        createRequest(
          "Delete Article",
          "DELETE",
          "/api/articles/:slug",
          "Delete an article record."
        ),
      ],
    },
    {
      name: "3. Reviews & Approvals",
      item: [
        createRequest(
          "Submit Article Review (Approve / Request Redo)",
          "POST",
          "/api/reviews",
          "Team Lead or Admin reviews an article to approve or request changes/redo with suggestions.",
          {
            articleId: 1942,
            reviewedById: 1,
            suggestion: "Please refine the introduction and check dosage recommendations.",
            approved: false,
            priority: "HIGH",
          }
        ),
        createRequest(
          "List Special Approval Requests",
          "GET",
          "/api/approvals",
          "Fetch pending edit requests on previously approved articles."
        ),
        createRequest(
          "Process Approval Request (Approve / Reject)",
          "POST",
          "/api/approvals",
          "Team Lead or Admin approves or rejects an edit request on an approved article.",
          {
            articleId: 1942,
            action: "APPROVE",
            reason: "Granted permission to update affiliate links.",
          }
        ),
      ],
    },
    {
      name: "4. Products & Catalog",
      item: [
        createRequest(
          "List Products",
          "GET",
          "/api/products",
          "Fetch catalog products with filtering options.",
          null,
          [
            { key: "search", value: "Nutricost", description: "Search by product name or slug", disabled: true },
            { key: "siteId", value: "1", description: "Filter by site ID", disabled: true },
            { key: "categoryId", value: "1", description: "Filter by category ID", disabled: true },
          ]
        ),
        createRequest(
          "Create Product",
          "POST",
          "/api/products",
          "Create a new product and assign it to sites/writers.",
          {
            name: "Nutricost Creatine Monohydrate",
            productCategory: "Supplements",
            source: "Competitor",
            previewLink: "https://getsupplementreviews.com/nutricost-creatine",
            trendLink: "",
            trendLevel: "HIGH",
            remarks: "High demand product researched from Trendmap.",
            distributeToAllSites: false,
            singleSiteId: 1,
            createArticle: true,
          }
        ),
        createRequest(
          "Get Product by ID",
          "GET",
          "/api/products/:id",
          "Retrieve single product details."
        ),
        createRequest(
          "Update Product",
          "PATCH",
          "/api/products/:id",
          "Update existing product properties.",
          {
            name: "Nutricost Creatine Monohydrate Pure",
            previewLink: "https://example.com/product",
            trendLink: "https://trends.google.com/trends/explore?q=nutricost",
            remarks: "Updated product specs and instructions.",
          }
        ),
        createRequest(
          "Delete Product",
          "DELETE",
          "/api/products/:id",
          "Delete a product from catalog."
        ),
        createRequest(
          "Check Duplicate Product",
          "POST",
          "/api/products/check",
          "Check if a product name or slug already exists.",
          { name: "Nutricost" }
        ),
        createRequest(
          "Import Bulk Products",
          "POST",
          "/api/products/import",
          "Import multiple products in bulk.",
          {
            products: [
              {
                name: "Product A",
                category: "Supplements",
                previewLink: "https://example.com/a",
              },
              {
                name: "Product B",
                category: "Vitamins",
                previewLink: "https://example.com/b",
              },
            ],
            targetSiteIds: [1, 2],
          }
        ),
        createRequest(
          "Get Product Site Availability",
          "GET",
          "/api/products/:id/site-availability",
          "List all network sites showing whether product is published, pending, or missing."
        ),
        createRequest(
          "Report Link Issue",
          "POST",
          "/api/products/:id/report-link-issue",
          "Report a broken or expired affiliate link on a product.",
          {
            linkId: 10,
            issueType: "BROKEN_LINK",
            notes: "The buy link redirects to 404.",
          }
        ),
        createRequest(
          "Site Product Comparison",
          "GET",
          "/api/products/compare",
          "Fetch product distribution comparison across all network sites."
        ),
        createRequest(
          "Add Product to Comparison Network",
          "POST",
          "/api/products/compare/add",
          "Deploy existing product to an additional network site.",
          {
            productId: 2036,
            siteId: 2,
          }
        ),
      ],
    },
    {
      name: "5. Trendmap Opportunities",
      item: [
        createRequest(
          "List Trendmap Products",
          "GET",
          "/api/trendmap-products",
          "Fetch researched product trend opportunities."
        ),
        createRequest(
          "Create Trendmap Opportunity",
          "POST",
          "/api/trendmap-products",
          "Add a new product opportunity discovered via trend analysis.",
          {
            name: "Tongkat Ali Extract",
            category: "Herbal Supplements",
            productUrl: "https://competitor.com/tongkat-ali",
            competitor: "competitor.com",
            demandScore: 85,
            demandLevel: "HIGH",
            searchDemand: "85 / 100",
          }
        ),
        createRequest(
          "Get Trendmap Product",
          "GET",
          "/api/trendmap-products/:id",
          "Get details of a specific trend opportunity."
        ),
        createRequest(
          "Update Trendmap Product",
          "PATCH",
          "/api/trendmap-products/:id",
          "Update a trend opportunity.",
          {
            demandLevel: "HIGH",
            demandScore: 92,
          }
        ),
        createRequest(
          "Delete Trendmap Product",
          "DELETE",
          "/api/trendmap-products/:id",
          "Delete a trend opportunity."
        ),
        createRequest(
          "Check Duplicate Trendmap Product",
          "POST",
          "/api/trendmap-products/check-duplicate",
          "Check whether an opportunity name already exists.",
          { name: "Tongkat Ali" }
        ),
        createRequest(
          "Batch Import / Modify Trendmap Products",
          "POST",
          "/api/trendmap-products/batch",
          "Batch create or update opportunities.",
          {
            items: [
              { name: "Item 1", category: "Supplements", productUrl: "https://example.com/1" },
            ],
          }
        ),
      ],
    },
    {
      name: "6. Links & Affiliate Networks",
      item: [
        createRequest(
          "List Link Logs",
          "GET",
          "/api/links",
          "Fetch affiliate link logs.",
          null,
          [{ key: "productId", value: "2036", description: "Filter by product ID", disabled: true }]
        ),
        createRequest(
          "Create Link Log",
          "POST",
          "/api/links",
          "Add an affiliate link record for a product.",
          {
            productId: 2036,
            affiliateName: "BuyGoods",
            affiliateLink: "https://hop.buygoods.com/track/123",
            buyLink: "https://secure.buygoods.com/checkout/123",
            bridgePageLink: "https://dailyhealthsupplement.com/nutricost-presell",
            status: "ACCEPTED",
            geos: ["US", "CA", "UK", "AU"],
            linkerRemarks: "Configured multi-geo routing",
          }
        ),
        createRequest(
          "Get Link Log",
          "GET",
          "/api/links/:id",
          "Get single link log."
        ),
        createRequest(
          "Update Link Log",
          "PATCH",
          "/api/links/:id",
          "Update link log fields and geos.",
          {
            status: "ACCEPTED",
            affiliateLink: "https://hop.buygoods.com/track/new",
            linkerRemarks: "Updated tracking parameters",
          }
        ),
        createRequest(
          "Delete Link Log",
          "DELETE",
          "/api/links/:id",
          "Delete a link log."
        ),
        createRequest(
          "Get Link Audit History",
          "GET",
          "/api/links/:id/history",
          "Fetch the version audit history of a link log."
        ),
        createRequest(
          "List Affiliate Networks",
          "GET",
          "/api/affiliates",
          "List all affiliate networks (e.g. ClickBank, BuyGoods, Digistore)."
        ),
        createRequest(
          "Create Affiliate Network",
          "POST",
          "/api/affiliates",
          "Add a new affiliate network.",
          {
            name: "ClickBank",
            url: "https://clickbank.com",
            description: "Digital and physical health products",
          }
        ),
        createRequest(
          "Get Affiliate Network Stats",
          "GET",
          "/api/affiliates/stats",
          "Get link usage statistics grouped by affiliate network."
        ),
      ],
    },
    {
      name: "7. Sites, Categories & Geos",
      item: [
        createRequest(
          "List Network Sites",
          "GET",
          "/api/sites",
          "List all published websites in the network."
        ),
        createRequest(
          "Create Network Site",
          "POST",
          "/api/sites",
          "Add a new network website.",
          {
            name: "Daily Health Supplement",
            url: "https://dailyhealthsupplement.com",
            allowCountrySpecific: true,
          }
        ),
        createRequest(
          "Get Site by ID",
          "GET",
          "/api/sites/:id",
          "Get details for a specific site."
        ),
        createRequest(
          "Update Site",
          "PATCH",
          "/api/sites/:id",
          "Update site details.",
          {
            name: "Daily Health Supplement Pro",
            allowCountrySpecific: true,
          }
        ),
        createRequest(
          "Get Site Categories",
          "GET",
          "/api/sites/:id/categories",
          "Get categories associated with a website."
        ),
        createRequest(
          "List Article Categories",
          "GET",
          "/api/categories",
          "List general article categories."
        ),
        createRequest(
          "Create Article Category",
          "POST",
          "/api/categories",
          "Create an article category.",
          { name: "Supplements", siteId: 1 }
        ),
        createRequest(
          "List Product Categories",
          "GET",
          "/api/product-categories",
          "List product categories."
        ),
        createRequest(
          "Create Product Category",
          "POST",
          "/api/product-categories",
          "Create a product category.",
          { name: "Daily Health Supplement" }
        ),
        createRequest(
          "List Geos (Country Targets)",
          "GET",
          "/api/geos",
          "List available country codes for geo targeting."
        ),
        createRequest(
          "Create Geo",
          "POST",
          "/api/geos",
          "Add a country geo target.",
          { code: "DE", name: "Germany" }
        ),
      ],
    },
    {
      name: "8. Work Calendar & Activity Logs",
      item: [
        createRequest(
          "Get User Work Calendar",
          "GET",
          "/api/calendar",
          "Fetch monthly calendar with completed articles, reviews, links actioned, and daily timelines in NPT.",
          null,
          [
            { key: "userId", value: "1", description: "Target user ID (defaults to current user)", disabled: false },
            { key: "month", value: "2026-10", description: "Month in YYYY-MM format", disabled: false },
          ]
        ),
        createRequest(
          "Get System Activity History",
          "GET",
          "/api/history",
          "Fetch system audit trail of status changes, reviews, and edits."
        ),
      ],
    },
    {
      name: "9. Dashboard & Reports",
      item: [
        createRequest(
          "Get Dashboard Metrics",
          "GET",
          "/api/dashboard",
          "Fetch role-specific dashboard metrics, pending tasks, and summary counts."
        ),
        createRequest(
          "Get Reports & Performance",
          "GET",
          "/api/reports",
          "Fetch monthly production reports across writers, linkers, and sites.",
          null,
          [
            { key: "siteId", value: "1", description: "Filter by site ID", disabled: true },
            { key: "month", value: "2026-10", description: "Month in YYYY-MM format", disabled: true },
          ]
        ),
      ],
    },
    {
      name: "10. Commissions & Payouts",
      item: [
        createRequest(
          "List Commission Records",
          "GET",
          "/api/commissions",
          "List user commissions for articles and links.",
          null,
          [
            { key: "month", value: "10", description: "Month (1-12)", disabled: true },
            { key: "year", value: "2026", description: "Year (e.g. 2026)", disabled: true },
            { key: "userId", value: "1", description: "User ID", disabled: true },
          ]
        ),
        createRequest(
          "Create / Update Commission Entry",
          "POST",
          "/api/commissions",
          "Manually record or adjust a commission item.",
          {
            userId: 2,
            type: "ARTICLE",
            amount: 50.0,
            month: 10,
            year: 2026,
            notes: "Bonus for high priority article",
          }
        ),
        createRequest(
          "User Commissions Summary",
          "GET",
          "/api/commissions/users",
          "List cumulative commission totals and unpaid balances by user."
        ),
        createRequest(
          "Execute Payout",
          "POST",
          "/api/commissions/users/payout",
          "Mark accumulated user commissions as paid.",
          {
            userId: 2,
            amount: 150.0,
            paymentMethod: "Bank Transfer",
            reference: "PAY-OCT-2026-001",
          }
        ),
        createRequest(
          "Get Commission Settings",
          "GET",
          "/api/commission-settings",
          "Fetch standard commission rates per article, link, and priority tiers."
        ),
        createRequest(
          "Update Commission Settings",
          "POST",
          "/api/commission-settings",
          "Update commission pricing models.",
          {
            standardArticleRate: 20.0,
            standardLinkRate: 10.0,
            highPriorityBonus: 5.0,
          }
        ),
        createRequest(
          "Reset Commission Settings",
          "POST",
          "/api/commission-settings/reset",
          "Reset commission settings to default company values."
        ),
      ],
    },
    {
      name: "11. Notices & Notifications",
      item: [
        createRequest(
          "List Notices",
          "GET",
          "/api/notices",
          "List company announcements and team notices."
        ),
        createRequest(
          "Create Notice",
          "POST",
          "/api/notices",
          "Post a new team notice with category and role targeting.",
          {
            title: "Article Guidelines Update",
            content: "Please ensure all newly submitted articles include comprehensive ingredient breakdowns.",
            category: "IMPORTANT",
            targetRoles: ["WRITER", "TEAM_LEAD"],
          }
        ),
        createRequest(
          "Get Pending Unread Notices",
          "GET",
          "/api/notices/pending",
          "Fetch notices requiring user acknowledgment before proceeding."
        ),
        createRequest(
          "Acknowledge Notice",
          "POST",
          "/api/notices/:id/ack",
          "Mark a mandatory notice as read and acknowledged."
        ),
        createRequest(
          "List User Notifications",
          "GET",
          "/api/notifications",
          "Fetch real-time notifications for current user (mentions, redo alerts, approval alerts)."
        ),
      ],
    },
    {
      name: "12. Users & Team Access",
      item: [
        createRequest(
          "List Users",
          "GET",
          "/api/users",
          "List all team members, writers, linkers, and admins."
        ),
        createRequest(
          "Update User Role / Approval",
          "PATCH",
          "/api/users/:id",
          "Update user role, approval status, team lead assignment, or active status.",
          {
            role: "WRITER",
            approved: true,
            teamLeadId: 1,
            allowLinkLogAccess: false,
          }
        ),
        createRequest(
          "Get User Site Access",
          "GET",
          "/api/users/:id/access",
          "Get site-specific permissions assigned to a writer or linker."
        ),
        createRequest(
          "Update User Site Access",
          "POST",
          "/api/users/:id/access",
          "Assign permitted sites to a user.",
          {
            siteIds: [1, 2, 3],
          }
        ),
        createRequest(
          "List Team Members",
          "GET",
          "/api/team-members",
          "Fetch members assigned under the logged in Team Lead."
        ),
      ],
    },
    {
      name: "13. Backups & System Settings",
      item: [
        createRequest(
          "Get Backup Status",
          "GET",
          "/api/backup/status",
          "Check Google Drive automated backup connection and latest snapshot timestamps."
        ),
        createRequest(
          "Run Manual Backup",
          "POST",
          "/api/backup/run",
          "Trigger immediate database dump and upload to Google Drive."
        ),
        createRequest(
          "Restore from Backup",
          "POST",
          "/api/backup/restore",
          "Restore database from a specific backup archive.",
          {
            backupFile: "backup-2026-10-13_00-00-00.sql.gz",
          }
        ),
        createRequest(
          "Test Backup Connection",
          "GET",
          "/api/backup/test",
          "Verify connectivity with Google Drive backup folder."
        ),
        createRequest(
          "Disconnect Google Drive Backup",
          "POST",
          "/api/backup/disconnect",
          "Remove Google Drive OAuth tokens."
        ),
        createRequest(
          "Get Application Settings",
          "GET",
          "/api/settings",
          "Fetch global application configuration."
        ),
        createRequest(
          "Update Application Settings",
          "PATCH",
          "/api/settings",
          "Update application settings.",
          {
            allowRegistration: true,
            defaultReviewerRole: "TEAM_LEAD",
          }
        ),
      ],
    },
    {
      name: "14. SupplementScience / External Blog Integration",
      item: [
        createRequest(
          "Verify Service Token",
          "POST",
          "/api/service/verify",
          "Verify machine-to-machine service token for external blog posting.",
          {
            token: "{{serviceToken}}",
          }
        ),
        createRequest(
          "List External Blog Posts",
          "GET",
          "/api/blog/posts",
          "Fetch published articles on external blog / SupplementScience.",
          null,
          [
            { key: "page", value: "1", description: "Page number" },
            { key: "limit", value: "10", description: "Items per page" },
            { key: "category", value: "Supplements", description: "Filter category", disabled: true },
          ]
        ),
        createRequest(
          "Publish Blog Post via Service Token",
          "POST",
          "/api/blog/posts",
          "Create and publish a blog post from Article Management System to external blog.",
          {
            title: "Nutricost Creatine Monohydrate In-Depth Review",
            slug: "nutricost-creatine-review",
            excerpt: "Comprehensive breakdown of Nutricost Creatine Monohydrate purity, dosage, and results.",
            content: "<h2>Overview</h2><p>Nutricost offers pure micronized creatine monohydrate...</p>",
            category: "Supplements",
            tags: ["Nutricost", "Creatine", "Health"],
            featuredImage: "https://example.com/nutricost-creatine.jpg",
            affiliateUrl: "https://hop.buygoods.com/track/123",
            published: true,
          }
        ),
        createRequest(
          "Get Admin Post by ID",
          "GET",
          "/api/admin/posts/:id",
          "Get external blog post by ID for administration."
        ),
        createRequest(
          "Update Admin Post",
          "PUT",
          "/api/admin/posts/:id",
          "Update an existing blog post on the external site.",
          {
            title: "Nutricost Creatine Monohydrate In-Depth Review (2026 Edition)",
            published: true,
          }
        ),
        createRequest(
          "Delete Admin Post",
          "DELETE",
          "/api/admin/posts/:id",
          "Delete a post from external blog."
        ),
      ],
    },
  ],
};

const environment = {
  id: "article-management-env-local",
  name: "Article Management - Local Environment",
  values: [
    {
      key: "baseUrl",
      value: "http://localhost:3000",
      type: "default",
      enabled: true,
    },
    {
      key: "serviceToken",
      value: "YOUR_SERVICE_TOKEN_HERE",
      type: "secret",
      enabled: true,
    },
    {
      key: "externalSiteUrl",
      value: "http://localhost:3001",
      type: "default",
      enabled: true,
    },
    {
      key: "slug",
      value: "nutricost",
      type: "default",
      enabled: true,
    },
    {
      key: "id",
      value: "1",
      type: "default",
      enabled: true,
    },
  ],
  _postman_variable_scope: "environment",
};

// Write files
const collectionPath = path.join(__dirname, "..", "postman_collection.json");
const envPath = path.join(__dirname, "..", "postman_environment.json");

fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2), "utf8");
fs.writeFileSync(envPath, JSON.stringify(environment, null, 2), "utf8");

console.log("Successfully generated:");
console.log("- " + collectionPath);
console.log("- " + envPath);
