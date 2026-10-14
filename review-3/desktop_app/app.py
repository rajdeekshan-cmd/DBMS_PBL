"""
app.py
Car Rental Reservation and Vehicle Return Management System
Front-end application (Python + Tkinter + MySQL)

Run with:  python app.py
Requires:  pip install mysql-connector-python
"""

import tkinter as tk
from tkinter import ttk, messagebox
from datetime import datetime

from db import run_query


# ================================================================
# Small reusable helpers
# ================================================================
def clear_tree(tree):
    for row in tree.get_children():
        tree.delete(row)


def fill_tree(tree, rows):
    clear_tree(tree)
    if not rows:
        return
    tree["columns"] = list(rows[0].keys())
    tree["show"] = "headings"
    for col in tree["columns"]:
        tree.heading(col, text=col)
        tree.column(col, width=110, anchor="center")
    for row in rows:
        tree.insert("", "end", values=list(row.values()))


def show_db_error(err):
    """Turn a raw MySQL error into a friendly message for the student demo."""
    if err is None:
        return
    if "45000" in err or "SIGNAL" in err.upper():
        # our custom trigger messages already contain a clear MESSAGE_TEXT
        messagebox.showerror("Business Rule Violation", err.split("MESSAGE_TEXT")[-1].strip(": '"))
    elif "foreign key constraint" in err.lower():
        messagebox.showerror("Reference Error", "This record is linked to other data and cannot be changed/deleted.")
    elif "Duplicate entry" in err:
        messagebox.showerror("Duplicate Entry", "This value already exists and must be unique.")
    else:
        messagebox.showerror("Database Error", err)


# ================================================================
# Main Application
# ================================================================
class CarRentalApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Car Rental Reservation and Vehicle Return Management System")
        self.geometry("1050x650")

        notebook = ttk.Notebook(self)
        notebook.pack(fill="both", expand=True)

        self.tab_vehicles = VehicleTab(notebook)
        self.tab_customers = CustomerTab(notebook)
        self.tab_reservation = ReservationTab(notebook)
        self.tab_rental = RentalTab(notebook)
        self.tab_reports = ReportsTab(notebook)

        notebook.add(self.tab_vehicles, text="Vehicles")
        notebook.add(self.tab_customers, text="Customers")
        notebook.add(self.tab_reservation, text="Reservation / Availability")
        notebook.add(self.tab_rental, text="Issue & Return")
        notebook.add(self.tab_reports, text="Reports")


