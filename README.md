# Sales Navigator

Sales dashboard and order log for a promotional products business: sales by year, month and rep, orders counted by Order #, gross and net profit.

- **App:** https://aurorapromotions.github.io/sales-navigator/
- Orders are stored in Google Firebase (Firestore). Only Google accounts listed in the Firestore security rules can sign in and see data.
- The page itself (`docs/`) is plain HTML/JS with no build step. See `CLAUDE.md` for the data model, formulas and how to rebuild.
