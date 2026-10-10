"""Small input parsers. Each raises ApiError with a field-specific message."""

import re
from datetime import datetime, date
from decimal import Decimal, InvalidOperation

from db import ApiError

DATETIME_FORMATS = ("%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

VEHICLE_STATUSES = ("AVAILABLE", "RENTED", "MAINTENANCE", "RETIRED")
PAYMENT_MODES = ("CASH", "CARD", "UPI", "NETBANKING")


def body(request):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError("Request body must be a JSON object.")
    return data


def text(data, key, label, required=True, max_len=None):
    value = data.get(key)
    value = "" if value is None else str(value).strip()
    if required and not value:
        raise ApiError(f"{label} is required.")
    if max_len and len(value) > max_len:
        raise ApiError(f"{label} must be at most {max_len} characters.")
    return value or None


def integer(data, key, label, required=True, min_value=None, max_value=None):
    value = data.get(key)
    if value is None or str(value).strip() == "":
        if required:
            raise ApiError(f"{label} is required.")
        return None
    try:
        if isinstance(value, bool):
            raise ValueError
        number = int(str(value).strip())
    except ValueError:
        raise ApiError(f"{label} must be a whole number.")
    if min_value is not None and number < min_value:
        raise ApiError(f"{label} must be at least {min_value}.")
    if max_value is not None and number > max_value:
        raise ApiError(f"{label} must be at most {max_value}.")
    return number


def money(data, key, label, required=True, allow_zero=True):
    value = data.get(key)
    if value is None or str(value).strip() == "":
        if required:
            raise ApiError(f"{label} is required.")
        return None
    try:
        amount = Decimal(str(value).strip())
    except InvalidOperation:
        raise ApiError(f"{label} must be a number.")
    if not amount.is_finite():
        raise ApiError(f"{label} must be a number.")
    if amount < 0 or (not allow_zero and amount == 0):
        raise ApiError(f"{label} must be greater than zero." if not allow_zero else f"{label} cannot be negative.")
    return amount.quantize(Decimal("0.01"))


def parse_datetime(value, label, required=True):
    if value is None or str(value).strip() == "":
        if required:
            raise ApiError(f"{label} is required.")
        return None
    raw = str(value).strip().replace("Z", "")
    if "." in raw:
        raw = raw.split(".")[0]
    for fmt in DATETIME_FORMATS:
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    raise ApiError(f"{label} must be a date and time (YYYY-MM-DD HH:MM).")


def parse_date(value, label):
    try:
        return datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        raise ApiError(f"{label} must be a date (YYYY-MM-DD).")


def choice(data, key, label, options, default=None):
    value = (data.get(key) or default or "").strip().upper()
    if value not in options:
        raise ApiError(f"{label} must be one of: {', '.join(options)}.")
    return value


def email(data, key):
    value = text(data, key, "Email", required=False, max_len=80)
    if value and not EMAIL_RE.match(value):
        raise ApiError("Email address is not valid.")
    return value


def phone(data, key):
    value = text(data, key, "Phone", max_len=15)
    if not value.isdigit():
        raise ApiError("Phone must contain digits only.")
    return value


def today():
    return date.today()