# ================================================================
# TAB 1: VEHICLE MASTER (CRUD)
# ================================================================
class VehicleTab(ttk.Frame):
    def __init__(self, parent):
        super().__init__(parent)
        self.selected_id = None
        self._build_form()
        self._build_table()
        self.refresh()

    def _build_form(self):
        frm = ttk.LabelFrame(self, text="Vehicle Details")
        frm.pack(fill="x", padx=10, pady=8)

        labels = ["Registration No", "Category ID", "Branch ID", "Model Name", "Year", "Odometer (km)", "Status"]
        self.vars = {name: tk.StringVar() for name in labels}

        for i, name in enumerate(labels):
            ttk.Label(frm, text=name).grid(row=i // 4, column=(i % 4) * 2, sticky="w", padx=4, pady=4)
            ttk.Entry(frm, textvariable=self.vars[name], width=18).grid(row=i // 4, column=(i % 4) * 2 + 1, padx=4, pady=4)

        self.vars["Status"].set("AVAILABLE")

        btns = ttk.Frame(self)
        btns.pack(fill="x", padx=10)
        ttk.Button(btns, text="Add", command=self.add_vehicle).pack(side="left", padx=4)
        ttk.Button(btns, text="Update Selected", command=self.update_vehicle).pack(side="left", padx=4)
        ttk.Button(btns, text="Delete Selected", command=self.delete_vehicle).pack(side="left", padx=4)
        ttk.Button(btns, text="Clear Form", command=self.clear_form).pack(side="left", padx=4)
        ttk.Button(btns, text="Refresh", command=self.refresh).pack(side="left", padx=4)

    def _build_table(self):
        self.tree = ttk.Treeview(self)
        self.tree.pack(fill="both", expand=True, padx=10, pady=8)
        self.tree.bind("<<TreeviewSelect>>", self.on_select)

    def clear_form(self):
        for v in self.vars.values():
            v.set("")
        self.vars["Status"].set("AVAILABLE")
        self.selected_id = None

    def validate_form(self):
        reg = self.vars["Registration No"].get().strip()
        if not reg:
            messagebox.showwarning("Validation", "Registration number is required.")
            return False
        for field in ["Category ID", "Branch ID", "Year", "Odometer (km)"]:
            val = self.vars[field].get().strip()
            if not val.isdigit():
                messagebox.showwarning("Validation", f"{field} must be a whole number.")
                return False
        return True

    def add_vehicle(self):
        if not self.validate_form():
            return
        q = """INSERT INTO Vehicle
               (registration_no, category_id, branch_id, model_name, manufacture_year, odometer_km, status)
               VALUES (%s, %s, %s, %s, %s, %s, %s)"""
        params = (
            self.vars["Registration No"].get().strip(),
            int(self.vars["Category ID"].get()),
            int(self.vars["Branch ID"].get()),
            self.vars["Model Name"].get().strip(),
            int(self.vars["Year"].get()),
            int(self.vars["Odometer (km)"].get()),
            self.vars["Status"].get().strip() or "AVAILABLE",
        )
        _, err = run_query(q, params, commit=True)
        if err:
            show_db_error(err)
            return
        messagebox.showinfo("Success", "Vehicle added.")
        self.clear_form()
        self.refresh()

    def update_vehicle(self):
        if self.selected_id is None:
            messagebox.showwarning("Select Row", "Select a vehicle from the table first.")
            return
        if not self.validate_form():
            return
        q = """UPDATE Vehicle SET registration_no=%s, category_id=%s, branch_id=%s,
               model_name=%s, manufacture_year=%s, odometer_km=%s, status=%s
               WHERE vehicle_id=%s"""
        params = (
            self.vars["Registration No"].get().strip(),
            int(self.vars["Category ID"].get()),
            int(self.vars["Branch ID"].get()),
            self.vars["Model Name"].get().strip(),
            int(self.vars["Year"].get()),
            int(self.vars["Odometer (km)"].get()),
            self.vars["Status"].get().strip(),
            self.selected_id,
        )
        _, err = run_query(q, params, commit=True)
        if err:
            show_db_error(err)
            return
        messagebox.showinfo("Success", "Vehicle updated.")
        self.clear_form()
        self.refresh()

    def delete_vehicle(self):
        if self.selected_id is None:
            messagebox.showwarning("Select Row", "Select a vehicle from the table first.")
            return
        if not messagebox.askyesno("Confirm", "Delete this vehicle?"):
            return
        _, err = run_query("DELETE FROM Vehicle WHERE vehicle_id=%s", (self.selected_id,), commit=True)
        if err:
            show_db_error(err)
            return
        self.clear_form()
        self.refresh()

    def on_select(self, _event):
        sel = self.tree.selection()
        if not sel:
            return
        values = self.tree.item(sel[0])["values"]
        cols = self.tree["columns"]
        row = dict(zip(cols, values))
        self.selected_id = row.get("vehicle_id")
        self.vars["Registration No"].set(row.get("registration_no", ""))
        self.vars["Category ID"].set(row.get("category_id", ""))
        self.vars["Branch ID"].set(row.get("branch_id", ""))
        self.vars["Model Name"].set(row.get("model_name", ""))
        self.vars["Year"].set(row.get("manufacture_year", ""))
        self.vars["Odometer (km)"].set(row.get("odometer_km", ""))
        self.vars["Status"].set(row.get("status", ""))

    def refresh(self):
        rows, err = run_query("SELECT * FROM Vehicle ORDER BY vehicle_id", fetch=True)
        if err:
            show_db_error(err)
            return
        fill_tree(self.tree, rows)


# ================================================================
# TAB 2: CUSTOMER MASTER (CRUD)
# ================================================================
class CustomerTab(ttk.Frame):
    def __init__(self, parent):
        super().__init__(parent)
        self.selected_id = None
        self._build_form()
        self._build_table()
        self.refresh()

    def _build_form(self):
        frm = ttk.LabelFrame(self, text="Customer Details")
        frm.pack(fill="x", padx=10, pady=8)
        labels = ["Full Name", "Phone", "Email", "License Number", "License Expiry (YYYY-MM-DD)", "Address"]
        self.vars = {name: tk.StringVar() for name in labels}
        for i, name in enumerate(labels):
            ttk.Label(frm, text=name).grid(row=i // 3, column=(i % 3) * 2, sticky="w", padx=4, pady=4)
            ttk.Entry(frm, textvariable=self.vars[name], width=22).grid(row=i // 3, column=(i % 3) * 2 + 1, padx=4, pady=4)

        btns = ttk.Frame(self)
        btns.pack(fill="x", padx=10)
        ttk.Button(btns, text="Add", command=self.add_customer).pack(side="left", padx=4)
        ttk.Button(btns, text="Update Selected", command=self.update_customer).pack(side="left", padx=4)
        ttk.Button(btns, text="Delete Selected", command=self.delete_customer).pack(side="left", padx=4)
        ttk.Button(btns, text="Clear Form", command=self.clear_form).pack(side="left", padx=4)
        ttk.Button(btns, text="Refresh", command=self.refresh).pack(side="left", padx=4)

    def _build_table(self):
        self.tree = ttk.Treeview(self)
        self.tree.pack(fill="both", expand=True, padx=10, pady=8)
        self.tree.bind("<<TreeviewSelect>>", self.on_select)

    def clear_form(self):
        for v in self.vars.values():
            v.set("")
        self.selected_id = None

    def validate_form(self):
        if not self.vars["Full Name"].get().strip():
            messagebox.showwarning("Validation", "Full name is required.")
            return False
        if not self.vars["Phone"].get().strip().isdigit():
            messagebox.showwarning("Validation", "Phone must contain digits only.")
            return False
        if not self.vars["License Number"].get().strip():
            messagebox.showwarning("Validation", "License number is required.")
            return False
        try:
            datetime.strptime(self.vars["License Expiry (YYYY-MM-DD)"].get().strip(), "%Y-%m-%d")
        except ValueError:
            messagebox.showwarning("Validation", "License expiry must be in YYYY-MM-DD format.")
            return False
        return True

    def add_customer(self):
        if not self.validate_form():
            return
        q = """INSERT INTO Customer (full_name, phone, email, license_number, license_expiry, address)
               VALUES (%s, %s, %s, %s, %s, %s)"""
        params = (
            self.vars["Full Name"].get().strip(),
            self.vars["Phone"].get().strip(),
            self.vars["Email"].get().strip() or None,
            self.vars["License Number"].get().strip(),
            self.vars["License Expiry (YYYY-MM-DD)"].get().strip(),
            self.vars["Address"].get().strip(),
        )
        _, err = run_query(q, params, commit=True)
        if err:
            show_db_error(err)
            return
        messagebox.showinfo("Success", "Customer added.")
        self.clear_form()
        self.refresh()

    def update_customer(self):
        if self.selected_id is None:
            messagebox.showwarning("Select Row", "Select a customer from the table first.")
            return
        if not self.validate_form():
            return
        q = """UPDATE Customer SET full_name=%s, phone=%s, email=%s, license_number=%s,
               license_expiry=%s, address=%s WHERE customer_id=%s"""
        params = (
            self.vars["Full Name"].get().strip(),
            self.vars["Phone"].get().strip(),
            self.vars["Email"].get().strip() or None,
            self.vars["License Number"].get().strip(),
            self.vars["License Expiry (YYYY-MM-DD)"].get().strip(),
            self.vars["Address"].get().strip(),
            self.selected_id,
        )
        _, err = run_query(q, params, commit=True)
        if err:
            show_db_error(err)
            return
        messagebox.showinfo("Success", "Customer updated.")
        self.clear_form()
        self.refresh()

    def delete_customer(self):
        if self.selected_id is None:
            messagebox.showwarning("Select Row", "Select a customer from the table first.")
            return
        if not messagebox.askyesno("Confirm", "Delete this customer?"):
            return
        _, err = run_query("DELETE FROM Customer WHERE customer_id=%s", (self.selected_id,), commit=True)
        if err:
            show_db_error(err)
            return
        self.clear_form()
        self.refresh()

    def on_select(self, _event):
        sel = self.tree.selection()
        if not sel:
            return
        values = self.tree.item(sel[0])["values"]
        cols = self.tree["columns"]
        row = dict(zip(cols, values))
        self.selected_id = row.get("customer_id")
        self.vars["Full Name"].set(row.get("full_name", ""))
        self.vars["Phone"].set(row.get("phone", ""))
        self.vars["Email"].set(row.get("email", ""))
        self.vars["License Number"].set(row.get("license_number", ""))
        self.vars["License Expiry (YYYY-MM-DD)"].set(str(row.get("license_expiry", "")))
        self.vars["Address"].set(row.get("address", ""))

    def refresh(self):
        rows, err = run_query("SELECT * FROM Customer ORDER BY customer_id", fetch=True)
        if err:
            show_db_error(err)
            return
        fill_tree(self.tree, rows)


# ================================================================
# TAB 3: AVAILABILITY SEARCH + RESERVATION
# ================================================================
class ReservationTab(ttk.Frame):
    def __init__(self, parent):
        super().__init__(parent)
        self._build_search()
        self._build_table()
        self._build_reservation_form()

    def _build_search(self):
        frm = ttk.LabelFrame(self, text="Search Available Vehicles")
        frm.pack(fill="x", padx=10, pady=6)
        ttk.Label(frm, text="Category ID (blank = any)").grid(row=0, column=0, padx=4, pady=4)
        self.cat_filter = tk.StringVar()
        ttk.Entry(frm, textvariable=self.cat_filter, width=10).grid(row=0, column=1)
        ttk.Label(frm, text="Branch ID (blank = any)").grid(row=0, column=2, padx=4, pady=4)
        self.branch_filter = tk.StringVar()
        ttk.Entry(frm, textvariable=self.branch_filter, width=10).grid(row=0, column=3)
        ttk.Button(frm, text="Search", command=self.search_availability).grid(row=0, column=4, padx=8)

    def _build_table(self):
        self.tree = ttk.Treeview(self)
        self.tree.pack(fill="both", expand=True, padx=10, pady=6)

    def _build_reservation_form(self):
        frm = ttk.LabelFrame(self, text="Create Reservation")
        frm.pack(fill="x", padx=10, pady=6)
        labels = ["Customer ID", "Vehicle ID", "Branch ID", "Rate Plan ID",
                  "Pickup (YYYY-MM-DD HH:MM)", "Return (YYYY-MM-DD HH:MM)"]
        self.vars = {name: tk.StringVar() for name in labels}
        for i, name in enumerate(labels):
            ttk.Label(frm, text=name).grid(row=i // 3, column=(i % 3) * 2, sticky="w", padx=4, pady=4)
            ttk.Entry(frm, textvariable=self.vars[name], width=22).grid(row=i // 3, column=(i % 3) * 2 + 1, padx=4, pady=4)
        ttk.Button(frm, text="Book Reservation", command=self.book_reservation).grid(row=2, column=0, columnspan=2, pady=6)

    def search_availability(self):
        q = "SELECT * FROM vw_fleet_availability WHERE 1=1"
        params = []
        if self.cat_filter.get().strip():
            q += " AND category_name = (SELECT category_name FROM VehicleCategory WHERE category_id=%s)"
            params.append(self.cat_filter.get().strip())
        if self.branch_filter.get().strip():
            q += " AND branch_name = (SELECT branch_name FROM Branch WHERE branch_id=%s)"
            params.append(self.branch_filter.get().strip())
        rows, err = run_query(q, tuple(params), fetch=True)
        if err:
            show_db_error(err)
            return
        fill_tree(self.tree, rows)

    def validate_dates(self, pickup_str, return_str):
        try:
            pickup = datetime.strptime(pickup_str, "%Y-%m-%d %H:%M")
            ret = datetime.strptime(return_str, "%Y-%m-%d %H:%M")
        except ValueError:
            messagebox.showwarning("Validation", "Dates must be in YYYY-MM-DD HH:MM format.")
            return None, None
        if ret <= pickup:
            messagebox.showwarning("Validation", "Return date/time must be after pickup date/time.")
            return None, None
        return pickup, ret

    def book_reservation(self):
        for field in ["Customer ID", "Vehicle ID", "Branch ID", "Rate Plan ID"]:
            if not self.vars[field].get().strip().isdigit():
                messagebox.showwarning("Validation", f"{field} must be a number.")
                return
        pickup, ret = self.validate_dates(
            self.vars["Pickup (YYYY-MM-DD HH:MM)"].get().strip(),
            self.vars["Return (YYYY-MM-DD HH:MM)"].get().strip(),
        )
        if pickup is None:
            return

        q = """INSERT INTO Reservation (customer_id, vehicle_id, branch_id, rate_plan_id, planned_pickup, planned_return)
               VALUES (%s, %s, %s, %s, %s, %s)"""
        params = (
            int(self.vars["Customer ID"].get()),
            int(self.vars["Vehicle ID"].get()),
            int(self.vars["Branch ID"].get()),
            int(self.vars["Rate Plan ID"].get()),
            pickup.strftime("%Y-%m-%d %H:%M:%S"),
            ret.strftime("%Y-%m-%d %H:%M:%S"),
        )
        # Business rules (no overlap, valid license) are enforced by DB triggers.
        # We simply surface any trigger error to the user in friendly form.
        _, err = run_query(q, params, commit=True)
        if err:
            show_db_error(err)
            return
        messagebox.showinfo("Success", "Reservation booked successfully.")
        self.search_availability()


# ================================================================
# TAB 4: ISSUE (PICKUP) AND RETURN
# ================================================================
class RentalTab(ttk.Frame):
    def __init__(self, parent):
        super().__init__(parent)
        self._build_issue_form()
        self._build_return_form()

    def _build_issue_form(self):
        frm = ttk.LabelFrame(self, text="Issue Vehicle (Pickup)")
        frm.pack(fill="x", padx=10, pady=8)
        labels = ["Reservation ID", "Pickup Odometer", "Pickup Fuel % (0-100)", "Inspected By", "Condition Notes"]
        self.issue_vars = {name: tk.StringVar() for name in labels}
        for i, name in enumerate(labels):
            ttk.Label(frm, text=name).grid(row=i // 3, column=(i % 3) * 2, sticky="w", padx=4, pady=4)
            ttk.Entry(frm, textvariable=self.issue_vars[name], width=20).grid(row=i // 3, column=(i % 3) * 2 + 1, padx=4, pady=4)
        ttk.Button(frm, text="Issue Vehicle", command=self.issue_vehicle).grid(row=2, column=0, pady=6)

    def _build_return_form(self):
        frm = ttk.LabelFrame(self, text="Return Vehicle & Generate Invoice")
        frm.pack(fill="x", padx=10, pady=8)
        labels = ["Rental ID", "Return Odometer", "Return Fuel % (0-100)", "Inspected By",
                  "Condition Notes", "Damage Description (optional)", "Damage Repair Cost (optional)"]
        self.return_vars = {name: tk.StringVar() for name in labels}
        for i, name in enumerate(labels):
            ttk.Label(frm, text=name).grid(row=i // 3, column=(i % 3) * 2, sticky="w", padx=4, pady=4)
            ttk.Entry(frm, textvariable=self.return_vars[name], width=20).grid(row=i // 3, column=(i % 3) * 2 + 1, padx=4, pady=4)
        ttk.Button(frm, text="Return Vehicle & Bill", command=self.return_vehicle).grid(row=3, column=0, pady=6)

    def issue_vehicle(self):
        res_id = self.issue_vars["Reservation ID"].get().strip()
        odo = self.issue_vars["Pickup Odometer"].get().strip()
        fuel = self.issue_vars["Pickup Fuel % (0-100)"].get().strip()
        if not (res_id.isdigit() and odo.isdigit() and fuel.isdigit()):
            messagebox.showwarning("Validation", "Reservation ID, odometer and fuel must be numbers.")
            return
        if not (0 <= int(fuel) <= 100):
            messagebox.showwarning("Validation", "Fuel % must be between 0 and 100.")
            return

        # Step 1: create the Rental row for this reservation
        _, err = run_query("INSERT INTO Rental (reservation_id) VALUES (%s)", (int(res_id),), commit=True)
        if err:
            show_db_error(err)
            return

        # Step 2: fetch the new rental_id
        rows, err = run_query("SELECT rental_id FROM Rental WHERE reservation_id=%s", (int(res_id),), fetch=True)
        if err or not rows:
            show_db_error(err or "Could not read back rental_id.")
            return
        rental_id = rows[0]["rental_id"]

        # Step 3: set pickup details -> fires trigger that marks vehicle RENTED
        _, err = run_query(
            "UPDATE Rental SET actual_pickup_dt=NOW(), pickup_odometer=%s WHERE rental_id=%s",
            (int(odo), rental_id), commit=True,
        )
        if err:
            show_db_error(err)
            return

        # Step 4: record the pickup inspection + fuel reading
        _, err = run_query(
            """INSERT INTO Inspection (rental_id, inspection_type, odometer_reading, fuel_level_pct, condition_notes, inspected_by)
               VALUES (%s, 'PICKUP', %s, %s, %s, %s)""",
            (rental_id, int(odo), int(fuel),
             self.issue_vars["Condition Notes"].get().strip(),
             self.issue_vars["Inspected By"].get().strip() or "Staff"),
            commit=True,
        )
        if err:
            show_db_error(err)
            return
        insp_rows, _ = run_query("SELECT LAST_INSERT_ID() AS id", fetch=True)
        insp_id = insp_rows[0]["id"]
        run_query("INSERT INTO FuelReading (inspection_id, fuel_level_pct) VALUES (%s, %s)",
                   (insp_id, int(fuel)), commit=True)

        # Step 5: mark reservation as ISSUED
        run_query("UPDATE Reservation SET status='ISSUED' WHERE reservation_id=%s", (int(res_id),), commit=True)

        messagebox.showinfo("Success", f"Vehicle issued. Rental ID = {rental_id}")

    def return_vehicle(self):
        rental_id = self.return_vars["Rental ID"].get().strip()
        odo = self.return_vars["Return Odometer"].get().strip()
        fuel = self.return_vars["Return Fuel % (0-100)"].get().strip()
        if not (rental_id.isdigit() and odo.isdigit() and fuel.isdigit()):
            messagebox.showwarning("Validation", "Rental ID, odometer and fuel must be numbers.")
            return
        if not (0 <= int(fuel) <= 100):
            messagebox.showwarning("Validation", "Fuel % must be between 0 and 100.")
            return
        rental_id = int(rental_id)

        # Step 1: set return details -> fires trigger that marks vehicle AVAILABLE
        _, err = run_query(
            "UPDATE Rental SET actual_return_dt=NOW(), return_odometer=%s, status='RETURNED' WHERE rental_id=%s",
            (int(odo), rental_id), commit=True,
        )
        if err:
            show_db_error(err)
            return

        # Step 2: record the return inspection + fuel reading
        _, err = run_query(
            """INSERT INTO Inspection (rental_id, inspection_type, odometer_reading, fuel_level_pct, condition_notes, inspected_by)
               VALUES (%s, 'RETURN', %s, %s, %s, %s)""",
            (rental_id, int(odo), int(fuel),
             self.return_vars["Condition Notes"].get().strip(),
             self.return_vars["Inspected By"].get().strip() or "Staff"),
            commit=True,
        )
        if err:
            show_db_error(err)
            return
        insp_rows, _ = run_query("SELECT LAST_INSERT_ID() AS id", fetch=True)
        insp_id = insp_rows[0]["id"]
        run_query("INSERT INTO FuelReading (inspection_id, fuel_level_pct) VALUES (%s, %s)",
                   (insp_id, int(fuel)), commit=True)

        # Step 3: optional damage entry
        damage_cost = 0.0
        desc = self.return_vars["Damage Description (optional)"].get().strip()
        cost_str = self.return_vars["Damage Repair Cost (optional)"].get().strip()
        if desc and cost_str:
            try:
                damage_cost = float(cost_str)
            except ValueError:
                messagebox.showwarning("Validation", "Damage repair cost must be a number.")
                return
            run_query("INSERT INTO Damage (inspection_id, description, repair_cost) VALUES (%s, %s, %s)",
                       (insp_id, desc, damage_cost), commit=True)

        # Step 4: compute charges and generate invoice
        info, err = run_query(
            """SELECT r.planned_pickup, r.planned_return, rt.actual_pickup_dt, rt.actual_return_dt,
                      rt.pickup_odometer, rt.return_odometer, rp.daily_rate, rp.extra_km_rate, rp.late_fee_per_hour
               FROM Rental rt
               JOIN Reservation r ON r.reservation_id = rt.reservation_id
               JOIN RatePlan rp   ON rp.rate_plan_id = r.rate_plan_id
               WHERE rt.rental_id = %s""",
            (rental_id,), fetch=True,
        )
        if err or not info:
            show_db_error(err or "Could not compute invoice.")
            return
        row = info[0]

        days_used = max(1, (row["actual_return_dt"] - row["actual_pickup_dt"]).days + 1)
        rental_charges = float(row["daily_rate"]) * days_used

        km_used = row["return_odometer"] - row["pickup_odometer"]
        free_km_allowance = 200 * days_used
        extra_km = max(0, km_used - free_km_allowance)
        extra_km_charges = extra_km * float(row["extra_km_rate"])

        late_hours = 0
        if row["actual_return_dt"] > row["planned_return"]:
            late_hours = int((row["actual_return_dt"] - row["planned_return"]).total_seconds() // 3600)
        late_fee = late_hours * float(row["late_fee_per_hour"])

        subtotal = rental_charges + extra_km_charges + late_fee + damage_cost
        tax = round(subtotal * 0.18, 2)  # 18% GST, shown for realism
        total = round(subtotal + tax, 2)

        run_query(
            """INSERT INTO Invoice (rental_id, rental_charges, extra_km_charges, late_fee, damage_charges, tax_amount, total_amount)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (rental_id, rental_charges, extra_km_charges, late_fee, damage_cost, tax, total),
            commit=True,
        )

        messagebox.showinfo(
            "Vehicle Returned",
            f"Rental #{rental_id} closed.\n\n"
            f"Days used: {days_used}\nExtra KM charged: {extra_km}\nLate hours: {late_hours}\n"
            f"Rental charges: {rental_charges:.2f}\nExtra KM charges: {extra_km_charges:.2f}\n"
            f"Late fee: {late_fee:.2f}\nDamage charges: {damage_cost:.2f}\nTax (18%): {tax:.2f}\n"
            f"TOTAL: {total:.2f}",
        )


# ================================================================
# TAB 5: REPORTS
# ================================================================
class ReportsTab(ttk.Frame):
    REPORT_MAP = {
        "Fleet Availability": "SELECT * FROM vw_fleet_availability",
        "Overdue Rentals": "SELECT * FROM vw_overdue_rentals",
        "Vehicle Utilization": "SELECT * FROM vw_vehicle_utilization",
        "Damage Report": "SELECT * FROM vw_damage_report",
        "Branch Revenue": "SELECT * FROM vw_branch_revenue",
        "Customer History": "SELECT * FROM vw_customer_history",
    }

    def __init__(self, parent):
        super().__init__(parent)
        top = ttk.Frame(self)
        top.pack(fill="x", padx=10, pady=8)
        ttk.Label(top, text="Select Report:").pack(side="left")
        self.report_choice = tk.StringVar(value="Fleet Availability")
        combo = ttk.Combobox(top, textvariable=self.report_choice, values=list(self.REPORT_MAP.keys()), state="readonly", width=30)
        combo.pack(side="left", padx=6)
        ttk.Button(top, text="Run Report", command=self.run_report).pack(side="left", padx=6)

        self.tree = ttk.Treeview(self)
        self.tree.pack(fill="both", expand=True, padx=10, pady=8)

    def run_report(self):
        query = self.REPORT_MAP[self.report_choice.get()]
        rows, err = run_query(query, fetch=True)
        if err:
            show_db_error(err)
            return
        fill_tree(self.tree, rows)
        if not rows:
            messagebox.showinfo("Report", "No records found for this report.")


# ================================================================
if __name__ == "__main__":
    app = CarRentalApp()
    app.mainloop()
