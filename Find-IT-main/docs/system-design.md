# System Design — FIND IT

## 1. Architecture

FIND IT is a single localhost web application:

- **Browser UI:** static HTML, CSS, and JavaScript (`public/`)
- **HTTP API:** Node.js and Express (`src/server.js`)
- **Database:** SQLite file at `data/findit.db` (Node.js built-in `node:sqlite`)
- **Uploads:** item and profile images in `public/uploads/`

The browser talks to JSON endpoints under `/api`. Pages are routed with URL hashes (`#/post`, `#/profile`) so the demo stays on one origin.

```
Browser  →  Express static + REST  →  SQLite
                 ↓
            Disk uploads
```

## 2. Authorization

| Action | Guest | User | Admin |
| --- | --- | --- | --- |
| Browse home, FAQs, terms, item details | Yes | Yes | Yes |
| Register / log in | Yes | — | — |
| Post or edit own thread | No | Yes | Yes |
| Submit claim | No | Yes | Yes |
| Change item status | No | No | Yes |
| Approve / reject claims | No | No | Yes |
| View admin reports | No | No | Yes |

Sessions use `express-session` with an HTTP-only cookie.

## 3. Claim workflow

1. User A publishes a lost or found report (status: **reported**).
2. User B submits a claim with a written explanation.
3. Admin reviews the claim.
4. If approved, the item status becomes **claimed** and other pending claims on that item are rejected.
5. Admin may later mark the item **returned** or **closed**.

## 4. Security notes (academic localhost)

- Passwords: bcrypt (cost factor 12).
- SQL: parameterized statements only.
- Uploads: MIME type check and 5MB limit.
- Profile and thread edits are limited to the owner (or admin).

This is not a production internet deployment. The session secret is a local default and should be changed if the project is ever hosted.
