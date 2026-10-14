<p align="center"><img src="docs/woxsen-logo.png" alt="Woxsen University" height="110"></p>

# Car Rental Reservation and Vehicle Return Management System

**Project 19 · DBMS Project-Based Learning (PBL)**
Bangla Deekshan Raj · Woxsen University · Student ID 25WU0102057 · 2026

A relational database system in MySQL 8, normalized to 3NF, for managing vehicles, customers, reservations, vehicle pickup and return, damage, invoices and payments across a multi-branch car rental agency. Business rules are enforced inside the database (3 triggers, 14 CHECK constraints), and two front ends sit on top of it: a Tkinter desktop app and the **Woxsen Car Rentals** web app.

> ### ▶ [Try it now: live demo (no install)](https://rajdeekshan-cmd.github.io/DBMS_PBL/)
> Opens in any browser and runs on a built-in snapshot of the sample data, so no database is needed. It is read-only: browsing, filters, date-based availability and the reports work, while booking and editing show a "demo mode" message. The full MySQL-backed version is under [Run the prototype](#run-the-prototype) below.

![Woxsen Car Rentals landing page](./review-3/screenshots/01_landing_hero.png)

| | |
|---|---|
| **Live demo** | [rajdeekshan-cmd.github.io/DBMS_PBL](https://rajdeekshan-cmd.github.io/DBMS_PBL/) (sample data runs in the browser) |
| **Final report** | [`report/Project19_Report.pdf`](./report/Project19_Report.pdf) |

## Submission contents

| Item | Location |
|---|---|
| Review 1 deck | [`review-1/Review-1-Presentation.pptx`](./review-1/Review-1-Presentation.pptx) |
| Review 2 deck | [`review-2/Review-2-Presentation.pptx`](./review-2/Review-2-Presentation.pptx) |
| Review 3 (final) deck | [`review-3/Review-3-Presentation.pptx`](./review-3/Review-3-Presentation.pptx) |
| Final report (PDF) | [`report/Project19_Report.pdf`](./report/Project19_Report.pdf) |
| SQL: schema, triggers, sample data, queries, views | [`review-2/sql/`](./review-2/sql) |
| ER diagram | below, and [`docs/er_diagram.png`](./docs/er_diagram.png) |
| Architecture diagram | [`docs/architecture.png`](./docs/architecture.png) |
| Desktop application (Tkinter) | [`review-3/desktop_app/`](./review-3/desktop_app) |
| Web application (Flask API + React) | [`review-3/web/`](./review-3/web) |

## ER diagram

Rendered from the implemented schema (`review-2/sql/01_schema.sql`). 12 tables, 13 foreign keys.

```mermaid
erDiagram
    Branch ||--o{ Vehicle : "hosts"
    Branch ||--o{ Reservation : "collects at"
    VehicleCategory ||--o{ Vehicle : "classifies"
    VehicleCategory ||--o{ RatePlan : "priced by"
    Customer ||--o{ Reservation : "makes"
    Vehicle ||--o{ Reservation : "is booked for"
    RatePlan ||--o{ Reservation : "applies to"
    Reservation ||--o| Rental : "becomes"
    Rental ||--o{ Inspection : "checked in"
    Inspection ||--o| FuelReading : "logs"
    Inspection ||--o{ Damage : "may record"
    Rental ||--o| Invoice : "billed as"
    Invoice ||--o{ Payment : "settled by"

    Branch {
        int branch_id PK
        varchar branch_name
        varchar city
        varchar address
        varchar phone
    }
    VehicleCategory {
        int category_id PK
        varchar category_name UK
        int seating_capacity
        decimal base_daily_rate
    }
    Vehicle {
        int vehicle_id PK
        varchar registration_no UK
        int category_id FK
        int branch_id FK
        varchar model_name
        int manufacture_year
        int odometer_km
        enum status
    }
    Customer {
        int customer_id PK
        varchar full_name
        varchar phone UK
        varchar email UK
        varchar license_number UK
        date license_expiry
        varchar address
    }
    RatePlan {
        int rate_plan_id PK
        int category_id FK
        varchar plan_name
        decimal daily_rate
        decimal extra_km_rate
        decimal late_fee_per_hour
    }
    Reservation {
        int reservation_id PK
        int customer_id FK
        int vehicle_id FK
        int branch_id FK
        int rate_plan_id FK
        datetime booking_date
        datetime planned_pickup
        datetime planned_return
        enum status
    }
    Rental {
        int rental_id PK
        int reservation_id FK, UK
        datetime actual_pickup_dt
        datetime actual_return_dt
        int pickup_odometer
        int return_odometer
        enum status
    }
    Inspection {
        int inspection_id PK
        int rental_id FK
        enum inspection_type
        int odometer_reading
        int fuel_level_pct
        varchar condition_notes
        varchar inspected_by
    }
    FuelReading {
        int fuel_reading_id PK
        int inspection_id FK, UK
        int fuel_level_pct
        datetime reading_time
    }
    Damage {
        int damage_id PK
        int inspection_id FK
        varchar description
        decimal repair_cost
        date reported_date
    }
    Invoice {
        int invoice_id PK
        int rental_id FK, UK
        decimal rental_charges
        decimal extra_km_charges
        decimal late_fee
        decimal damage_charges
        decimal tax_amount
        decimal total_amount
        enum status
    }
    Payment {
        int payment_id PK
        int invoice_id FK
        datetime payment_date
        decimal amount
        enum payment_mode
    }
```

## Screenshots

All captured from the running web app on the sample database (`review-3/screenshots/`).

**Landing page**

![Landing page](./review-3/screenshots/01_landing_hero.png)

**The fleet, a pinned horizontal gallery driven by scroll**

![Fleet gallery](./review-3/screenshots/02_fleet_gallery.png)

**Fleet and availability: only cars free for the whole period**

![Fleet and availability](./review-3/screenshots/05_fleet_availability.png)

**Booking, step 1: choose a car**

![Reserve: car](./review-3/screenshots/06_reserve_car.png)

**Booking, step 2: choose a client (an expired licence is flagged)**

![Reserve: client](./review-3/screenshots/07_reserve_client.png)

**Booking, step 3: dates, with a live availability check**

![Reserve: dates](./review-3/screenshots/08_reserve_dates.png)

**Booking, step 5: review and confirm**

![Reserve: confirm](./review-3/screenshots/09_reserve_confirm.png)

**Concierge desk: reservations**

![Reservations](./review-3/screenshots/10_admin_reservations.png)

**Issue a vehicle: pickup odometer, fuel level and inspection**

![Issue vehicle](./review-3/screenshots/11_admin_issue_vehicle.png)

**Return a vehicle: inspection, damage, and billing**

![Return vehicle](./review-3/screenshots/12_admin_return_vehicle.png)

**Payments and invoices**

![Payments](./review-3/screenshots/13_admin_payments.png)

**Vehicles**

![Vehicles](./review-3/screenshots/14_admin_vehicles.png)

**Clients**

![Clients](./review-3/screenshots/15_admin_clients.png)

**Report: branch revenue**

![Report: branch revenue](./review-3/screenshots/16_report_branch_revenue.png)

**Report: vehicle utilisation**

![Report: vehicle utilisation](./review-3/screenshots/17_report_utilisation.png)

**Dark theme**

![Dark theme](./review-3/screenshots/18_dark_landing.png)

![Dark theme: reports](./review-3/screenshots/19_dark_admin_reports.png)

**Mobile**

<img src="./review-3/screenshots/20_mobile_landing.png" alt="Mobile landing page" width="280">

## Repository layout

```
review-1/   problem statement, ER diagram (deck)
review-2/   normalization, DDL, triggers, sample data, queries (deck + sql/)
review-3/   final deck and the working prototype
  desktop_app/   Python + Tkinter application
  web/
    backend/     Flask REST API
    frontend/    React + Vite website (Woxsen Car Rentals)
  screenshots/   captured from the running web app
report/     final report (PDF)
docs/       ER diagram, architecture diagram, logo
```

## Design highlights

- **3NF** with 12 tables, 13 foreign keys, 7 indexes and unique keys on registration, phone, email and licence numbers.
- **3 triggers in the database:** no overlapping reservations for a vehicle, driving licence must be valid at pickup, and the vehicle status and odometer update automatically on pickup and return.
- **14 CHECK constraints** on rates, capacity, odometer, dates, fuel level, repair cost and amounts.
- **6 reporting views:** fleet availability, overdue rentals, vehicle utilization, damage report, branch revenue, customer history.
- **Atomic operations:** issuing a vehicle, returning it with its invoice, and recording a payment each run as one transaction. If any step fails, everything rolls back. All SQL is parameterized.
- **Date-aware availability:** a car is offered only if it is not in maintenance or retired, has no booked or issued reservation overlapping the dates, and is not still out on an overdue rental.

### Invoice calculation

| Line | Rule |
|---|---|
| Days used | `max(1, whole days between pickup and return + 1)` |
| Rental | daily rate x days used |
| Extra kilometres | kilometres above 200 per day x extra-km rate |
| Late fee | whole hours after the planned return x hourly fee |
| Damage | sum of recorded repair costs |
| Tax | 18% of the subtotal |

## Run the prototype

Requirements: MySQL 8, Python 3.9+, and Node 18+ (only for the web front end).

```bash
# 1. Create the database (from the repo root). 01_schema.sql drops and recreates car_rental_db.
mysql -u root -p < review-2/sql/01_schema.sql
mysql -u root -p < review-2/sql/02_sample_data.sql
mysql -u root -p < review-2/sql/03_queries_and_views.sql

# 2a. Desktop app: set your MySQL password in review-3/desktop_app/db.py, then
pip install -r review-3/desktop_app/requirements.txt
python review-3/desktop_app/app.py

# 2b. Web app, API (copy .env.example to .env and set DB_PASSWORD first)
cd review-3/web/backend
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
./venv/bin/python app.py                  # http://localhost:5050/api

# 2c. Web app, website (in a second terminal)
cd review-3/web/frontend
npm install
npm run dev                               # http://localhost:5173  (admin: /admin)
```

The web app also adds what the desktop app lacked: payments (partial or full), reservation cancellation, damage saved with the return inspection, and clean error messages for every database rule.

The live demo is published from this repository by GitHub Actions (`.github/workflows/pages.yml`) on every push to `main`.
