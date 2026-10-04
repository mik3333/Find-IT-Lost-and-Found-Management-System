# FIND IT

Lost and Found Management System project.

## Run on this computer

1. Install [Node.js 22+](https://nodejs.org/) (LTS is recommended).
2. Open a terminal in this folder.
3. Install packages and start the server:

```powershell
npm install
npm start
```

4. Open [http://localhost:3000](http://localhost:3000).

On the first run, the app creates an administrator and a demo student with unique,
random passwords. Their login details are printed once in the server terminal.
Save the administrator password securely; passwords are stored as bcrypt hashes
in SQLite (`data/findit.db`).

## What is included

- Email registration and login
- Profile edits (public username, photo, password)
- Lost and found threads with image uploads
- Filters: category, lost/found type, title A–Z, latest upload
- Claim requests with optional image proof and admin verification
- Item status: reported, claimed, returned, closed
- Admin dashboard pages for overview, claims, accounts, threads, and archive management
- Account role management and reports
- Deleted accounts, threads, and related claims are stored in `data/findit_archive.db` for admin recovery
- FAQs and Terms pages

Project documentation is in the `docs` folder.
