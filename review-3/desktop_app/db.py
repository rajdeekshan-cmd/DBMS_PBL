"""
db.py
Database connection helper for the Car Rental Management System.

Edit the CONFIG dictionary below with your own MySQL credentials
before running the application.
"""

import mysql.connector
from mysql.connector import Error

CONFIG = {
    "host": "localhost",
    "user": "root",          # <-- change to your MySQL username
    "password": "YOUR_PASSWORD",  # <-- change to your MySQL password
    "database": "car_rental_db",
}


def get_connection():
    """Return a new MySQL connection. Raises mysql.connector.Error on failure."""
    return mysql.connector.connect(**CONFIG)


def run_query(query, params=None, fetch=False, commit=False):
    """
    Generic helper to run a query safely.
    - fetch=True  -> returns list of rows (dict cursor)
    - commit=True -> commits the transaction (for INSERT/UPDATE/DELETE)
    Always uses parameterised queries to prevent SQL injection.
    """
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(query, params or ())
        result = cursor.fetchall() if fetch else None
        if commit:
            conn.commit()
        return result, None
    except Error as e:
        if conn:
            conn.rollback()
        return None, str(e)
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
