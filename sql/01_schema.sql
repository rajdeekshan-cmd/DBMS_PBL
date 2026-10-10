-- ============================================================
-- PROJECT 19: CAR RENTAL RESERVATION AND VEHICLE RETURN
--             MANAGEMENT SYSTEM
-- File: 01_schema.sql
-- Purpose: DDL - Create database, tables, keys and constraints
-- DBMS: MySQL 8.0+
-- ============================================================

DROP DATABASE IF EXISTS car_rental_db;
CREATE DATABASE car_rental_db;
USE car_rental_db;

-- ------------------------------------------------------------
-- 1. BRANCH
-- ------------------------------------------------------------
CREATE TABLE Branch (
    branch_id       INT AUTO_INCREMENT PRIMARY KEY,
    branch_name     VARCHAR(60)  NOT NULL,
    city            VARCHAR(40)  NOT NULL,
    address         VARCHAR(120) NOT NULL,
    phone           VARCHAR(15)  NOT NULL,
    CONSTRAINT uq_branch_name_city UNIQUE (branch_name, city)
);

-- ------------------------------------------------------------
-- 2. VEHICLE CATEGORY
-- ------------------------------------------------------------
CREATE TABLE VehicleCategory (
    category_id     INT AUTO_INCREMENT PRIMARY KEY,
    category_name   VARCHAR(40) NOT NULL UNIQUE,          -- e.g. Hatchback, SUV, Sedan
    seating_capacity INT NOT NULL,
    base_daily_rate DECIMAL(8,2) NOT NULL,
    CONSTRAINT chk_category_rate CHECK (base_daily_rate > 0),
    CONSTRAINT chk_category_seats CHECK (seating_capacity BETWEEN 2 AND 12)
);

-- ------------------------------------------------------------
-- 3. VEHICLE
-- ------------------------------------------------------------
CREATE TABLE Vehicle (
    vehicle_id      INT AUTO_INCREMENT PRIMARY KEY,
    registration_no VARCHAR(15) NOT NULL UNIQUE,          -- business rule: unique reg. number
    category_id     INT NOT NULL,
    branch_id       INT NOT NULL,
    model_name      VARCHAR(40) NOT NULL,
    manufacture_year INT NOT NULL,
    odometer_km     INT NOT NULL DEFAULT 0,
    status          ENUM('AVAILABLE','RENTED','MAINTENANCE','RETIRED') NOT NULL DEFAULT 'AVAILABLE',
    CONSTRAINT fk_vehicle_category FOREIGN KEY (category_id) REFERENCES VehicleCategory(category_id),
    CONSTRAINT fk_vehicle_branch   FOREIGN KEY (branch_id)   REFERENCES Branch(branch_id),
    CONSTRAINT chk_vehicle_odometer CHECK (odometer_km >= 0),
    CONSTRAINT chk_vehicle_year CHECK (manufacture_year BETWEEN 1990 AND 2100)
);

-- ------------------------------------------------------------
-- 4. CUSTOMER
-- ------------------------------------------------------------
CREATE TABLE Customer (
    customer_id     INT AUTO_INCREMENT PRIMARY KEY,
    full_name       VARCHAR(60) NOT NULL,
    phone           VARCHAR(15) NOT NULL UNIQUE,
    email           VARCHAR(80) UNIQUE,
    license_number  VARCHAR(20) NOT NULL UNIQUE,          -- business rule: valid/unique licence
    license_expiry  DATE NOT NULL,
    address         VARCHAR(120)
);

-- ------------------------------------------------------------
-- 5. RATE PLAN (per category, e.g. Daily / Weekly / Weekend)
-- ------------------------------------------------------------
CREATE TABLE RatePlan (
    rate_plan_id    INT AUTO_INCREMENT PRIMARY KEY,
    category_id     INT NOT NULL,
    plan_name       VARCHAR(30) NOT NULL,
    daily_rate      DECIMAL(8,2) NOT NULL,
    extra_km_rate   DECIMAL(6,2) NOT NULL DEFAULT 0,
    late_fee_per_hour DECIMAL(6,2) NOT NULL DEFAULT 100,
    CONSTRAINT fk_rateplan_category FOREIGN KEY (category_id) REFERENCES VehicleCategory(category_id),
    CONSTRAINT uq_rateplan UNIQUE (category_id, plan_name),
    CONSTRAINT chk_rateplan_rate CHECK (daily_rate > 0 AND extra_km_rate >= 0 AND late_fee_per_hour >= 0)
);

