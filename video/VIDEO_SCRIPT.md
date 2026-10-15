# Video Script (5 minutes)

**Project 19: Car Rental Reservation and Vehicle Return Management System**  
B. Deekshan Raj · AIML Rhinos · Woxsen University · ID 25WU0102037

About 567 words, roughly 4 minutes 20 seconds of speaking plus pauses for the live demo. Slide numbers match [`review-3/Final-Presentation.pptx`](../review-3/Final-Presentation.pptx).

## Slide 1: Title (0:00 - 0:15)

Good morning. I am Bangla Deekshan Raj, roll number 25WU0102037, from AIML Rhinos. My project is a Car Rental Reservation and Vehicle Return Management System, built on a normalized MySQL database.

## Slide 2: Data dictionary (0:15 - 0:40)

The design starts with twelve tables. Branch, VehicleCategory, Vehicle and Customer are the master data. Reservation records a booking in advance. Rental records the actual pickup and return. Inspection, Damage, Invoice and Payment complete the picture, so every step from booking to payment is stored.

## Slide 3: Normalization (0:40 - 1:05)

The schema is in Third Normal Form. For example, seating and base rate live in VehicleCategory instead of being repeated on every vehicle, which removes update anomalies. Inspections are kept separate from the rental, so pickup and return are two rows and not a repeating group. Every table passes the 3NF check.

## Slide 4: Business rules (1:05 - 1:35)

Rules are enforced inside the database, not just in the application. CHECK constraints guard single rows: return after pickup, fuel between zero and one hundred, no negative amounts. Two rules need a comparison across rows: no overlapping bookings for a car, and no expired driving licence. Only triggers can do that, so they hold whichever application connects.

## Slide 5: Sample data (1:35 - 1:50)

The sample data has three branches, six vehicles, four customers and three reservations. One rental is deliberately overdue, so the overdue report has something to show.

## Slide 6: SQL queries and views (1:50 - 2:15)

The reporting layer has six views: fleet availability, overdue rentals, vehicle utilization, damages, branch revenue and customer history. They use joins and aggregates, and I also wrote nested subqueries, such as finding customers who paid more than the average invoice.

## Slide 7: Live demonstration of rules (2:15 - 2:50)

Now the proof. First, I try to book a car that is already reserved for those dates. The database rejects it with the message: overlapping reservation exists. Second, I set a customer's licence to an expired date and try to book. It is rejected again: driving licence is expired before the pickup date. These are the triggers doing their job.

## Slide 8: Architecture (2:50 - 3:10)

The application has three tiers. Branch staff use the interface. A data-access layer sends only parameterised queries, so there is no SQL injection. Below it is MySQL with the twelve tables, the views, and the triggers.

## Slide 9: Application modules (3:10 - 3:25)

My first application is a Tkinter desktop app with five modules: vehicles, customers, reservations, issue and return, and reports.

## Slide 10: Issue, return and invoice (3:25 - 3:55)

The heart of the system is issue, return and invoice. On issue, a rental is created, the pickup updates the car to rented through a trigger, and a pickup inspection is stored. On return, the car becomes available again, a return inspection and any damage are recorded, and the invoice is calculated: days used, rate, extra kilometres beyond two hundred a day, late hours, damage, plus eighteen percent tax.

## Slide 11: Web application and live demo (3:55 - 4:30)

I then built a web version, Woxsen Car Rentals, with a Flask API and a React site on the same database. It adds payments, part or full, and reservation cancellation. Every action is one transaction, so a failure rolls everything back. It is live online with no install: you can book, issue, return, see the invoice and open all six reports. For example, my test return produced a total of ten thousand seven hundred and two rupees sixty paise.

## Slide 12: Final status (4:30 - 4:50)

To summarise: the schema, triggers, sample data and views are done and tested. Both the desktop and web applications work, and the report and live demo are submitted. Next steps would be a shared online database, logins for the admin desk, and stress-testing concurrent bookings.

## Slide 13: Thank you (4:50 - 5:00)

Thank you. I am happy to take questions.
