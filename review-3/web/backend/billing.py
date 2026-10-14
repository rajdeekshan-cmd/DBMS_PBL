"""
Invoice math, ported exactly from the original app.py:
  days_used   = max(1, (actual_return - actual_pickup).days + 1)
  rental      = daily_rate x days_used
  extra km    = max(0, km_used - 200 x days_used) x extra_km_rate
  late fee    = floor(hours after planned_return) x late_fee_per_hour
  tax         = 18% of (rental + extra km + late fee + damage)
Decimal is used instead of float so stored amounts match to the paisa.
"""

from decimal import Decimal, ROUND_HALF_UP

FREE_KM_PER_DAY = 200
TAX_RATE = Decimal("0.18")
CENT = Decimal("0.01")


def _money(value):
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def compute_invoice(actual_pickup, actual_return, planned_return,
                    pickup_odometer, return_odometer,
                    daily_rate, extra_km_rate, late_fee_per_hour, damage_cost):
    days_used = max(1, (actual_return - actual_pickup).days + 1)
    rental_charges = _money(Decimal(daily_rate) * days_used)

    km_used = return_odometer - pickup_odometer
    free_km = FREE_KM_PER_DAY * days_used
    extra_km = max(0, km_used - free_km)
    extra_km_charges = _money(Decimal(extra_km) * Decimal(extra_km_rate))

    late_hours = 0
    if actual_return > planned_return:
        late_hours = int((actual_return - planned_return).total_seconds() // 3600)
    late_fee = _money(Decimal(late_hours) * Decimal(late_fee_per_hour))

    damage_charges = _money(damage_cost)
    subtotal = rental_charges + extra_km_charges + late_fee + damage_charges
    tax = _money(subtotal * TAX_RATE)
    total = _money(subtotal + tax)

    return {
        "days_used": days_used,
        "km_used": km_used,
        "free_km": free_km,
        "extra_km": extra_km,
        "late_hours": late_hours,
        "daily_rate": _money(daily_rate),
        "extra_km_rate": _money(extra_km_rate),
        "late_fee_per_hour": _money(late_fee_per_hour),
        "rental_charges": rental_charges,
        "extra_km_charges": extra_km_charges,
        "late_fee": late_fee,
        "damage_charges": damage_charges,
        "subtotal": subtotal,
        "tax_amount": tax,
        "total_amount": total,
    }
