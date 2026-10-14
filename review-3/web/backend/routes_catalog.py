"""Vehicles, customers, reference data and landing-page stats."""

from flask import Blueprint, jsonify, request

import validators as v
from db import ApiError, fetch_all, fetch_one, transaction

bp = Blueprint("catalog", __name__)

VEHICLE_SELECT = """
    SELECT v.vehicle_id, v.registration_no, v.category_id, vc.category_name, vc.seating_capacity,
           v.branch_id, b.branch_name, b.city, v.model_name, v.manufacture_year, v.odometer_km, v.status,
           (SELECT MIN(rp.daily_rate) FROM RatePlan rp WHERE rp.category_id = v.category_id) AS from_daily_rate
    FROM Vehicle v
    JOIN VehicleCategory vc ON vc.category_id = v.category_id
    JOIN Branch b ON b.branch_id = v.branch_id
"""


# ---------------------------------------------------------------- reference data
@bp.get("/categories")
def categories():
    return jsonify(fetch_all("SELECT * FROM VehicleCategory ORDER BY base_daily_rate"))


@bp.get("/branches")
def branches():
    return jsonify(fetch_all("SELECT * FROM Branch ORDER BY branch_id"))


@bp.get("/rate-plans")
def rate_plans():
    query = """SELECT rp.*, vc.category_name FROM RatePlan rp
               JOIN VehicleCategory vc ON vc.category_id = rp.category_id"""
    params = []
    if request.args.get("category_id"):
        query += " WHERE rp.category_id = %s"
        params.append(v.integer(request.args, "category_id", "Category"))
    return jsonify(fetch_all(query + " ORDER BY rp.category_id, rp.daily_rate", params))


@bp.get("/stats")
def stats():
    row = fetch_one("""
        SELECT (SELECT COUNT(*) FROM Vehicle WHERE status <> 'RETIRED') AS fleet_size,
               (SELECT COUNT(*) FROM Branch) AS branches,
               (SELECT COALESCE(SUM(odometer_km), 0) FROM Vehicle WHERE status <> 'RETIRED') AS fleet_km,
               (SELECT COUNT(*) FROM Customer) AS clients
    """)
    return jsonify(row)


# ---------------------------------------------------------------- vehicles
def _vehicle_payload(data):
    return (
        v.text(data, "registration_no", "Registration number", max_len=15).upper(),
        v.integer(data, "category_id", "Category"),
        v.integer(data, "branch_id", "Branch"),
        v.text(data, "model_name", "Model name", max_len=40),
        v.integer(data, "manufacture_year", "Manufacture year", min_value=1990, max_value=2100),
        v.integer(data, "odometer_km", "Odometer", min_value=0),
        v.choice(data, "status", "Status", v.VEHICLE_STATUSES, default="AVAILABLE"),
    )


@bp.get("/vehicles")
def list_vehicles():
    return jsonify(fetch_all(VEHICLE_SELECT + " ORDER BY v.vehicle_id"))


@bp.get("/vehicles/<int:vehicle_id>")
def get_vehicle(vehicle_id):
    row = fetch_one(VEHICLE_SELECT + " WHERE v.vehicle_id = %s", (vehicle_id,))
    if not row:
        raise ApiError("Vehicle not found.", 404, "not_found")
    return jsonify(row)


@bp.post("/vehicles")
def create_vehicle():
    params = _vehicle_payload(v.body(request))
    with transaction() as cur:
        cur.execute("""INSERT INTO Vehicle (registration_no, category_id, branch_id, model_name,
                       manufacture_year, odometer_km, status) VALUES (%s,%s,%s,%s,%s,%s,%s)""", params)
        new_id = cur.lastrowid
    return jsonify(fetch_one(VEHICLE_SELECT + " WHERE v.vehicle_id=%s", (new_id,))), 201


