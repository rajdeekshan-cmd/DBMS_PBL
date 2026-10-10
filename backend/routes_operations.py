"""
Availability, reservations, issue (pickup), return + invoice, payments.
Every multi-step flow runs inside ONE transaction on ONE connection.
"""

from datetime import datetime
from decimal import Decimal

from flask import Blueprint, jsonify, request

import validators as v
from billing import compute_invoice
from db import ApiError, fetch_all, fetch_one, transaction

bp = Blueprint("operations", __name__)

BLOCKED_STATUSES = ("MAINTENANCE", "RETIRED")


# ---------------------------------------------------------------- availability
@bp.get("/availability")
def availability():
    """
    Vehicles that can be booked for [pickup, return):
    - not MAINTENANCE / RETIRED
    - no BOOKED/ISSUED reservation overlapping the range (same rule as the trigger)
    - not still out on an overdue rental (ISSUED and planned_return already passed)
    Optional filters: category_id, branch_id. Dates are optional; without them
    only the status rules apply.
    """
    args = request.args
    category_id = v.integer(args, "category_id", "Category", required=False)
    branch_id = v.integer(args, "branch_id", "Branch", required=False)
    pickup = v.parse_datetime(args.get("pickup"), "Pickup", required=False)
    ret = v.parse_datetime(args.get("return"), "Return", required=False)
    if (pickup is None) != (ret is None):
        raise ApiError("Provide both pickup and return, or neither.")
    if pickup and ret <= pickup:
        raise ApiError("Return must be after pickup.")

    query = """
        SELECT v.vehicle_id, v.registration_no, v.model_name, v.manufacture_year, v.odometer_km, v.status,
               v.category_id, vc.category_name, vc.seating_capacity, v.branch_id, b.branch_name, b.city,
               (SELECT MIN(rp.daily_rate) FROM RatePlan rp WHERE rp.category_id = v.category_id) AS from_daily_rate
        FROM Vehicle v
        JOIN VehicleCategory vc ON vc.category_id = v.category_id
        JOIN Branch b ON b.branch_id = v.branch_id
        WHERE v.status NOT IN ('MAINTENANCE', 'RETIRED')
    """
    params = []
    if category_id:
        query += " AND v.category_id = %s"
        params.append(category_id)
    if branch_id:
        query += " AND v.branch_id = %s"
        params.append(branch_id)
    if pickup:
        query += """
          AND NOT EXISTS (
              SELECT 1 FROM Reservation r
              WHERE r.vehicle_id = v.vehicle_id
                AND r.status IN ('BOOKED', 'ISSUED')
                AND %s < r.planned_return
                AND %s > r.planned_pickup)
          AND NOT EXISTS (
              SELECT 1 FROM Reservation r
              WHERE r.vehicle_id = v.vehicle_id
                AND r.status = 'ISSUED'
                AND r.planned_return < NOW())
        """
        params += [pickup, ret]
    query += " ORDER BY vc.base_daily_rate DESC, v.model_name"
    return jsonify(fetch_all(query, params))


# ---------------------------------------------------------------- reservations
RESERVATION_SELECT = """
    SELECT r.reservation_id, r.status, r.booking_date, r.planned_pickup, r.planned_return,
           r.customer_id, c.full_name AS customer_name, c.phone AS customer_phone,
           r.vehicle_id, v.registration_no, v.model_name, v.odometer_km, v.status AS vehicle_status,
           r.branch_id, b.branch_name, r.rate_plan_id, rp.plan_name, rp.daily_rate,
           rt.rental_id, rt.status AS rental_status, rt.actual_pickup_dt, rt.actual_return_dt,
           rt.pickup_odometer
    FROM Reservation r
    JOIN Customer c ON c.customer_id = r.customer_id
    JOIN Vehicle v  ON v.vehicle_id = r.vehicle_id
    JOIN Branch b   ON b.branch_id = r.branch_id
    JOIN RatePlan rp ON rp.rate_plan_id = r.rate_plan_id
    LEFT JOIN Rental rt ON rt.reservation_id = r.reservation_id
"""


