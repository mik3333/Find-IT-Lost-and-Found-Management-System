# Database Design — FIND IT

Engine: **SQLite** via Node's built-in `node:sqlite` module. File: `data/findit.db`.

## users

| Column | Type | Notes |
| --- | --- | --- |
| id | INTEGER PK | Auto increment |
| email | TEXT UNIQUE | Lowercased login identity |
| password_hash | TEXT | bcrypt hash only |
| username | TEXT UNIQUE | Public display name |
| profile_picture | TEXT | Path under `/uploads` |
| role | TEXT | `user` or `admin` |
| created_at | TEXT | UTC timestamp |

## items

| Column | Type | Notes |
| --- | --- | --- |
| id | INTEGER PK | |
| user_id | INTEGER FK → users | Author |
| report_type | TEXT | `lost` or `found` |
| title | TEXT | Thread title |
| description | TEXT | Details |
| category | TEXT | Controlled list |
| location | TEXT | Where it was lost/found |
| incident_date | TEXT | Date of incident |
| image_path | TEXT | Optional thumbnail |
| status | TEXT | `reported`, `claimed`, `returned`, `closed` |
| created_at | TEXT | Used for “latest upload” sort |
| updated_at | TEXT | Last edit / status change |

## claims

| Column | Type | Notes |
| --- | --- | --- |
| id | INTEGER PK | |
| item_id | INTEGER FK → items | |
| user_id | INTEGER FK → users | Claimant |
| message | TEXT | Verification details |
| status | TEXT | `pending`, `approved`, `rejected` |
| admin_note | TEXT | Optional |
| created_at | TEXT | |
| reviewed_at | TEXT | Set when admin acts |

Foreign keys are enabled. Deleting a user removes their items and claims.

## Seed data

On first run the database creates:

- Admin `admin@findit.local`
- Demo user `demo@findit.local`
- Three sample threads for the home grid

Both accounts receive unique random passwords printed once in the server
terminal during initial database creation.
