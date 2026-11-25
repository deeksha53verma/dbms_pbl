# Rotaract Club of RVCE — Events & Activity Management System (Flask + PostgreSQL)

Full-stack DBMS project built with the existing `public/` HTML/CSS/JS frontend, **Python Flask**, and **PostgreSQL**.

## Project Structure

- `app.py` — Flask REST API & static frontend server (Werkzeug password hashing, Flask sessions + signed tokens, QR code generation & verification, RBAC, parameterized SQL queries)
- `db_pg.py` — PostgreSQL connection & transaction context manager (`psycopg2`) configured via environment variables
- `auth_utils.py` — Session/Bearer auth resolution & role-based access decorators (`@student_required`, `@board_required`)
- `database/pg_setup.sql` — Complete PostgreSQL schema, constraints, `trg_validate_ap_after_attendance` trigger, views (`v_student_activity_summary`, `v_blood_inventory`, `v_event_participation_stats`), and seeded data
- `public/` — Existing frontend UI (`index.html`, `styles.css`, `js/*.js`, `images/board/*.jpg`) integrated with Flask & QR check-in
- `tests/test_app.py` — Automated backend & security verification suite
- `requirements.txt` & `.env.example` — Python dependencies and environment template

---

## 1. Create the Database in pgAdmin 4

1. Open **pgAdmin 4** and connect to your PostgreSQL server (`localhost:5432`).
2. Right-click **Databases** → **Create** → **Database...**
   - Name: `rotaract_rvce`
   - Click **Save**.
3. Right-click `rotaract_rvce` → **Query Tool**.
4. Open `database/pg_setup.sql` and click **Execute (F5)**.
   - This creates all 14 tables, the `trg_validate_ap_after_attendance` trigger, 3 views, and initial seeded records (using Werkzeug PBKDF2-SHA256 password hashes).

*(Or from PowerShell: `psql -h localhost -p 5432 -U postgres -d rotaract_rvce -f database/pg_setup.sql`)*

---

## 2. Configure Database Connection (`.env`)

1. Copy `.env.example` to `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```
2. Edit `.env` with your PostgreSQL password and a random `FLASK_SECRET_KEY`:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=rotaract_rvce
   DB_USER=postgres
   DB_PASSWORD=your_actual_postgres_password
   FLASK_SECRET_KEY=your-random-secret-key
   FLASK_ENV=development
   PORT=5000
   ```

---

## 3. Install Dependencies & Run the Flask Application

```powershell
pip install -r requirements.txt
python app.py
```

Open **http://localhost:5000** in your browser.

---

## 4. Testing Login, Registration, QR Attendance & Activity Points

### Seeded Credentials (Local Lab Demo)
- **Student Login** (`@rvce.edu.in` required): `deeksha.cs23@rvce.edu.in` / password `rvce123`
- **Board Member Login** (College ID + Rotary Number + Password):
  - College ID: `1RV23CS001B`
  - Rotary Number: `RI-3191-101`
  - Password: `rotary123` (`Rtr. Pavana`, President)

### Recommended Verification Flow
1. **Student Registration & Login**: Register a new `@rvce.edu.in` student or sign in with `deeksha.cs23@rvce.edu.in`.
2. **Event Registration**: Open **Events**, click **Register Now** on an upcoming event (attempting to register twice returns `409 Conflict`).
3. **QR Attendance Verification**:
   - Log in as Board Member → **Attendance Sheet** → select the event → click **📷 Event QR & Verify** to view the generated PNG QR code & token.
   - Log in as the registered Student → click **📷 Scan Event QR** → scan/submit the Event QR token.
   - Unregistered students, invalid QR tokens, and duplicate scans are rejected by Flask.
4. **Activity Points & PDF Certificate**:
   - Check the student's **Activity Points** tab — points update automatically after verified `present` attendance, and **Download Official PDF** exports the Dean-signed certificate.

### Run Automated Tests
```powershell
python -m unittest discover -s tests -v
```