def _get_reservation(reservation_id):
    row = fetch_one(RESERVATION_SELECT + " WHERE r.reservation_id = %s", (reservation_id,))
    if not row:
        raise ApiError("Reservation not found.", 404, "not_found")
    return row


@bp.get("/reservations")
def list_reservations():
    query = RESERVATION_SELECT
    params = []
    status = request.args.get("status")
    if status:
        statuses = [s.strip().upper() for s in status.split(",") if s.strip()]
        query += " WHERE r.status IN (" + ",".join(["%s"] * len(statuses)) + ")"
        params += statuses
    return jsonify(fetch_all(query + " ORDER BY r.reservation_id DESC", params))


@bp.get("/reservations/<int:reservation_id>")
def get_reservation(reservation_id):
    return jsonify(_get_reservation(reservation_id))


@bp.post("/reservations")
def create_reservation():
    data = v.body(request)
    customer_id = v.integer(data, "customer_id", "Customer")
    vehicle_id = v.integer(data, "vehicle_id", "Vehicle")
    rate_plan_id = v.integer(data, "rate_plan_id", "Rate plan")
    branch_id = v.integer(data, "branch_id", "Branch", required=False)
    pickup = v.parse_datetime(data.get("planned_pickup"), "Pickup")
    ret = v.parse_datetime(data.get("planned_return"), "Return")
    if ret <= pickup:
        raise ApiError("Return must be after pickup.")

    with transaction() as cur:
        cur.execute("SELECT customer_id FROM Customer WHERE customer_id=%s", (customer_id,))
        if not cur.fetchone():
            raise ApiError("Customer not found.", 404, "not_found")

        cur.execute("SELECT vehicle_id, category_id, branch_id, status, model_name FROM Vehicle WHERE vehicle_id=%s",
                    (vehicle_id,))
        vehicle = cur.fetchone()
        if not vehicle:
            raise ApiError("Vehicle not found.", 404, "not_found")
        if vehicle["status"] in BLOCKED_STATUSES:
            raise ApiError(f"{vehicle['model_name']} is in {vehicle['status'].lower()} and cannot be reserved.", 409,
                           "business_rule")

        cur.execute("SELECT category_id, plan_name FROM RatePlan WHERE rate_plan_id=%s", (rate_plan_id,))
        plan = cur.fetchone()
        if not plan:
            raise ApiError("Rate plan not found.", 404, "not_found")
        if plan["category_id"] != vehicle["category_id"]:
            raise ApiError("The selected rate plan does not belong to this vehicle's category.", 400, "business_rule")

        if branch_id is None:
            branch_id = vehicle["branch_id"]
        cur.execute("SELECT branch_id FROM Branch WHERE branch_id=%s", (branch_id,))
        if not cur.fetchone():
            raise ApiError("Branch not found.", 404, "not_found")

        # Overlap and licence-expiry rules are enforced by the DB triggers;
        # their SQLSTATE 45000 messages are returned to the client verbatim.
        cur.execute("""INSERT INTO Reservation (customer_id, vehicle_id, branch_id, rate_plan_id,
                       planned_pickup, planned_return) VALUES (%s,%s,%s,%s,%s,%s)""",
                    (customer_id, vehicle_id, branch_id, rate_plan_id, pickup, ret))
        new_id = cur.lastrowid
    return jsonify(_get_reservation(new_id)), 201


@bp.post("/reservations/<int:reservation_id>/cancel")
def cancel_reservation(reservation_id):
    with transaction() as cur:
        cur.execute("SELECT status FROM Reservation WHERE reservation_id=%s FOR UPDATE", (reservation_id,))
        row = cur.fetchone()
        if not row:
            raise ApiError("Reservation not found.", 404, "not_found")
        if row["status"] != "BOOKED":
            raise ApiError(f"Only BOOKED reservations can be cancelled (this one is {row['status']}).", 409,
                           "business_rule")
        cur.execute("UPDATE Reservation SET status='CANCELLED' WHERE reservation_id=%s", (reservation_id,))
    return jsonify(_get_reservation(reservation_id))


