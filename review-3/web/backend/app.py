"""
Flask REST API for the Car Rental Reservation & Vehicle Return Management System.

Run:   ./venv/bin/python app.py      (serves on http://localhost:5050/api)
Config comes from backend/.env (see .env.example).
"""

import os
from datetime import date, datetime, timedelta
from decimal import Decimal

from flask import Flask, jsonify
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from db import ApiError, fetch_one
import routes_catalog
import routes_operations
import routes_reports


class ApiJSON(DefaultJSONProvider):
    """Serialise MySQL types: DECIMAL -> number, DATETIME -> 'YYYY-MM-DDTHH:MM:SS'."""

    @staticmethod
    def default(o):
        if isinstance(o, Decimal):
            return float(o)
        if isinstance(o, datetime):
            return o.isoformat(timespec="seconds")
        if isinstance(o, date):
            return o.isoformat()
        if isinstance(o, timedelta):
            return o.total_seconds()
        return DefaultJSONProvider.default(o)


def create_app():
    app = Flask(__name__)
    app.json = ApiJSON(app)
    app.json.sort_keys = False

    origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
    CORS(app, resources={r"/api/*": {"origins": origins or "*"}})

    for module in (routes_catalog, routes_operations, routes_reports):
        app.register_blueprint(module.bp, url_prefix="/api")

    @app.get("/api/health")
    def health():
        row = fetch_one("SELECT DATABASE() AS db, NOW() AS server_time")
        return jsonify({"status": "ok", **row})

    @app.errorhandler(ApiError)
    def on_api_error(err):
        return jsonify({"error": err.message, "kind": err.kind}), err.status

    @app.errorhandler(HTTPException)
    def on_http_error(err):
        return jsonify({"error": err.description, "kind": "http"}), err.code

    @app.errorhandler(Exception)
    def on_unexpected(err):
        app.logger.exception(err)
        return jsonify({"error": "Unexpected server error.", "kind": "server"}), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("API_PORT", "5050")), debug=os.getenv("FLASK_DEBUG") == "1")
