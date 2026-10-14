-- ============================================================
-- PROJECT 19: Sample / Test Data
-- Run AFTER 01_schema.sql
-- ============================================================
USE car_rental_db;

-- 1. Branches
INSERT INTO Branch (branch_name, city, address, phone) VALUES
('Andheri Branch',  'Mumbai', 'SV Road, Andheri West',        '9820011111'),
('Whitefield Branch','Bengaluru','ITPL Main Road, Whitefield', '9880022222'),
('Koregaon Branch',  'Pune',  'North Main Road, Koregaon Park','9860033333');

-- 2. Vehicle Categories
INSERT INTO VehicleCategory (category_name, seating_capacity, base_daily_rate) VALUES
('Hatchback', 5, 1200.00),
('Sedan',     5, 1800.00),
('SUV',       7, 2500.00),
('Luxury',    5, 5000.00);

-- 3. Vehicles
INSERT INTO Vehicle (registration_no, category_id, branch_id, model_name, manufacture_year, odometer_km, status) VALUES
('MH02AB1234', 1, 1, 'Maruti Swift',     2022, 15420, 'AVAILABLE'),
('MH02AB5678', 2, 1, 'Honda City',       2023,  8210, 'AVAILABLE'),
('KA05CJ4321', 3, 2, 'Hyundai Creta',    2022, 21050, 'AVAILABLE'),
('KA05CJ8765', 1, 2, 'Hyundai i20',      2021, 30110, 'AVAILABLE'),
('MH12XY1111', 4, 3, 'Skoda Superb',     2023,  5200, 'AVAILABLE'),
('MH12XY2222', 3, 3, 'Toyota Innova',    2022, 18990, 'MAINTENANCE');

-- 4. Customers
INSERT INTO Customer (full_name, phone, email, license_number, license_expiry, address) VALUES
('Rohan Mehta',   '9000000001', 'rohan.mehta@mail.com',   'MH0120180012345', '2027-05-10', 'Mumbai'),
('Ananya Rao',    '9000000002', 'ananya.rao@mail.com',    'KA0520190067890', '2026-11-20', 'Bengaluru'),
('Karan Verma',   '9000000003', 'karan.verma@mail.com',   'DL0420170099887', '2025-01-15', 'Delhi'),
('Sneha Kulkarni','9000000004', 'sneha.k@mail.com',       'MH1220200055443', '2028-03-30', 'Pune');

-- 5. Rate Plans
INSERT INTO RatePlan (category_id, plan_name, daily_rate, extra_km_rate, late_fee_per_hour) VALUES
(1, 'Standard', 1200.00, 6.00, 100.00),
(2, 'Standard', 1800.00, 8.00, 150.00),
(3, 'Standard', 2500.00, 10.00, 200.00),
(4, 'Premium',  5000.00, 15.00, 300.00);

-- 6. Reservations (also fires trigger checks - dates must not overlap, licence must be valid)
INSERT INTO Reservation (customer_id, vehicle_id, branch_id, rate_plan_id, planned_pickup, planned_return, status) VALUES
(1, 1, 1, 1, '2026-09-01 10:00:00', '2026-09-04 10:00:00', 'ISSUED'),
(2, 3, 2, 3, '2026-09-02 09:00:00', '2026-09-05 09:00:00', 'ISSUED'),
(4, 5, 3, 4, '2026-09-10 12:00:00', '2026-09-12 12:00:00', 'BOOKED');

-- 7. Rentals
-- Design note: a Rental row is first created empty (vehicle not yet issued),
-- then actual_pickup_dt is set with an UPDATE. This matches how the Python
-- application works (Reserve -> Issue Vehicle -> Return Vehicle) and is what
-- fires the trg_vehicle_status_on_pickup trigger to flip Vehicle.status.
INSERT INTO Rental (reservation_id) VALUES (1), (2);

UPDATE Rental SET actual_pickup_dt = '2026-09-01 10:15:00', pickup_odometer = 15420 WHERE rental_id = 1;
UPDATE Rental SET actual_pickup_dt = '2026-09-02 09:20:00', pickup_odometer = 21050 WHERE rental_id = 2;

-- Reservation 3 has no rental yet (still BOOKED, not issued) -> leave Rental table for it absent until issued

-- Complete rental #1 with a return (Rohan Mehta returns car on time)
UPDATE Rental
SET actual_return_dt = '2026-09-04 09:50:00', return_odometer = 15720
WHERE rental_id = 1;
UPDATE Rental SET status = 'RETURNED' WHERE rental_id = 1;
UPDATE Reservation SET status = 'COMPLETED' WHERE reservation_id = 1;

-- Rental #2 is still ACTIVE (Ananya Rao has not returned the SUV yet) -> used for "overdue" report demo
UPDATE Rental SET status = 'OVERDUE' WHERE rental_id = 2 AND actual_return_dt IS NULL;

-- 8. Inspections (pickup and return inspection for rental #1)
INSERT INTO Inspection (rental_id, inspection_type, odometer_reading, fuel_level_pct, condition_notes, inspected_by) VALUES
(1, 'PICKUP', 15420, 100, 'No visible damage', 'Staff: Amit'),
(1, 'RETURN', 15720, 40,  'Minor scratch on rear bumper', 'Staff: Amit'),
(2, 'PICKUP', 21050, 90,  'No visible damage', 'Staff: Divya');

-- 9. Fuel Readings (linked 1-1 with inspections)
INSERT INTO FuelReading (inspection_id, fuel_level_pct) VALUES
(1, 100),
(2, 40),
(3, 90);

-- 10. Damages (recorded against the RETURN inspection of rental #1)
INSERT INTO Damage (inspection_id, description, repair_cost) VALUES
(2, 'Rear bumper scratch - minor repaint required', 1500.00);

-- 11. Invoices
INSERT INTO Invoice (rental_id, rental_charges, extra_km_charges, late_fee, damage_charges, tax_amount, total_amount, status) VALUES
(1, 3600.00, 0.00, 0.00, 1500.00, 918.00, 6018.00, 'PAID');
-- rental #2 has no invoice yet - still ongoing/overdue

-- 12. Payments
INSERT INTO Payment (invoice_id, amount, payment_mode) VALUES
(1, 6018.00, 'UPI');