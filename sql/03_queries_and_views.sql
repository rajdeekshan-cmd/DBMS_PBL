-- ============================================================
-- PROJECT 19: Reporting Queries and Views
-- Covers: joins, aggregate functions, nested (sub) queries, views
-- Required reports: fleet availability, overdue rentals,
-- utilization, damages, branch revenue, customer history
-- ============================================================
USE car_rental_db;

-- ------------------------------------------------------------
-- REPORT 1: FLEET AVAILABILITY (which vehicles are free right now)
-- Uses: JOIN
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW vw_fleet_availability AS
SELECT
    v.vehicle_id,
    v.registration_no,
    vc.category_name,
    b.branch_name,
    v.model_name,
    v.status
FROM Vehicle v
JOIN VehicleCategory vc ON vc.category_id = v.category_id
JOIN Branch b            ON b.branch_id   = v.branch_id
WHERE v.status = 'AVAILABLE';

SELECT * FROM vw_fleet_availability;


-- ------------------------------------------------------------
-- REPORT 2: OVERDUE RENTALS (rentals not yet returned, past planned_return)
-- Uses: JOIN + WHERE with subquery-style time comparison
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW vw_overdue_rentals AS
SELECT
    rt.rental_id,
    c.full_name          AS customer_name,
    v.registration_no,
    r.planned_return,
    rt.actual_return_dt,
    TIMESTAMPDIFF(HOUR, r.planned_return, NOW()) AS hours_overdue
FROM Rental rt
JOIN Reservation r  ON r.reservation_id = rt.reservation_id
JOIN Customer c     ON c.customer_id    = r.customer_id
JOIN Vehicle v      ON v.vehicle_id     = r.vehicle_id
WHERE rt.actual_return_dt IS NULL
  AND r.planned_return < NOW();

SELECT * FROM vw_overdue_rentals;


-- ------------------------------------------------------------
-- REPORT 3: VEHICLE UTILIZATION (total rented days per vehicle)
-- Uses: JOIN + Aggregate function (SUM) + GROUP BY
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW vw_vehicle_utilization AS
SELECT
    v.vehicle_id,
    v.registration_no,
    COUNT(rt.rental_id)                                            AS total_rentals,
    COALESCE(SUM(DATEDIFF(rt.actual_return_dt, rt.actual_pickup_dt)), 0) AS total_days_rented
FROM Vehicle v
LEFT JOIN Reservation r ON r.vehicle_id = v.vehicle_id
LEFT JOIN Rental rt     ON rt.reservation_id = r.reservation_id AND rt.actual_return_dt IS NOT NULL
GROUP BY v.vehicle_id, v.registration_no
ORDER BY total_days_rented DESC;

SELECT * FROM vw_vehicle_utilization;


-- ------------------------------------------------------------
-- REPORT 4: DAMAGE REPORT (all recorded damages with cost)
-- Uses: JOIN + Aggregate
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW vw_damage_report AS
SELECT
    d.damage_id,
    v.registration_no,
    c.full_name AS customer_name,
    d.description,
    d.repair_cost,
    d.reported_date
FROM Damage d
JOIN Inspection i   ON i.inspection_id = d.inspection_id
JOIN Rental rt      ON rt.rental_id    = i.rental_id
JOIN Reservation r  ON r.reservation_id = rt.reservation_id
JOIN Vehicle v      ON v.vehicle_id    = r.vehicle_id
JOIN Customer c     ON c.customer_id   = r.customer_id;

SELECT * FROM vw_damage_report;

-- Total damage cost per vehicle (aggregate)
SELECT v.registration_no, SUM(d.repair_cost) AS total_damage_cost
FROM Damage d
JOIN Inspection i   ON i.inspection_id = d.inspection_id
JOIN Rental rt      ON rt.rental_id    = i.rental_id
JOIN Reservation r  ON r.reservation_id = rt.reservation_id
JOIN Vehicle v      ON v.vehicle_id    = r.vehicle_id
GROUP BY v.registration_no;


-- ------------------------------------------------------------
-- REPORT 5: BRANCH REVENUE (total collected payments per branch)
-- Uses: JOIN + Aggregate (SUM) + GROUP BY
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW vw_branch_revenue AS
SELECT
    b.branch_id,
    b.branch_name,
    SUM(p.amount) AS total_revenue
FROM Payment p
JOIN Invoice inv    ON inv.invoice_id = p.invoice_id
JOIN Rental rt      ON rt.rental_id   = inv.rental_id
JOIN Reservation r  ON r.reservation_id = rt.reservation_id
JOIN Branch b       ON b.branch_id    = r.branch_id
GROUP BY b.branch_id, b.branch_name
ORDER BY total_revenue DESC;

SELECT * FROM vw_branch_revenue;


-- ------------------------------------------------------------
-- REPORT 6: CUSTOMER RENTAL HISTORY
-- Uses: JOIN
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW vw_customer_history AS
SELECT
    c.customer_id,
    c.full_name,
    v.registration_no,
    r.planned_pickup,
    r.planned_return,
    rt.actual_pickup_dt,
    rt.actual_return_dt,
    inv.total_amount
FROM Reservation r
JOIN Customer c    ON c.customer_id = r.customer_id
JOIN Vehicle v     ON v.vehicle_id  = r.vehicle_id
LEFT JOIN Rental rt   ON rt.reservation_id = r.reservation_id
LEFT JOIN Invoice inv ON inv.rental_id = rt.rental_id
ORDER BY c.customer_id, r.planned_pickup;

SELECT * FROM vw_customer_history WHERE customer_id = 1;


-- ------------------------------------------------------------
-- NESTED (SUBQUERY) EXAMPLES  -- explicitly required by rubric
-- ------------------------------------------------------------

-- (a) Customers who have paid MORE than the average invoice total (correlated aggregate subquery)
SELECT DISTINCT c.full_name, inv.total_amount
FROM Customer c
JOIN Reservation r ON r.customer_id = c.customer_id
JOIN Rental rt     ON rt.reservation_id = r.reservation_id
JOIN Invoice inv   ON inv.rental_id = rt.rental_id
WHERE inv.total_amount > (SELECT AVG(total_amount) FROM Invoice);

-- (b) Vehicles that have NEVER been rented (NOT IN subquery)
SELECT v.registration_no, v.model_name
FROM Vehicle v
WHERE v.vehicle_id NOT IN (
    SELECT DISTINCT r.vehicle_id FROM Reservation r
);

-- (c) Most expensive category to maintain: category whose vehicles have the highest total damage cost
SELECT vc.category_name
FROM VehicleCategory vc
WHERE vc.category_id = (
    SELECT v.category_id
    FROM Vehicle v
    JOIN Reservation r ON r.vehicle_id = v.vehicle_id
    JOIN Rental rt ON rt.reservation_id = r.reservation_id
    JOIN Inspection i ON i.rental_id = rt.rental_id
    JOIN Damage d ON d.inspection_id = i.inspection_id
    GROUP BY v.category_id
    ORDER BY SUM(d.repair_cost) DESC
    LIMIT 1
);

-- ------------------------------------------------------------
-- Additional aggregate report: bookings count per branch, per month
-- ------------------------------------------------------------
SELECT b.branch_name,
       DATE_FORMAT(r.booking_date, '%Y-%m') AS booking_month,
       COUNT(*) AS total_bookings
FROM Reservation r
JOIN Branch b ON b.branch_id = r.branch_id
GROUP BY b.branch_name, booking_month
ORDER BY booking_month;
