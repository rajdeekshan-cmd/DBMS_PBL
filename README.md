<p align="center"><img src="assets/woxsen-logo.png" alt="Woxsen University" height="110"></p>

# Car Rental Reservation and Vehicle Return Management System

**Woxsen University | Database Management Systems | PBL Project No. 19**

| | |
|---|---|
| **Student** | Bangla Deekshan Raj |
| **Roll number** | 25WU0102057 |

A normalized relational database (MySQL, 3NF) with constraint- and trigger-based
business rules for a multi-branch car rental agency, with two front ends:

1. **Desktop app** (Python + Tkinter), the Review 3 submission.
2. **Woxsen Car Rentals web app** (Flask API + React site), a full web version on the same database.

## Repository structure

```
.
├── Review-1-Presentation.pptx     Problem statement, ER diagram
├── Review-2-Presentation.pptx     3NF normalization, DDL, sample data, queries
├── Review-3-Presentation.pptx     Application, demo, viva-voce
├── Project19_Report.pdf           Full project report
├── sql/                           01_schema.sql, 02_sample_data.sql, 03_queries_and_views.sql
├── app.py, db.py, requirements.txt    Tkinter desktop application
├── backend/                       Flask REST API (web version)
├── frontend/                      Vite + React site (web version)
└── assets/                        Logo and images
```

## Database setup (MySQL 8+)

```bash
mysql -u root -p < sql/01_schema.sql
mysql -u root -p < sql/02_sample_data.sql
mysql -u root -p < sql/03_queries_and_views.sql
```

`01_schema.sql` drops and recreates `car_rental_db`. Run it only on a fresh setup.

## Run the desktop app

Set your MySQL password in `db.py` (`CONFIG`), then:

```bash
pip install -r requirements.txt
python app.py
```

## Run the web app

Backend (copy `backend/.env.example` to `backend/.env` and set `DB_PASSWORD`):

```bash
cd backend
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
./venv/bin/python app.py
```

Frontend (in a second terminal):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 (site) and http://localhost:5173/admin (concierge desk).
The API runs on http://localhost:5050/api.

## Business rules enforced in the database

- No overlapping reservations for a vehicle (trigger)
- Driving licence must be valid at pickup (trigger)
- Vehicle status updates automatically on pickup and return (trigger)
- Unique registration, phone, email and licence numbers; CHECK constraints on amounts, dates, fuel and odometer

## Invoice calculation

`days = max(1, whole days between pickup and return + 1)`, rental = daily rate x days,
200 km free per day then extra km x rate, late hours (rounded down) x hourly fee,
plus damage charges, plus 18% tax.

The web version also records payments (partial or full), cancels reservations, and
saves every inspection, fuel reading, damage and invoice in a single transaction.

## Live demo (GitHub Pages)

The website is published by `.github/workflows/pages.yml` on every push to `main`:
https://rajdeekshan-cmd.github.io/DBMS_PBL/

GitHub Pages hosts only static files, so this build is a **read-only demo**: it shows a
snapshot of the sample database (`frontend/public/demo/`). Browsing, filters, date-based
availability, the admin desk and the six reports work; booking, issuing, returning and editing
are refused with a "demo mode" message. For the full system, run the backend locally (above).

One-time setup: repository **Settings > Pages > Source: GitHub Actions**.

## Full online deployment (optional, Render + Railway)

1. **Database (Railway).** New project, add MySQL. From the MySQL service's Connect tab copy host, port, user and password, then load the scripts from this repo:
   ```bash
   mysql -h HOST -P PORT -u USER -p < sql/01_schema.sql
   mysql -h HOST -P PORT -u USER -p < sql/02_sample_data.sql
   mysql -h HOST -P PORT -u USER -p < sql/03_queries_and_views.sql
   ```
2. **API + website (Render).** New > Blueprint, pick this repo. Render reads `render.yaml` and creates two services. When asked, fill in:
   - API: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` from Railway; `CORS_ORIGINS` = the website's URL.
   - Website: `VITE_API_URL` = the API's URL plus `/api` (for example `https://woxsen-car-rentals-api.onrender.com/api`).
3. Every `git push` to `main` redeploys both automatically.

Free Render services sleep when idle, so the first request can take about 30 seconds. The `/admin` desk has no login.
