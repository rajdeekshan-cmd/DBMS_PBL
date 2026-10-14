"""
db.py
Connection + transaction helpers and MySQL error translation.

Fixes over the old Tkinter helper:
- A multi-step flow gets ONE connection and ONE transaction (see `transaction`),
  so cursor.lastrowid is valid and a failure rolls back every step.
- Errors are never swallowed; they are raised as ApiError with a clean message.
"""

import os
import re
from contextlib import contextmanager

import mysql.connector
from mysql.connector import errorcode
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "car_rental_db"),
}

TRIGGER_MSG = re.compile(r"\(45000\):\s*(.*)")


class ApiError(Exception):
    """An error that is safe to show to the user as JSON."""

    def __init__(self, message, status=400, kind="validation"):
        super().__init__(message)
        self.message = message
        self.status = status
        self.kind = kind


# Friendly names for UNIQUE keys and CHECK constraints defined in 01_schema.sql
DUPLICATE_KEYS = {
    "registration_no": "A vehicle with this registration number already exists.",
    "phone": "A customer with this phone number already exists.",
    "email": "A customer with this email already exists.",
    "license_number": "A customer with this licence number already exists.",
    "reservation_id": "This reservation has already been issued.",
    "rental_id": "An invoice already exists for this rental.",
    "uq_inspection_type_per_rental": "This inspection has already been recorded.",
}

CHECK_MESSAGES = {
    "chk_vehicle_odometer": "Odometer cannot be negative.",
    "chk_vehicle_year": "Manufacture year must be between 1990 and 2100.",
    "chk_res_dates": "Return must be after pickup.",
    "chk_rental_dates": "Return time must be after the pickup time.",
    "chk_rental_odometer": "Return odometer cannot be lower than the pickup odometer.",
    "chk_inspection_fuel": "Fuel level must be between 0 and 100.",
    "chk_fuel_pct": "Fuel level must be between 0 and 100.",
    "chk_damage_cost": "Repair cost cannot be negative.",
    "chk_payment_amount": "Payment amount must be greater than zero.",
}


def translate_mysql_error(err):
    """Map a mysql.connector.Error to an ApiError with a user-facing message."""
    text = str(err)
    match = TRIGGER_MSG.search(text)
    if match:
        return ApiError(match.group(1).strip(), 409, "business_rule")

    errno = getattr(err, "errno", None)
    if errno == errorcode.ER_ROW_IS_REFERENCED_2 or errno == errorcode.ER_ROW_IS_REFERENCED:
        return ApiError(
            "This record is linked to reservations or rentals and cannot be changed or deleted.",
            409, "reference",
        )
    if errno == errorcode.ER_NO_REFERENCED_ROW_2 or errno == errorcode.ER_NO_REFERENCED_ROW:
        return ApiError("A referenced record (category, branch, customer or plan) does not exist.", 400, "reference")
    if errno == errorcode.ER_DUP_ENTRY:
        for key, msg in DUPLICATE_KEYS.items():
            if key in text:
                return ApiError(msg, 409, "duplicate")
        return ApiError("This value already exists and must be unique.", 409, "duplicate")
    if errno == 3819:  # ER_CHECK_CONSTRAINT_VIOLATED
        for key, msg in CHECK_MESSAGES.items():
            if key in text:
                return ApiError(msg, 400, "validation")
        return ApiError("A value is outside the allowed range.", 400, "validation")
    if errno in (errorcode.CR_CONN_HOST_ERROR, errorcode.CR_CONNECTION_ERROR, errorcode.ER_ACCESS_DENIED_ERROR):
        return ApiError("Database is unreachable. Check backend/.env and that MySQL is running.", 503, "database")
    return ApiError(f"Database error: {getattr(err, 'msg', text)}", 500, "database")


def get_connection():
    return mysql.connector.connect(**CONFIG)


@contextmanager
def transaction():
    """
    Yield a dictionary cursor on a single connection.
    Commits if the block finishes, rolls back on ANY exception, always closes.
    """
    try:
        conn = get_connection()
    except mysql.connector.Error as e:
        raise translate_mysql_error(e)
    conn.autocommit = False
    cursor = conn.cursor(dictionary=True)
    try:
        yield cursor
        conn.commit()
    except mysql.connector.Error as e:
        conn.rollback()
        raise translate_mysql_error(e)
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def fetch_all(query, params=None):
    with transaction() as cur:
        cur.execute(query, params or ())
        return cur.fetchall()


def fetch_one(query, params=None):
    with transaction() as cur:
        cur.execute(query, params or ())
        return cur.fetchone()
