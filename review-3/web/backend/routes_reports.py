"""The six reporting views from 03_queries_and_views.sql, read-only."""

from flask import Blueprint, jsonify, request

import validators as v
from db import ApiError, fetch_all

bp = Blueprint("reports", __name__)

REPORTS = {
    "fleet-availability": ("Fleet Availability", "vw_fleet_availability"),
    "overdue-rentals": ("Overdue Rentals", "vw_overdue_rentals"),
    "vehicle-utilization": ("Vehicle Utilization", "vw_vehicle_utilization"),
    "damage-report": ("Damage Report", "vw_damage_report"),
    "branch-revenue": ("Branch Revenue", "vw_branch_revenue"),
    "customer-history": ("Customer History", "vw_customer_history"),
}


@bp.get("/reports")
def list_reports():
    return jsonify([{"key": k, "title": t, "view": view} for k, (t, view) in REPORTS.items()])


@bp.get("/reports/<key>")
def run_report(key):
    if key not in REPORTS:
        raise ApiError("Unknown report.", 404, "not_found")
    title, view = REPORTS[key]
    # View names come from the fixed whitelist above, never from user input.
    query = f"SELECT * FROM {view}"
    params = []
    if key == "customer-history" and request.args.get("customer_id"):
        query += " WHERE customer_id = %s"
        params.append(v.integer(request.args, "customer_id", "Customer"))
    return jsonify({"key": key, "title": title, "rows": fetch_all(query, params)})