-- ------------------------------------------------------------
-- 6. RESERVATION  (booking made in advance)
-- ------------------------------------------------------------
CREATE TABLE Reservation (
    reservation_id  INT AUTO_INCREMENT PRIMARY KEY,
    customer_id     INT NOT NULL,
    vehicle_id      INT NOT NULL,
    branch_id       INT NOT NULL,
    rate_plan_id    INT NOT NULL,
    booking_date    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    planned_pickup     DATETIME NOT NULL,
    planned_return     DATETIME NOT NULL,
    status          ENUM('BOOKED','ISSUED','CANCELLED','COMPLETED') NOT NULL DEFAULT 'BOOKED',
    CONSTRAINT fk_res_customer FOREIGN KEY (customer_id) REFERENCES Customer(customer_id),
    CONSTRAINT fk_res_vehicle  FOREIGN KEY (vehicle_id)  REFERENCES Vehicle(vehicle_id),
    CONSTRAINT fk_res_branch   FOREIGN KEY (branch_id)   REFERENCES Branch(branch_id),
    CONSTRAINT fk_res_rateplan FOREIGN KEY (rate_plan_id) REFERENCES RatePlan(rate_plan_id),
    CONSTRAINT chk_res_dates CHECK (planned_return > planned_pickup)
);

-- ------------------------------------------------------------
-- 7. RENTAL  (actual issue/return of the vehicle)
-- ------------------------------------------------------------
CREATE TABLE Rental (
    rental_id       INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id  INT NOT NULL UNIQUE,                  -- one rental per reservation
    actual_pickup_dt   DATETIME NULL,
    actual_return_dt   DATETIME NULL,
    pickup_odometer    INT NULL,
    return_odometer    INT NULL,
    status          ENUM('ACTIVE','RETURNED','OVERDUE') NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT fk_rental_reservation FOREIGN KEY (reservation_id) REFERENCES Reservation(reservation_id),
    CONSTRAINT chk_rental_dates CHECK (actual_return_dt IS NULL OR actual_return_dt > actual_pickup_dt),
    CONSTRAINT chk_rental_odometer CHECK (return_odometer IS NULL OR return_odometer >= pickup_odometer)
);

-- ------------------------------------------------------------
-- 8. INSPECTION  (condition check done at pickup and at return)
-- ------------------------------------------------------------
CREATE TABLE Inspection (
    inspection_id   INT AUTO_INCREMENT PRIMARY KEY,
    rental_id       INT NOT NULL,
    inspection_type ENUM('PICKUP','RETURN') NOT NULL,
    odometer_reading INT NOT NULL,
    fuel_level_pct  INT NOT NULL,                         -- 0 to 100
    condition_notes VARCHAR(200),
    inspected_by    VARCHAR(40) NOT NULL,
    inspection_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_inspection_rental FOREIGN KEY (rental_id) REFERENCES Rental(rental_id),
    CONSTRAINT chk_inspection_fuel CHECK (fuel_level_pct BETWEEN 0 AND 100),
    CONSTRAINT chk_inspection_odo CHECK (odometer_reading >= 0),
    CONSTRAINT uq_inspection_type_per_rental UNIQUE (rental_id, inspection_type)
);

-- ------------------------------------------------------------
-- 9. FUEL READING (explicit log, one row per inspection)
-- ------------------------------------------------------------
CREATE TABLE FuelReading (
    fuel_reading_id INT AUTO_INCREMENT PRIMARY KEY,
    inspection_id   INT NOT NULL UNIQUE,
    fuel_level_pct  INT NOT NULL,
    reading_time    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fuel_inspection FOREIGN KEY (inspection_id) REFERENCES Inspection(inspection_id),
    CONSTRAINT chk_fuel_pct CHECK (fuel_level_pct BETWEEN 0 AND 100)
);

-- ------------------------------------------------------------
-- 10. DAMAGE  (recorded against a return inspection)
-- ------------------------------------------------------------
CREATE TABLE Damage (
    damage_id       INT AUTO_INCREMENT PRIMARY KEY,
    inspection_id   INT NOT NULL,
    description     VARCHAR(200) NOT NULL,
    repair_cost     DECIMAL(8,2) NOT NULL DEFAULT 0,
    reported_date   DATE NOT NULL DEFAULT (CURRENT_DATE),
    CONSTRAINT fk_damage_inspection FOREIGN KEY (inspection_id) REFERENCES Inspection(inspection_id),
    CONSTRAINT chk_damage_cost CHECK (repair_cost >= 0)
);