# ---------------------------------------------------------------- issue (pickup)
@bp.post("/reservations/<int:reservation_id>/issue")
def issue_vehicle(reservation_id):
    data = v.body(request)
    odometer = v.integer(data, "pickup_odometer", "Pickup odometer", min_value=0)
    fuel = v.integer(data, "fuel_level_pct", "Fuel level", min_value=0, max_value=100)
    inspected_by = v.text(data, "inspected_by", "Inspected by", required=False, max_len=40) or "Staff"
    notes = v.text(data, "condition_notes", "Condition notes", required=False, max_len=200)
    pickup_dt = v.parse_datetime(data.get("actual_pickup_dt"), "Pickup time", required=False) or \
        datetime.now().replace(microsecond=0)

    with transaction() as cur:
        cur.execute("""SELECT r.status, r.vehicle_id, v.status AS vehicle_status, v.odometer_km, v.model_name
                       FROM Reservation r JOIN Vehicle v ON v.vehicle_id = r.vehicle_id
                       WHERE r.reservation_id=%s FOR UPDATE""", (reservation_id,))
        res = cur.fetchone()
        if not res:
            raise ApiError("Reservation not found.", 404, "not_found")
        if res["status"] != "BOOKED":
            raise ApiError(f"Only BOOKED reservations can be issued (this one is {res['status']}).", 409,
                           "business_rule")
        if res["vehicle_status"] in BLOCKED_STATUSES:
            raise ApiError(f"{res['model_name']} is in {res['vehicle_status'].lower()} and cannot be issued.", 409,
                           "business_rule")
        if res["vehicle_status"] == "RENTED":
            raise ApiError(f"{res['model_name']} is still out on another rental.", 409, "business_rule")
        if odometer < res["odometer_km"]:
            raise ApiError(f"Pickup odometer cannot be below the recorded {res['odometer_km']} km.")

        cur.execute("INSERT INTO Rental (reservation_id) VALUES (%s)", (reservation_id,))
        rental_id = cur.lastrowid
        # This UPDATE fires trg_vehicle_status_on_pickup -> Vehicle becomes RENTED.
        cur.execute("UPDATE Rental SET actual_pickup_dt=%s, pickup_odometer=%s WHERE rental_id=%s",
                    (pickup_dt, odometer, rental_id))
        cur.execute("""INSERT INTO Inspection (rental_id, inspection_type, odometer_reading, fuel_level_pct,
                       condition_notes, inspected_by) VALUES (%s, 'PICKUP', %s, %s, %s, %s)""",
                    (rental_id, odometer, fuel, notes, inspected_by))
        inspection_id = cur.lastrowid
        cur.execute("INSERT INTO FuelReading (inspection_id, fuel_level_pct) VALUES (%s, %s)", (inspection_id, fuel))
        cur.execute("UPDATE Reservation SET status='ISSUED' WHERE reservation_id=%s", (reservation_id,))

    return jsonify({"rental_id": rental_id, "inspection_id": inspection_id,
                    "reservation": _get_reservation(reservation_id)}), 201


# ---------------------------------------------------------------- rentals + return
@bp.get("/rentals")
def list_rentals():
    query = """
        SELECT rt.rental_id, rt.reservation_id, rt.status, rt.actual_pickup_dt, rt.actual_return_dt,
               rt.pickup_odometer, rt.return_odometer, r.planned_pickup, r.planned_return,
               c.full_name AS customer_name, v.registration_no, v.model_name,
               rp.plan_name, rp.daily_rate, rp.extra_km_rate, rp.late_fee_per_hour,
               (rt.actual_return_dt IS NULL AND r.planned_return < NOW()) AS is_overdue,
               inv.invoice_id
        FROM Rental rt
        JOIN Reservation r ON r.reservation_id = rt.reservation_id
        JOIN Customer c ON c.customer_id = r.customer_id
        JOIN Vehicle v ON v.vehicle_id = r.vehicle_id
        JOIN RatePlan rp ON rp.rate_plan_id = r.rate_plan_id
        LEFT JOIN Invoice inv ON inv.rental_id = rt.rental_id
    """
    if request.args.get("open") == "1":
        query += " WHERE rt.actual_return_dt IS NULL AND rt.actual_pickup_dt IS NOT NULL"
    return jsonify(fetch_all(query + " ORDER BY rt.rental_id DESC"))


