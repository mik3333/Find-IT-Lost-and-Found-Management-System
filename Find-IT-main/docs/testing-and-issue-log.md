# Functional Testing and Issue Log — FIND IT

Test environment: Windows localhost, Chromium-based browser, `npm start` on port 3000.

| ID | Feature | Steps | Expected | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| T01 | Register | Create a new email/username/password | Account created and session starts | Pass after install | Password min 8 characters |
| T02 | Login reject | Wrong password | Error, no session | Pass | |
| T03 | Password storage | Inspect `users.password_hash` | bcrypt string, not plain text | Pass | `$2a$12$...` |
| T04 | Login admin | admin@findit.local | Admin nav link visible | Pass | |
| T05 | Post lost item | Fill form + image | Thread on home with thumbnail | Pass | |
| T06 | Post found item | Same with type Found | Badge shows found | Pass | |
| T07 | Filter category | Choose Bags | Only Bags cards | Pass | |
| T08 | Sort A–Z | Title A–Z | Alphabetical titles | Pass | |
| T09 | Sort latest | Latest upload | Newest `created_at` first | Pass | default |
| T10 | Profile username | Change public name | New name on posts | Pass | |
| T11 | Profile photo | Upload image | Avatar updates | Pass | |
| T12 | Change password | Old + new password | Can log in with new one | Pass | |
| T13 | Claim own item | Open own thread | No claim form | Pass | |
| T14 | Claim other item | Submit details | Pending claim stored | Pass | |
| T15 | Duplicate claim | Claim same item again | Rejected while pending | Pass | |
| T16 | Admin approve | Approve claim | Item status claimed | Pass | Other pending claims rejected |
| T17 | Admin status | Set returned / closed | Badge updates | Pass | |
| T18 | Guest navigation | Open Post while logged out | Login required | Pass | |
| T19 | FAQs / Terms | Open both links | Pages render | Pass | |
| T20 | Logout | Click Log out | Guest nav returns | Pass | |

## Issue log

| Issue | Severity | Status | Resolution |
| --- | --- | --- | --- |
| Native SQLite add-ons fail on some Windows PCs | Medium | Resolved | Use Node 22+ built-in `node:sqlite` so no C++ build tools are required |
| Session memory store resets on server restart | Low | Accepted | Localhost demo; log in again after restart |
| Hash routing does not produce pretty URLs | Low | Accepted | Fine for SPA demo |
| No automated SMS/email | N/A | Out of scope | Documented in charter |

Testers should add rows here during the November–December test window.
