# Requirements Documentation — FIND IT

**Project:** FIND IT Lost and Found Management System  
**Course:** CPE 3121 Software Development Strategies  
**Period:** September 26, 2026 – December 2026  
**Deployment:** Localhost website (not a native mobile app)

## 1. Problem

Lost-and-found reports are often handled through informal chats, social posts, or paper logs. That makes it hard to search items, track status, and verify claims.

## 2. User needs

| User | Needs |
| --- | --- |
| Student / campus user | Register, log in, post lost or found items with a photo, search existing threads, request a claim, edit their own profile |
| Administrator | Oversee reports, verify claims, update item status, view basic records and counts |
| Adviser / audience | See a working localhost demo with documentation |

## 3. Functional requirements

1. Users can register with email, public username, and password.
2. Users can log in and log out. Sessions expire after eight hours of inactivity.
3. Passwords are hashed with bcrypt before storage.
4. Users can change username, profile picture, and password.
5. Authenticated users can post lost-item and found-item threads.
6. A thread includes title, description, category, location, incident date, optional image, type (lost/found), and status.
7. The home page shows thread thumbnails and titles.
8. Users can filter by category, lost/found type, title A–Z / Z–A, and upload date (latest first by default).
9. Users can submit a claim request with identifying details.
10. Administrators can approve or reject claims.
11. Administrators can set status to reported, claimed, returned, or closed.
12. Navigation includes Home, FAQs, Terms and Policies, Post a thread, View profile, and Log out.
13. All user and item records persist in a SQLite database.

## 4. Non-functional requirements

- Usable in a desktop browser on any computer running the local server.
- Simple, clean, minimal interface.
- Image uploads limited to common image types, maximum 5MB.
- No dependence on school SIS, SMS, email gateways, payments, GPS, RFID, or AI matching.

## 5. Out of scope

Native Android/iOS apps, SIS integration, automated notifications, payments, facial/AI matching, live GPS, and hardware trackers.