-- ------------------------------------------------------------
-- 11. INVOICE
-- ------------------------------------------------------------
CREATE TABLE Invoice (
    invoice_id      INT AUTO_INCREMENT PRIMARY KEY,
    rental_id       INT NOT NULL UNIQUE,
    invoice_date    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rental_charges  DECIMAL(9,2) NOT NULL DEFAULT 0,
    extra_km_charges DECIMAL(9,2) NOT NULL DEFAULT 0,
    late_fee        DECIMAL(9,2) NOT NULL DEFAULT 0,
    damage_charges  DECIMAL(9,2) NOT NULL DEFAULT 0,
    tax_amount      DECIMAL(9,2) NOT NULL DEFAULT 0,
    total_amount    DECIMAL(9,2) NOT NULL DEFAULT 0,
    status          ENUM('PENDING','PAID','PARTIAL') NOT NULL DEFAULT 'PENDING',
    CONSTRAINT fk_invoice_rental FOREIGN KEY (rental_id) REFERENCES Rental(rental_id),
    CONSTRAINT chk_invoice_amounts CHECK (
        rental_charges >= 0 AND extra_km_charges >= 0 AND late_fee >= 0
        AND damage_charges >= 0 AND tax_amount >= 0 AND total_amount >= 0
    )
);

-- ------------------------------------------------------------
-- 12. PAYMENT
-- ------------------------------------------------------------
CREATE TABLE Payment (
    payment_id      INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id      INT NOT NULL,
    payment_date    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    amount          DECIMAL(9,2) NOT NULL,
    payment_mode    ENUM('CASH','CARD','UPI','NETBANKING') NOT NULL,
    CONSTRAINT fk_payment_invoice FOREIGN KEY (invoice_id) REFERENCES Invoice(invoice_id),
    CONSTRAINT chk_payment_amount CHECK (amount > 0)
);

-- ------------------------------------------------------------
-- INDEXES on frequently searched columns (performance requirement)
-- ------------------------------------------------------------
CREATE INDEX idx_vehicle_status        ON Vehicle(status);
CREATE INDEX idx_vehicle_category      ON Vehicle(category_id);
CREATE INDEX idx_customer_license      ON Customer(license_number);
CREATE INDEX idx_reservation_dates     ON Reservation(planned_pickup, planned_return);
CREATE INDEX idx_reservation_vehicle   ON Reservation(vehicle_id);
CREATE INDEX idx_rental_status         ON Rental(status);
CREATE INDEX idx_invoice_status        ON Invoice(status);

-- ============================================================
-- TRIGGERS  (business rules that plain CHECK constraints
-- cannot express, because they compare across ROWS)
-- ============================================================
DELIMITER $$

-- Rule: No overlapping rentals/reservations for the same vehicle
CREATE TRIGGER trg_no_overlap_reservation
BEFORE INSERT ON Reservation
FOR EACH ROW
BEGIN
    DECLARE conflict_count INT;
    SELECT COUNT(*) INTO conflict_count
    FROM Reservation
    WHERE vehicle_id = NEW.vehicle_id
      AND status IN ('BOOKED','ISSUED')
      AND NEW.planned_pickup < planned_return
      AND NEW.planned_return > planned_pickup;

    IF conflict_count > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Overlapping reservation exists for this vehicle in the selected period';
    END IF;
END$$

-- Rule: Customer's driving licence must not be expired at pickup time
CREATE TRIGGER trg_valid_license
BEFORE INSERT ON Reservation
FOR EACH ROW
BEGIN
    DECLARE expiry DATE;
    SELECT license_expiry INTO expiry FROM Customer WHERE customer_id = NEW.customer_id;
    IF expiry < DATE(NEW.planned_pickup) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Customer driving licence is expired before the pickup date';
    END IF;
END$$

-- Rule: Auto-update Vehicle.status when a rental starts (pickup) and ends (return)
CREATE TRIGGER trg_vehicle_status_on_pickup
AFTER UPDATE ON Rental
FOR EACH ROW
BEGIN
    IF NEW.actual_pickup_dt IS NOT NULL AND OLD.actual_pickup_dt IS NULL THEN
        UPDATE Vehicle v
        JOIN Reservation r ON r.reservation_id = NEW.reservation_id
        SET v.status = 'RENTED', v.odometer_km = NEW.pickup_odometer
        WHERE v.vehicle_id = r.vehicle_id;
    END IF;

    IF NEW.actual_return_dt IS NOT NULL AND OLD.actual_return_dt IS NULL THEN
        UPDATE Vehicle v
        JOIN Reservation r ON r.reservation_id = NEW.reservation_id
        SET v.status = 'AVAILABLE', v.odometer_km = NEW.return_odometer
        WHERE v.vehicle_id = r.vehicle_id;
    END IF;
END$$

DELIMITER ;