@bp.put("/vehicles/<int:vehicle_id>")
def update_vehicle(vehicle_id):
    params = _vehicle_payload(v.body(request))
    with transaction() as cur:
        cur.execute("SELECT status FROM Vehicle WHERE vehicle_id=%s FOR UPDATE", (vehicle_id,))
        current = cur.fetchone()
        if not current:
            raise ApiError("Vehicle not found.", 404, "not_found")
        new_status = params[6]
        if current["status"] == "RENTED" and new_status != "RENTED":
            raise ApiError("This vehicle is out on rental. Record its return before changing the status.", 409)
        if current["status"] != "RENTED" and new_status == "RENTED":
            raise ApiError("A vehicle becomes RENTED only by issuing it against a reservation.", 409)
        cur.execute("""UPDATE Vehicle SET registration_no=%s, category_id=%s, branch_id=%s, model_name=%s,
                       manufacture_year=%s, odometer_km=%s, status=%s WHERE vehicle_id=%s""", params + (vehicle_id,))
    return get_vehicle(vehicle_id)


@bp.delete("/vehicles/<int:vehicle_id>")
def delete_vehicle(vehicle_id):
    with transaction() as cur:
        cur.execute("DELETE FROM Vehicle WHERE vehicle_id=%s", (vehicle_id,))
        if cur.rowcount == 0:
            raise ApiError("Vehicle not found.", 404, "not_found")
    return jsonify({"deleted": vehicle_id})


# ---------------------------------------------------------------- customers
def _customer_payload(data):
    return (
        v.text(data, "full_name", "Full name", max_len=60),
        v.phone(data, "phone"),
        v.email(data, "email"),
        v.text(data, "license_number", "Licence number", max_len=20).upper(),
        v.parse_date(data.get("license_expiry"), "Licence expiry"),
        v.text(data, "address", "Address", required=False, max_len=120),
    )


@bp.get("/customers")
def list_customers():
    return jsonify(fetch_all("""
        SELECT c.*, (c.license_expiry < CURDATE()) AS license_expired,
               (SELECT COUNT(*) FROM Reservation r WHERE r.customer_id = c.customer_id) AS reservations
        FROM Customer c ORDER BY c.customer_id"""))


def _get_customer(customer_id):
    row = fetch_one("SELECT c.*, (c.license_expiry < CURDATE()) AS license_expired FROM Customer c WHERE customer_id=%s",
                    (customer_id,))
    if not row:
        raise ApiError("Customer not found.", 404, "not_found")
    return row


@bp.get("/customers/<int:customer_id>")
def get_customer(customer_id):
    return jsonify(_get_customer(customer_id))


@bp.post("/customers")
def create_customer():
    params = _customer_payload(v.body(request))
    with transaction() as cur:
        cur.execute("""INSERT INTO Customer (full_name, phone, email, license_number, license_expiry, address)
                       VALUES (%s,%s,%s,%s,%s,%s)""", params)
        new_id = cur.lastrowid
    return jsonify(_get_customer(new_id)), 201


@bp.put("/customers/<int:customer_id>")
def update_customer(customer_id):
    params = _customer_payload(v.body(request))
    with transaction() as cur:
        cur.execute("SELECT customer_id FROM Customer WHERE customer_id=%s", (customer_id,))
        if not cur.fetchone():
            raise ApiError("Customer not found.", 404, "not_found")
        cur.execute("""UPDATE Customer SET full_name=%s, phone=%s, email=%s, license_number=%s,
                       license_expiry=%s, address=%s WHERE customer_id=%s""", params + (customer_id,))
    return jsonify(_get_customer(customer_id))


@bp.delete("/customers/<int:customer_id>")
def delete_customer(customer_id):
    with transaction() as cur:
        cur.execute("DELETE FROM Customer WHERE customer_id=%s", (customer_id,))
        if cur.rowcount == 0:
            raise ApiError("Customer not found.", 404, "not_found")
    return jsonify({"deleted": customer_id})
