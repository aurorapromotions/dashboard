# Aurora Promotions Dashboard

Internal web dashboard ("mini ERP") for Aurora Promotions, a promotional products business. Private links (original Google Sheet, old claude.ai artifact) are in `CLAUDE.local.md`, which is not committed. The owner is not technical: explain in plain language, do the technical work for them.

- Live: https://aurorapromotions.github.io/sales-navigator/ (GitHub Pages, `main` branch, `/docs` folder). Planned rename of the repo to `dashboard` → `/dashboard/` (needs the user's OK). Later the user may move hosting to their own server (aurorapromotions.ca, e.g. `dashboard.aurorapromotions.ca`); the site is static files, so it can be copied as-is.
- Data and logins: Firebase project `sales-navigator-1b716` (Spark/free plan, Firestore in northamerica-northeast2). Google sign-in enabled; `aurorapromotions.github.io` is an authorized domain. Public web config is in `docs/firebase-config.js` (not secret).
- No Node/Python on this machine; no build step. Plain HTML/JS/CSS, Firebase compat SDK 10.14.1 from gstatic.

## Roadmap (agreed with the user, 2026-10-02)

1. **Foundation** (done in code; see status below): one sign-in, Team & Access page, Sales Navigator moved in.
2. **Sales Navigator upgrades:** Customers report (per client company and per contact: sales, orders, gross/net profit, avg order, last order, charts); every dropdown editable in Settings (priorities, acquisition channels, categories, decoration methods, shipping companies, payment platforms, statuses: "Quote" and "Cancelled" can be renamed, not deleted, since totals/refunds depend on them); fix days order→delivery (currently averaged per product line; should be per order, order date → last line's delivery date).
3. **Projects:** admins/leads create projects and tasks, assign people, due dates, statuses (To do/In progress/Review/Done), comments, board + list + My tasks.
4. **Leads (manual first):** lead list, assign to reps, draft → rep reviews → send, follow-up reminder every 2 days with no reply until the rep turns follow-ups off.
5. **Connector + GoHighLevel:** a free Cloudflare Worker receives GHL webhooks (FB/Google leads) and sends approved emails/SMS via the GHL API; scheduled follow-up checks. Secrets (GHL key) live in the Worker, never in the site.
6. **Order Acceptance + invoices:** client gets a private link with order summary + Terms & Conditions (editable, versioned) + Stripe/Square invoice; "I accept" + typed name stored with time and T&C version; payment webhook marks the order paid.
7. **Claude drafts** for lead emails/follow-ups (user's Anthropic account, pay per use).

Open questions still to ask: projects tied to client orders or internal? reminders in-app only or also email/SMS? GHL lead stages? Stripe vs Square, send via GHL or company email, PDF of acceptance? currency CAD? retire the claude.ai version?

## Access model

People are `members/{lowercase email}`: `{name, email, role: "admin"|"member", active, loginType: "google"|"password", uid?, access: {sales|leads|acceptance|projects: "limited"|"full"}}`.

- **Main admin:** `ihsan@aurorapromotions.ca` (Google). Always admin; can't be demoted or switched off; their doc is auto-created on first sign-in.
- **Admin:** every tool at full, plus the Team & Access page; can add other admins and members.
- **Team lead:** a member with `full` on one or more tools (e.g. sales lead: sees/edits/deletes all orders, Sales settings).
- **Member / rep:** `limited` = only their own records, add and edit, never delete, no tool settings. In Sales Navigator "own" means `salesRep == member.name`, so a person's name is their rep name (Team page renames their orders when the name changes, and adds sales people to `settings/config.reps`).
- **Logins:** Google (for @aurorapromotions.ca or any Google account) or email & password (admin adds them; `APP.createPasswordLogin` makes the account through a second Firebase app instance so the admin stays signed in, stores its `uid` on the member, and sends a set-your-password email). Rules accept a password login only if its uid matches the member doc. Members are never deleted, only switched off (keeps uid and history).
- **Enforcement:** `firestore.rules` (published in the Firebase console; keep in sync). The pages only hide what rules already forbid.

## Files

| Path | What it is |
|---|---|
| `docs/index.html` | Home: tool tiles for what the viewer can use; Team tile for admins. |
| `docs/assets/core.js` | Shared by every page: Firebase init, sign-in screen (Google + email/password + reset), member lookup, access levels (`APP.level(tool)`), top bar, `window.claude` adapter. Tool list `TOOLS` lives here (set `ready:true` when a tool ships). Demo mode on localhost. |
| `docs/assets/core.css` | Shared tokens (light/dark), top bar, sign-in card, tiles, buttons. |
| `docs/team/index.html` | Team & Access (admins only): add/edit people, login type, role, per-tool access, on/off, send password email. |
| `docs/sales/index.html` | Sales Navigator (originally the claude.ai artifact; still calls `window.claude.use("db"|"downloads")`, which core.js provides). Reads `APP.level("sales")`: limited users get a `where("salesRep","==",name)` query, a locked rep field, no delete/import/settings/sample removal. |
| `docs/assets/example-orders.json` | 55 example lines / 34 orders (`sample: true`), for demo mode only. Made by `tools/make-examples.ps1`. |
| `firestore.rules` | Security rules (see Access model). |
| `tools/serve.ps1` | Local static server; `.claude/launch.json` runs it on port 8091. |
| `archive/claude-artifact-sales-navigator.html` | The old claude.ai version, for reference only. |

**Test locally:** run the `sales-navigator` launch config, open http://localhost:8091/docs/?demo=admin (or `demo=lead`, `demo=rep`; `demo=off` to leave). Demo mode uses browser storage and fake people (Ihsan admin, "Sam (sales lead)" full sales, "Rep 1" limited sales); add `?seed=1` on the Sales page to load example orders, `?reset=1` to wipe. Demo mode only exists on localhost and never touches Firebase. Rules can't be tested locally; review them carefully.

**Publish:** commit and push to `main`; GitHub Pages rebuilds in about a minute. If rules changed, publish them in the Firebase console **before** pushing pages that depend on them.

## Sales Navigator details

- `orders/{id}`: one doc per **product line**; lines sharing an Order # are one order (`orderKey` = upper-trimmed Order #). Order-level fields (`order:true` in the `F` field list) are copied to sibling lines on save.
- Order numbers: `counters/orders.next`, taken in a transaction on save (`assignOrderNumber`), never lower than the highest visible `ORD-####` + 1, so reps who can't see each other's orders never collide.
- `settings/config`: `reps[]`, `supplierTaxPct`, `customerTaxPct`, `platformFeePct`, `feeOn` ("card"/"all"), `deductCustomerTax`, `countStatuses[]`.
- Statuses: Quote, Pending, Ordered, In Production, Shipped, Delivered, Cancelled. Totals count all but Quote and Cancelled (configurable).
- CSV import/export by column label or alias (`al`); import finds the header row under title rows.

Formulas (`calc(o)`):
```
q            = Number of items
base         = (unitCost + unitRunCharges) × q + setupCost + shippingCost + otherCosts
costPerUnit  = base / q
supplierTax  = base × supplierTaxPct%                  // not recoverable; part of total cost
subtotal     = customerUnitPrice × q
customerTax  = subtotal × customerTaxPct%
totalPrice   = subtotal + customerTax                   // "Total sales" includes customer tax
platformFee  = "$" ? value : totalPrice × value%        // blank % → settings pct on card platforms
refund       = status == "Cancelled" ? refundFee : 0
totalCost    = base + supplierTax + refund              // no commission, no platform fee
grossProfit  = totalPrice − totalCost
commission   = commissionValue ($, entered per line)
taxAdj       = deductCustomerTax ? customerTax : 0
netProfit    = grossProfit − commission − platformFee − taxAdj
```

## Status (2026-10-02)

- Phase 1 code is done and tested in demo mode as admin, sales lead and rep. **Not yet live.** Before pushing: (1) publish the new `firestore.rules` in the Firebase console, (2) enable Email/Password sign-in (Authentication → Sign-in method), (3) set the public-facing project name to "Aurora Promotions Dashboard" (it appears in password emails). The browser's Google session for the Firebase console had expired; the user must sign in themselves.
- The repo rename to `dashboard` was blocked pending the user's explicit OK.
- The session's files never got copied to `C:\Users\Dell\Desktop\Sales Navigator` (still empty); clone the repo there.
