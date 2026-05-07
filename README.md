# SmartGym Class Booking System

SmartGym is a SER330 final-project implementation based on the Phase 1 requirements document. It uses exactly two personas:

- `Member`: registers, logs in, browses classes, books available classes, joins waitlists, cancels eligible reservations, and receives notifications.
- `Gym Staff`: creates classes, edits schedules, cancels classes, monitors attendance, and reviews notifications.

The implementation keeps the most testable business rules in `src/smartGymCore.mjs` so the API and automated tests exercise the same behavior.

## Run

```bash
node server/server.mjs
```

Open [http://localhost:5173](http://localhost:5173).

Demo accounts:

- Member: `member@smartgym.test` / `password123`
- Member: `casey@smartgym.test` / `password123`
- Staff: `staff@smartgym.test` / `password123`

## Test

```bash
npm install
node test/smartGym.test.mjs
```

The test suite covers registration, login lockout, capacity boundaries, duplicate booking prevention, waitlist promotion, cancellation cutoff, role permissions, overlap validation, notification retry logging, concurrency-style final-seat protection, and report access.

## Architecture

- Frontend: React single-page app in `public/`, loaded by the Node static server.
- Backend: Node.js with Express in `server/server.mjs`.
- Domain layer: in-memory data and SmartGym business rules in `src/smartGymCore.mjs`.
- Database: in-memory seed data, resettable for tests.

This intentionally avoids a persistent database so the course project can run quickly and predictably on a clean machine.

## Requirement Trace Highlights

- US-001/US-002: registration, login, password length validation, and five-failure account lockout.
- US-003/US-004/US-011: class browsing, booking, duplicate prevention, capacity enforcement, and final-seat behavior.
- US-005/US-006: cancellation cutoff and waitlist promotion.
- US-007/US-008/US-009/US-010: staff-only creation, schedule editing, cancellation, and reports.
- US-012: booking and cancellation notifications with retry failure logging.
"# QA-Final-Project" 