@bp.post("/rentals/<int:rental_id>/return")
def return_vehicle(rental_id):
    data = v.body(request)
    odometer = v.integer(data, "return_odometer", "Return odometer", min_value=0)
    fuel = v.integer(data, "fuel_level_pct", "Fuel level", min_value=0, max_value=100)
    inspected_by = v.text(data, "inspected_by", "Inspected by", required=False, max_len=40) or "Staff"
    notes = v.text(data, "condition_notes", "Condition notes", required=False, max_len=200)
    return_dt = v.parse_datetime(data.get("actual_return_dt"), "Return time", required=False) or \
        datetime.now().replace(microsecond=0)

    damages = []
    raw_damages = data.get("damages")
    if raw_damages is None and (data.get("damage_description") or data.get("damage_cost")):
        raw_damages = [{"description": data.get("damage_description"), "repair_cost": data.get("damage_cost")}]
    for i, item in enumerate(raw_damages or []):
        if not isinstance(item, dict):
            raise ApiError("Each damage must be an object.")
        desc = v.text(item, "description", f"Damage {i + 1} description", max_len=200)
        cost = v.money(item, "repair_cost", f"Damage {i + 1} repair cost")
        damages.append((desc, cost))

    with transaction() as cur:
        cur.execute("""
            SELECT rt.reservation_id, rt.status, rt.actual_pickup_dt, rt.actual_return_dt, rt.pickup_odometer,
                   r.planned_return, rp.daily_rate, rp.extra_km_rate, rp.late_fee_per_hour
            FROM Rental rt
            JOIN Reservation r ON r.reservation_id = rt.reservation_id
            JOIN RatePlan rp ON rp.rate_plan_id = r.rate_plan_id
            WHERE rt.rental_id = %s FOR UPDATE""", (rental_id,))
        rental = cur.fetchone()
        if not rental:
            raise ApiError("Rental not found.", 404, "not_found")
        if rental["actual_return_dt"] is not None or rental["status"] == "RETURNED":
            raise ApiError("This rental has already been returned.", 409, "business_rule")
        if rental["actual_pickup_dt"] is None:
            raise ApiError("This rental was never issued.", 409, "business_rule")
        if odometer < rental["pickup_odometer"]:
            raise ApiError(f"Return odometer cannot be lower than the pickup reading of "
                           f"{rental['pickup_odometer']} km.")
        if return_dt <= rental["actual_pickup_dt"]:
            raise ApiError("Return time must be after the pickup time.")

        # Fires trg_vehicle_status_on_pickup -> Vehicle becomes AVAILABLE with the new odometer.
        cur.execute("""UPDATE Rental SET actual_return_dt=%s, return_odometer=%s, status='RETURNED'
                       WHERE rental_id=%s""", (return_dt, odometer, rental_id))
        cur.execute("""INSERT INTO Inspection (rental_id, inspection_type, odometer_reading, fuel_level_pct,
                       condition_notes, inspected_by) VALUES (%s, 'RETURN', %s, %s, %s, %s)""",
                    (rental_id, odometer, fuel, notes, inspected_by))
        inspection_id = cur.lastrowid
        cur.execute("INSERT INTO FuelReading (inspection_id, fuel_level_pct) VALUES (%s, %s)", (inspection_id, fuel))

        damage_total = Decimal("0")
        damage_ids = []
        for desc, cost in damages:
            cur.execute("INSERT INTO Damage (inspection_id, description, repair_cost) VALUES (%s, %s, %s)",
                        (inspection_id, desc, cost))
            damage_ids.append(cur.lastrowid)
            damage_total += cost

        bill = compute_invoice(
            rental["actual_pickup_dt"], return_dt, rental["planned_return"],
            rental["pickup_odometer"], odometer,
            rental["daily_rate"], rental["extra_km_rate"], rental["late_fee_per_hour"], damage_total,
        )
        cur.execute("""INSERT INTO Invoice (rental_id, rental_charges, extra_km_charges, late_fee,
                       damage_charges, tax_amount, total_amount) VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                    (rental_id, bill["rental_charges"], bill["extra_km_charges"], bill["late_fee"],
                     bill["damage_charges"], bill["tax_amount"], bill["total_amount"]))
        invoice_id = cur.lastrowid
        cur.execute("UPDATE Reservation SET status='COMPLETED' WHERE reservation_id=%s", (rental["reservation_id"],))

    return jsonify({
        "rental_id": rental_id,
        "inspection_id": inspection_id,
        "damage_ids": damage_ids,
        "invoice_id": invoice_id,
        "actual_pickup_dt": rental["actual_pickup_dt"],
        "actual_return_dt": return_dt,
        "planned_return": rental["planned_return"],
        "invoice": bill,
    }), 201


# ---------------------------------------------------------------- invoices + payments
INVOICE_SELECT = """
    SELECT inv.*, COALESCE(p.paid, 0) AS amount_paid, inv.total_amount - COALESCE(p.paid, 0) AS balance,
           c.full_name AS customer_name, v.registration_no, v.model_name, b.branch_name
    FROM Invoice inv
    JOIN Rental rt ON rt.rental_id = inv.rental_id
    JOIN Reservation r ON r.reservation_id = rt.reservation_id
    JOIN Customer c ON c.customer_id = r.customer_id
    JOIN Vehicle v ON v.vehicle_id = r.vehicle_id
    JOIN Branch b ON b.branch_id = r.branch_id
    LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM Payment GROUP BY invoice_id) p
           ON p.invoice_id = inv.invoice_id
"""


@bp.get("/invoices")
def list_invoices():
    query = INVOICE_SELECT
    if request.args.get("unpaid") == "1":
        query += " WHERE inv.status <> 'PAID'"
    return jsonify(fetch_all(query + " ORDER BY inv.invoice_id DESC"))


@bp.get("/invoices/<int:invoice_id>")
def get_invoice(invoice_id):
    row = fetch_one(INVOICE_SELECT + " WHERE inv.invoice_id = %s", (invoice_id,))
    if not row:
        raise ApiError("Invoice not found.", 404, "not_found")
    row["payments"] = fetch_all("SELECT * FROM Payment WHERE invoice_id=%s ORDER BY payment_date", (invoice_id,))
    return jsonify(row)


@bp.post("/invoices/<int:invoice_id>/payments")
def record_payment(invoice_id):
    data = v.body(request)
    amount = v.money(data, "amount", "Amount", allow_zero=False)
    mode = v.choice(data, "payment_mode", "Payment mode", v.PAYMENT_MODES)

    with transaction() as cur:
        cur.execute("SELECT total_amount, status FROM Invoice WHERE invoice_id=%s FOR UPDATE", (invoice_id,))
        inv = cur.fetchone()
        if not inv:
            raise ApiError("Invoice not found.", 404, "not_found")
        cur.execute("SELECT COALESCE(SUM(amount), 0) AS paid FROM Payment WHERE invoice_id=%s", (invoice_id,))
        paid = Decimal(cur.fetchone()["paid"])
        balance = Decimal(inv["total_amount"]) - paid
        if balance <= 0:
            raise ApiError("This invoice is already fully paid.", 409, "business_rule")
        if amount > balance:
            raise ApiError(f"Amount exceeds the outstanding balance of {balance:.2f}.")

        cur.execute("INSERT INTO Payment (invoice_id, amount, payment_mode) VALUES (%s, %s, %s)",
                    (invoice_id, amount, mode))
        payment_id = cur.lastrowid
        new_status = "PAID" if paid + amount >= Decimal(inv["total_amount"]) else "PARTIAL"
        cur.execute("UPDATE Invoice SET status=%s WHERE invoice_id=%s", (new_status, invoice_id))

    result = get_invoice(invoice_id).get_json()
    result["payment_id"] = payment_id
    return jsonify(result), 201
