import base64
import io
import os
import secrets
import smtplib
import ssl
from email.message import EmailMessage
from datetime import date, datetime, timezone
from flask import Flask, jsonify, request, session, g, send_file
from werkzeug.security import generate_password_hash, check_password_hash
import psycopg2
import qrcode
from dotenv import load_dotenv

from db_pg import db_cursor
from auth_utils import (
    resolve_current_user,
    issue_auth_token,
    issue_pass_qr_token,
    verify_pass_qr_token,
    login_required,
    student_required,
    board_required,
)

load_dotenv()

app = Flask(__name__, static_folder="public", static_url_path="")
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", secrets.token_hex(32))
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"


@app.errorhandler(Exception)
def handle_api_exception(err):
    """Return clear JSON diagnostics on API errors instead of HTML 500 pages."""
    if not request.path.startswith("/api/"):
        raise err
    if isinstance(err, RuntimeError):
        return jsonify({"error": str(err)}), 503
    if isinstance(err, psycopg2.OperationalError):
        return jsonify({
            "error": f"PostgreSQL connection failed: {str(err).strip()}. Check DB_HOST, DB_PORT (5432 or 5433), DB_NAME, DB_USER, and DB_PASSWORD in .env."
        }), 503
    if isinstance(err, psycopg2.ProgrammingError) and "does not exist" in str(err):
        return jsonify({
            "error": "Database tables are missing. Execute database/pg_setup.sql in pgAdmin 4 on the rotaract_rvce database."
        }), 503
    return jsonify({"error": str(err)}), 500

VALID_EVENT_TYPES = {"blood_donation", "walkathon", "project_pustak", "fistfull", "trek", "general"}
VALID_ORG_TYPES = {"NGO", "School", "Hospital", "Blood Bank"}
VALID_BLOOD_GROUPS = {"A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"}


def _serialize_row(row):
    if row is None:
        return None
    out = {}
    for k, v in dict(row).items():
        if isinstance(v, (date, datetime)):
            out[k] = v.isoformat()
        elif hasattr(v, "__float__") and type(v).__name__ == "Decimal":
            out[k] = float(v)
        else:
            out[k] = v
    return out


def _serialize_rows(rows):
    return [_serialize_row(r) for r in rows]


def _make_qr_png_bytes(data_str):
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=2)
    qr.add_data(data_str)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1b1f4b", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def _send_otp_email(to_email, otp_code):
    """Send 6-digit OTP via SMTP if configured in .env; returns True if emailed, False if lab fallback."""
    load_dotenv(override=True)
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_pass = os.getenv("SMTP_PASSWORD", "").replace(" ", "").strip()
    if not (smtp_host and smtp_user and smtp_pass):
        return False

    smtp_port = int(os.getenv("SMTP_PORT", "587") or "587")
    smtp_from = os.getenv("SMTP_FROM", "").strip() or smtp_user
    ctx = ssl.create_default_context()

    msg = EmailMessage()
    msg["Subject"] = "Rotaract Club of RVCE — Email Verification OTP"
    msg["From"] = smtp_from
    msg["To"] = to_email
    msg.set_content(
        f"Hello,\n\n"
        f"Your 6-digit verification OTP for Rotaract Club of RVCE registration is: {otp_code}\n\n"
        f"This code expires in 10 minutes. Do not share it with anyone.\n\n"
        f"— Rotaract Club of RVCE"
    )

    if smtp_port == 465:
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=12, context=ctx) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
    else:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=12) as server:
            server.ehlo()
            server.starttls(context=ctx)
            server.ehlo()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
    return True


def _enrich_events(cur, events, student_id=None, include_qr_token=False):
    enriched = []
    for raw in events:
        ev = _serialize_row(raw)
        if not include_qr_token:
            ev.pop("qr_token", None)

        event_id = ev["event_id"]

        # Only organisations linked via event_organisation
        cur.execute(
            """
            SELECT o.org_id, o.org_id AS ngo_id, o.name, o.org_type, o.category,
                   o.contact_person, o.phone, o.email, o.address, eo.partnership_role
            FROM event_organisation eo
            JOIN organisation o ON o.org_id = eo.org_id
            WHERE eo.event_id = %s
            ORDER BY o.name ASC
            """,
            (event_id,),
        )
        ev["ngos"] = _serialize_rows(cur.fetchall())
        ev["organisations"] = ev["ngos"]

        cur.execute(
            """
            SELECT
                COUNT(r.registration_id)::INT AS registered_count,
                COUNT(CASE WHEN a.attendance_status = 'present' THEN 1 END)::INT AS present_count
            FROM registration r
            LEFT JOIN attendance a ON a.registration_id = r.registration_id
            WHERE r.event_id = %s
            """,
            (event_id,),
        )
        counts = _serialize_row(cur.fetchone())
        ev["registered_count"] = counts["registered_count"]
        ev["present_count"] = counts["present_count"]

        if student_id:
            cur.execute(
                """
                SELECT r.registration_id,
                       r.registered_at,
                       COALESCE(a.attendance_status, 'registered') AS attendance_status,
                       a.verification_method,
                       a.verified_at,
                       COALESCE(ap.points_awarded, 0) AS points_awarded
                FROM registration r
                LEFT JOIN attendance a ON a.registration_id = r.registration_id
                LEFT JOIN activity_points ap ON ap.attendance_id = a.attendance_id
                WHERE r.event_id = %s AND r.student_id = %s
                """,
                (event_id, student_id),
            )
            ev["my_registration"] = _serialize_row(cur.fetchone())
        else:
            ev["my_registration"] = None

        special = None
        etype = ev["event_type"]
        if etype == "walkathon":
            cur.execute("SELECT * FROM walkathon_detail WHERE event_id = %s", (event_id,))
            special = _serialize_row(cur.fetchone())
        elif etype == "trek":
            cur.execute("SELECT * FROM trek_detail WHERE event_id = %s", (event_id,))
            special = _serialize_row(cur.fetchone())
        elif etype == "blood_donation":
            cur.execute(
                """
                SELECT COALESCE(SUM(units_donated), 0)::INT AS total_units,
                       COUNT(*)::INT AS donor_count
                FROM blood_camp_donation WHERE event_id = %s
                """,
                (event_id,),
            )
            special = _serialize_row(cur.fetchone())
        elif etype == "project_pustak":
            cur.execute(
                """
                SELECT COALESCE(SUM(quantity), 0)::INT AS total_books,
                       COUNT(*)::INT AS donor_count
                FROM pustak_donation WHERE event_id = %s
                """,
                (event_id,),
            )
            special = _serialize_row(cur.fetchone())
        elif etype == "fistfull":
            cur.execute(
                """
                SELECT COALESCE(SUM(quantity_kg), 0) AS total_kg,
                       COUNT(*)::INT AS donor_count
                FROM fistfull_donation WHERE event_id = %s
                """,
                (event_id,),
            )
            special = _serialize_row(cur.fetchone())

        ev["special"] = special
        enriched.append(ev)
    return enriched


# ============================================================================
# STATIC FRONTEND ENTRY
# ============================================================================

@app.get("/")
def index():
    return app.send_static_file("index.html")


# ============================================================================
# AUTHENTICATION & RBAC
# ============================================================================

@app.get("/api/demo-accounts")
def demo_accounts():
    with db_cursor() as cur:
        cur.execute("SELECT usn, name, email, department, semester FROM student ORDER BY student_id LIMIT 4")
        students = _serialize_rows(cur.fetchall())
        cur.execute("SELECT college_id, rotary_number, name, designation FROM board_member ORDER BY display_order LIMIT 4")
        board = _serialize_rows(cur.fetchall())
    return jsonify({
        "students": students,
        "board": board,
        "defaultStudentPassword": "",
        "requiresPassword": True,
    })


@app.post("/api/auth/student-login")
def student_login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")

    if not email.endswith("@rvce.edu.in"):
        return jsonify({"error": "Students must sign in using their official @rvce.edu.in email ID."}), 400
    if not password:
        return jsonify({"error": "Password is required."}), 400

    with db_cursor() as cur:
        cur.execute("SELECT * FROM student WHERE lower(email) = %s", (email,))
        student = cur.fetchone()

    if not student or not check_password_hash(student["password_hash"], password):
        return jsonify({"error": "Invalid RVCE email or password."}), 401

    user = _serialize_row(student)
    user.pop("password_hash", None)

    session.clear()
    session["role"] = "student"
    session["user_id"] = user["student_id"]
    token = issue_auth_token("student", user["student_id"])
    return jsonify({"token": token, "role": "student", "user": user})


@app.post("/api/auth/send-otp")
def send_registration_otp():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email") or "").strip().lower()
    if not email.endswith("@rvce.edu.in"):
        return jsonify({"error": "OTP can only be sent to an official @rvce.edu.in email ID."}), 400

    with db_cursor() as cur:
        cur.execute("SELECT student_id FROM student WHERE lower(email) = %s", (email,))
        if cur.fetchone():
            return jsonify({"error": "This @rvce.edu.in email is already registered."}), 409

    otp_code = f"{secrets.randbelow(900000) + 100000}"
    otp_hash = generate_password_hash(otp_code, method="pbkdf2:sha256")

    with db_cursor(commit=True) as cur:
        cur.execute("DELETE FROM email_otp WHERE lower(email) = %s AND verified = FALSE", (email,))
        cur.execute(
            """
            INSERT INTO email_otp (email, otp_hash, purpose, expires_at)
            VALUES (%s, %s, 'student_register', NOW() + INTERVAL '10 minutes')
            """,
            (email, otp_hash),
        )

    smtp_error = None
    try:
        sent_via_smtp = _send_otp_email(email, otp_code)
    except Exception as exc:
        sent_via_smtp = False
        smtp_error = str(exc)
        print(f"[SMTP WARNING] Could not send OTP email to {email}: {smtp_error}")

    if sent_via_smtp:
        return jsonify({
            "ok": True,
            "delivery": "smtp",
            "message": f"6-digit OTP sent to {email}. Check your inbox (valid for 10 minutes).",
        })

    print(f"[LAB OTP] Verification OTP for {email}: {otp_code}")
    reason = f"SMTP fallback ({smtp_error})" if smtp_error else "SMTP is not configured in .env"
    return jsonify({
        "ok": True,
        "delivery": "lab_fallback",
        "dev_otp": otp_code,
        "message": f"{reason}. Lab OTP for {email}: {otp_code}",
    })


@app.post("/api/auth/student-register")
def student_register():
    data = request.get_json(silent=True) or {}
    usn = str(data.get("usn") or "").strip().upper()
    name = str(data.get("name") or "").strip()
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    otp_code = str(data.get("otp") or "").strip()
    department = str(data.get("department") or "").strip()
    phone = str(data.get("phone") or "").strip()
    blood_group = str(data.get("blood_group") or "O+").strip().upper()

    try:
        semester = int(data.get("semester") or 5)
    except (TypeError, ValueError):
        return jsonify({"error": "Semester must be a number between 1 and 8."}), 400

    if not email.endswith("@rvce.edu.in"):
        return jsonify({"error": "Email must end with @rvce.edu.in"}), 400
    if not (usn and name and password and department and phone):
        return jsonify({"error": "Please fill in all required student fields."}), 400
    if not otp_code or len(otp_code) != 6 or not otp_code.isdigit():
        return jsonify({"error": "Please enter the 6-digit Email OTP sent to your @rvce.edu.in email."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400
    if not (1 <= semester <= 8):
        return jsonify({"error": "Semester must be between 1 and 8."}), 400
    if blood_group not in VALID_BLOOD_GROUPS:
        return jsonify({"error": "Invalid blood group."}), 400

    pw_hash = generate_password_hash(password, method="pbkdf2:sha256")
    try:
        with db_cursor(commit=True) as cur:
            cur.execute(
                """
                SELECT otp_id, otp_hash, expires_at, attempts
                FROM email_otp
                WHERE lower(email) = %s AND purpose = 'student_register' AND verified = FALSE
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (email,),
            )
            otp_row = cur.fetchone()
            if not otp_row:
                return jsonify({"error": "Please click 'Send OTP' first to verify your @rvce.edu.in email."}), 400

            exp = otp_row["expires_at"]
            now_utc = datetime.now(timezone.utc) if getattr(exp, "tzinfo", None) else datetime.now()
            if isinstance(exp, datetime) and exp < now_utc:
                return jsonify({"error": "OTP has expired. Please request a new OTP."}), 400
            if otp_row["attempts"] >= 5:
                return jsonify({"error": "Too many wrong OTP attempts. Please request a new OTP."}), 429

            if not check_password_hash(otp_row["otp_hash"], otp_code):
                cur.execute("UPDATE email_otp SET attempts = attempts + 1 WHERE otp_id = %s", (otp_row["otp_id"],))
                return jsonify({"error": "Invalid 6-digit Email OTP."}), 400

            cur.execute("UPDATE email_otp SET verified = TRUE WHERE otp_id = %s", (otp_row["otp_id"],))
            cur.execute(
                """
                INSERT INTO student (usn, name, email, password_hash, department, semester, phone, blood_group)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING student_id, usn, name, email, department, semester, phone, blood_group, created_at
                """,
                (usn, name, email, pw_hash, department, semester, phone, blood_group),
            )
            user = _serialize_row(cur.fetchone())
    except psycopg2.IntegrityError:
        return jsonify({"error": "USN or @rvce.edu.in email is already registered."}), 409

    session.clear()
    session["role"] = "student"
    session["user_id"] = user["student_id"]
    token = issue_auth_token("student", user["student_id"])
    return jsonify({"token": token, "role": "student", "user": user}), 201


@app.post("/api/auth/board-login")
def board_login():
    data = request.get_json(silent=True) or {}
    college_id = str(data.get("college_id") or "").strip().upper()
    rotary_number = str(data.get("rotary_number") or "").strip().upper()
    password = str(data.get("password") or "")

    if not (college_id and rotary_number and password):
        return jsonify({"error": "College ID, Rotary Number, and Password are all required."}), 400

    with db_cursor() as cur:
        cur.execute(
            """
            SELECT * FROM board_member
            WHERE upper(college_id) = %s AND upper(rotary_number) = %s
            """,
            (college_id, rotary_number),
        )
        member = cur.fetchone()

    if not member or not check_password_hash(member["password_hash"], password):
        return jsonify({"error": "Invalid College ID, Rotary Number, or Password."}), 401

    user = _serialize_row(member)
    user.pop("password_hash", None)

    session.clear()
    session["role"] = "board"
    session["user_id"] = user["member_id"]
    token = issue_auth_token("board", user["member_id"])
    return jsonify({"token": token, "role": "board", "user": user})


@app.post("/api/auth/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/auth/me")
@login_required
def auth_me():
    return jsonify({"role": g.role, "user": _serialize_row(g.user)})


# ============================================================================
# BOARD MEMBERS & ORGANISATIONS (NGOs, Schools, Hospitals, Blood Banks)
# ============================================================================

@app.get("/api/board-members")
def list_board_members():
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT member_id, college_id, rotary_number, name, designation, portfolio,
                   photo_url, department, email, phone, tenure_year, display_order
            FROM board_member
            ORDER BY display_order ASC, member_id ASC
            """
        )
        members = _serialize_rows(cur.fetchall())
    return jsonify({"members": members})


@app.get("/api/ngos")
@app.get("/api/organisations")
def list_organisations():
    org_type = request.args.get("org_type")
    with db_cursor() as cur:
        if org_type and org_type in VALID_ORG_TYPES:
            cur.execute("SELECT *, org_id AS ngo_id FROM organisation WHERE org_type = %s ORDER BY name ASC", (org_type,))
        else:
            cur.execute("SELECT *, org_id AS ngo_id FROM organisation ORDER BY name ASC")
        orgs = _serialize_rows(cur.fetchall())

        for o in orgs:
            cur.execute(
                """
                SELECT e.event_id, e.title, e.event_type, e.status, eo.partnership_role
                FROM event_organisation eo
                JOIN event e ON e.event_id = eo.event_id
                WHERE eo.org_id = %s
                ORDER BY e.event_date DESC
                """,
                (o["org_id"],),
            )
            o["connected_events"] = _serialize_rows(cur.fetchall())
    return jsonify({"ngos": orgs, "organisations": orgs})


@app.post("/api/ngos")
@app.post("/api/organisations")
@board_required
def create_organisation():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or "").strip()
    org_type = str(data.get("org_type") or "NGO").strip()
    category = str(data.get("category") or "Community").strip()
    contact_person = str(data.get("contact_person") or "").strip()
    phone = str(data.get("phone") or "").strip()
    email = str(data.get("email") or "").strip()
    address = str(data.get("address") or "").strip()
    description = str(data.get("description") or "").strip()

    if org_type not in VALID_ORG_TYPES:
        return jsonify({"error": f"org_type must be one of {sorted(VALID_ORG_TYPES)}"}), 400
    if not (name and contact_person and phone and address):
        return jsonify({"error": "Name, contact person, phone, and address are required."}), 400

    try:
        with db_cursor(commit=True) as cur:
            cur.execute(
                """
                INSERT INTO organisation (name, org_type, category, contact_person, phone, email, address, description)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *, org_id AS ngo_id
                """,
                (name, org_type, category, contact_person, phone, email, address, description),
            )
            org = _serialize_row(cur.fetchone())
    except psycopg2.IntegrityError:
        return jsonify({"error": "An organisation with that name already exists."}), 409

    return jsonify({"ngo": org, "organisation": org}), 201


@app.delete("/api/ngos/<int:org_id>")
@app.delete("/api/organisations/<int:org_id>")
@board_required
def delete_organisation(org_id):
    with db_cursor(commit=True) as cur:
        cur.execute("DELETE FROM organisation WHERE org_id = %s RETURNING org_id", (org_id,))
        deleted = cur.fetchone()
    if not deleted:
        return jsonify({"error": "Organisation not found."}), 404
    return jsonify({"ok": True})


@app.get("/api/hospitals")
def list_hospitals_and_blood():
    role, _user = resolve_current_user()
    is_board = role == "board"

    with db_cursor() as cur:
        cur.execute(
            """
            SELECT org_id, org_id AS hospital_id, name, org_type, phone AS emergency_phone,
                   email AS blood_bank_email, address, contact_person AS urgency_contact_person
            FROM organisation
            WHERE org_type IN ('Hospital', 'Blood Bank')
            ORDER BY name ASC
            """
        )
        hospitals = _serialize_rows(cur.fetchall())

        cur.execute("SELECT * FROM v_blood_inventory ORDER BY blood_group ASC")
        inventory = _serialize_rows(cur.fetchall())

        cur.execute(
            """
            SELECT bur.*, o.name AS hospital_name, o.phone AS emergency_phone,
                   o.contact_person AS urgency_contact_person, e.title AS event_title
            FROM blood_urgency_request bur
            JOIN organisation o ON o.org_id = bur.org_id
            JOIN event e ON e.event_id = bur.event_id
            ORDER BY CASE bur.status WHEN 'pending' THEN 0 WHEN 'dispatched' THEN 1 ELSE 2 END,
                     bur.requested_at DESC
            """
        )
        requests_rows = _serialize_rows(cur.fetchall())

        if is_board:
            cur.execute(
                """
                SELECT b.*, s.name AS student_name, s.usn, s.department,
                       o.name AS hospital_name, e.title AS event_title
                FROM blood_camp_donation b
                JOIN student s ON s.student_id = b.student_id
                LEFT JOIN organisation o ON o.org_id = b.org_id
                JOIN event e ON e.event_id = b.event_id
                ORDER BY b.donated_at DESC
                """
            )
            donations = _serialize_rows(cur.fetchall())
        else:
            donations = []

    return jsonify({
        "hospitals": hospitals,
        "inventory": inventory,
        "requests": requests_rows,
        "donations": donations,
    })


# ============================================================================
# EVENTS CRUD & REGISTRATIONS
# ============================================================================

@app.get("/api/events")
def list_events():
    role, user = resolve_current_user()
    status_filter = request.args.get("status")
    student_id = user["student_id"] if role == "student" and user else None
    is_board = role == "board"

    with db_cursor() as cur:
        if status_filter in ("upcoming", "past"):
            cur.execute("SELECT * FROM event WHERE status = %s ORDER BY event_date ASC", (status_filter,))
        else:
            cur.execute(
                """
                SELECT * FROM event
                ORDER BY CASE status WHEN 'upcoming' THEN 0 ELSE 1 END, event_date ASC
                """
            )
        rows = cur.fetchall()
        events = _enrich_events(cur, rows, student_id=student_id, include_qr_token=is_board)

    return jsonify({"events": events})


@app.post("/api/events")
@board_required
def create_event():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title") or "").strip()
    event_type = str(data.get("event_type") or "general").strip()
    short_tagline = str(data.get("short_tagline") or "").strip()
    description = str(data.get("description") or "").strip()
    event_date = str(data.get("event_date") or "").strip()
    start_time = str(data.get("start_time") or "").strip()
    end_time = str(data.get("end_time") or "05:00 PM").strip()
    venue = str(data.get("venue") or "").strip()
    status = "past" if data.get("status") == "past" else "upcoming"
    poc_name = str(data.get("poc_name") or g.user["name"]).strip()
    poc_phone = str(data.get("poc_phone") or g.user["phone"]).strip()
    ngo_ids = data.get("ngo_ids") or data.get("org_ids") or []

    if event_type not in VALID_EVENT_TYPES:
        event_type = "general"

    try:
        activity_points = int(data.get("activity_points") if data.get("activity_points") is not None else (10 if event_type == "fistfull" else 20))
    except (TypeError, ValueError):
        return jsonify({"error": "Activity points must be a valid integer."}), 400

    if not (title and description and event_date and start_time and venue):
        return jsonify({"error": "Title, description, date, time, and venue are required."}), 400
    if activity_points < 0:
        return jsonify({"error": "Activity points cannot be negative."}), 400

    qr_token = f"QR-RVCE-{secrets.token_urlsafe(12)}"

    with db_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO event (
                title, event_type, short_tagline, description, event_date,
                start_time, end_time, venue, activity_points, status,
                poc_member_id, poc_name, poc_phone, qr_token, qr_active, qr_enabled_by, created_by
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, %s, %s)
            RETURNING *
            """,
            (
                title,
                event_type,
                short_tagline or description[:80],
                description,
                event_date,
                start_time,
                end_time,
                venue,
                activity_points,
                status,
                g.user["member_id"],
                poc_name,
                poc_phone,
                qr_token,
                g.user["member_id"],
                g.user["member_id"],
            ),
        )
        created = cur.fetchone()
        event_id = created["event_id"]

        if isinstance(ngo_ids, list):
            for oid in ngo_ids:
                cur.execute(
                    """
                    INSERT INTO event_organisation (event_id, org_id, partnership_role)
                    VALUES (%s, %s, 'Event Partner')
                    ON CONFLICT (event_id, org_id) DO NOTHING
                    """,
                    (event_id, int(oid)),
                )

        walkathon = data.get("walkathon")
        if event_type == "walkathon" and isinstance(walkathon, dict):
            cur.execute(
                """
                INSERT INTO walkathon_detail (event_id, route_description, distance_km, reporting_time, start_point, end_point, cause_theme)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    event_id,
                    walkathon.get("route_description") or f"{venue} Loop",
                    float(walkathon.get("distance_km") or 5),
                    walkathon.get("reporting_time") or start_time,
                    walkathon.get("start_point") or venue,
                    walkathon.get("end_point") or venue,
                    walkathon.get("cause_theme") or "Community Health & Fitness",
                ),
            )

        trek = data.get("trek")
        if event_type == "trek" and isinstance(trek, dict):
            diff = trek.get("difficulty") if trek.get("difficulty") in ("Easy", "Moderate", "Challenging") else "Moderate"
            cur.execute(
                """
                INSERT INTO trek_detail (event_id, hill_name, location_area, elevation_m, trek_distance_km, difficulty, pickup_point, departure_time, checklist)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    event_id,
                    trek.get("hill_name") or title,
                    trek.get("location_area") or "Karnataka",
                    int(trek.get("elevation_m") or 1200),
                    float(trek.get("trek_distance_km") or 6),
                    diff,
                    trek.get("pickup_point") or "RVCE Main Gate",
                    trek.get("departure_time") or start_time,
                    trek.get("checklist") or "Trekking shoes, 2L water, ID card",
                ),
            )

        [enriched] = _enrich_events(cur, [created], include_qr_token=True)

    return jsonify({"event": enriched}), 201


@app.get("/api/events/<int:event_id>")
def get_event_detail(event_id):
    role, user = resolve_current_user()
    student_id = user["student_id"] if role == "student" and user else None
    is_board = role == "board"

    with db_cursor() as cur:
        cur.execute("SELECT * FROM event WHERE event_id = %s", (event_id,))
        ev_row = cur.fetchone()
        if not ev_row:
            return jsonify({"error": "Event not found"}), 404

        [ev] = _enrich_events(cur, [ev_row], student_id=student_id, include_qr_token=is_board)

        blood_donors = []
        urgency_requests = []
        hospitals = []
        pustak_donations = []
        fistfull_donations = []

        if ev["event_type"] == "blood_donation":
            if is_board:
                cur.execute(
                    """
                    SELECT b.*, s.name AS student_name, s.usn, s.department,
                           o.name AS hospital_name, o.phone AS hospital_phone
                    FROM blood_camp_donation b
                    JOIN student s ON s.student_id = b.student_id
                    LEFT JOIN organisation o ON o.org_id = b.org_id
                    WHERE b.event_id = %s
                    ORDER BY b.donated_at DESC
                    """,
                    (event_id,),
                )
                blood_donors = _serialize_rows(cur.fetchall())

            cur.execute(
                """
                SELECT bur.*, o.name AS hospital_name, o.phone AS emergency_phone
                FROM blood_urgency_request bur
                JOIN organisation o ON o.org_id = bur.org_id
                WHERE bur.event_id = %s
                ORDER BY bur.requested_at DESC
                """,
                (event_id,),
            )
            urgency_requests = _serialize_rows(cur.fetchall())

            cur.execute(
                """
                SELECT o.org_id, o.org_id AS hospital_id, o.name, o.org_type,
                       o.phone AS emergency_phone, o.contact_person AS urgency_contact_person
                FROM event_organisation eo
                JOIN organisation o ON o.org_id = eo.org_id
                WHERE eo.event_id = %s AND o.org_type IN ('Hospital', 'Blood Bank')
                ORDER BY o.name
                """,
                (event_id,),
            )
            hospitals = _serialize_rows(cur.fetchall())

        elif ev["event_type"] == "project_pustak":
            cur.execute(
                """
                SELECT pd.*, s.name AS student_name, s.usn,
                       o.name AS ngo_name, o.phone AS ngo_phone
                FROM pustak_donation pd
                JOIN student s ON s.student_id = pd.student_id
                LEFT JOIN organisation o ON o.org_id = pd.org_id
                WHERE pd.event_id = %s
                ORDER BY pd.donated_at DESC
                """,
                (event_id,),
            )
            pustak_donations = _serialize_rows(cur.fetchall())

        elif ev["event_type"] == "fistfull":
            cur.execute(
                """
                SELECT fd.*, s.name AS student_name, s.usn,
                       o.name AS ngo_name, o.phone AS ngo_phone,
                       10 AS points_earned
                FROM fistfull_donation fd
                JOIN student s ON s.student_id = fd.student_id
                LEFT JOIN organisation o ON o.org_id = fd.org_id
                WHERE fd.event_id = %s
                ORDER BY fd.donated_at DESC
                """,
                (event_id,),
            )
            fistfull_donations = _serialize_rows(cur.fetchall())

    return jsonify({
        "event": ev,
        "blood_donors": blood_donors,
        "urgency_requests": urgency_requests,
        "hospitals": hospitals,
        "pustak_donations": pustak_donations,
        "fistfull_donations": fistfull_donations,
    })


@app.route("/api/events/<int:event_id>", methods=["PATCH", "PUT"])
@board_required
def update_event(event_id):
    data = request.get_json(silent=True) or {}
    with db_cursor(commit=True) as cur:
        cur.execute("SELECT * FROM event WHERE event_id = %s", (event_id,))
        existing = cur.fetchone()
        if not existing:
            return jsonify({"error": "Event not found"}), 404

        title = str(data.get("title") or existing["title"]).strip()
        short_tagline = str(data.get("short_tagline") or existing["short_tagline"]).strip()
        description = str(data.get("description") or existing["description"]).strip()
        event_date = str(data.get("event_date") or existing["event_date"]).strip()
        start_time = str(data.get("start_time") or existing["start_time"]).strip()
        end_time = str(data.get("end_time") or existing["end_time"]).strip()
        venue = str(data.get("venue") or existing["venue"]).strip()
        status = data.get("status") if data.get("status") in ("upcoming", "past") else existing["status"]
        poc_name = str(data.get("poc_name") or existing["poc_name"]).strip()
        poc_phone = str(data.get("poc_phone") or existing["poc_phone"]).strip()
        activity_points = int(data.get("activity_points") if data.get("activity_points") is not None else existing["activity_points"])

        cur.execute(
            """
            UPDATE event
            SET title = %s, short_tagline = %s, description = %s, event_date = %s,
                start_time = %s, end_time = %s, venue = %s, activity_points = %s,
                status = %s, poc_name = %s, poc_phone = %s
            WHERE event_id = %s
            RETURNING *
            """,
            (title, short_tagline, description, event_date, start_time, end_time, venue, activity_points, status, poc_name, poc_phone, event_id),
        )
        updated = cur.fetchone()

        if "ngo_ids" in data or "org_ids" in data:
            org_ids = data.get("ngo_ids") if "ngo_ids" in data else data.get("org_ids")
            cur.execute("DELETE FROM event_organisation WHERE event_id = %s", (event_id,))
            for oid in org_ids or []:
                cur.execute(
                    """
                    INSERT INTO event_organisation (event_id, org_id, partnership_role)
                    VALUES (%s, %s, 'Event Partner')
                    ON CONFLICT (event_id, org_id) DO NOTHING
                    """,
                    (event_id, int(oid)),
                )

        [enriched] = _enrich_events(cur, [updated], include_qr_token=True)

    return jsonify({"event": enriched})


@app.delete("/api/events/<int:event_id>")
@board_required
def delete_event(event_id):
    with db_cursor(commit=True) as cur:
        cur.execute("DELETE FROM event WHERE event_id = %s RETURNING event_id", (event_id,))
        deleted = cur.fetchone()
    if not deleted:
        return jsonify({"error": "Event not found"}), 404
    return jsonify({"ok": True})


@app.post("/api/events/<int:event_id>/register")
@student_required
def register_for_event(event_id):
    student_id = g.user["student_id"]
    try:
        with db_cursor(commit=True) as cur:
            cur.execute("SELECT event_id, status FROM event WHERE event_id = %s", (event_id,))
            ev = cur.fetchone()
            if not ev:
                return jsonify({"error": "Event not found."}), 404
            if ev["status"] != "upcoming":
                return jsonify({"error": "Registration is only open for upcoming events."}), 400

            cur.execute(
                """
                INSERT INTO registration (event_id, student_id)
                VALUES (%s, %s)
                RETURNING *
                """,
                (event_id, student_id),
            )
            reg = _serialize_row(cur.fetchone())
    except psycopg2.IntegrityError:
        return jsonify({"error": "You are already registered for this event."}), 409

    return jsonify({"registration": reg}), 201


@app.delete("/api/events/<int:event_id>/register")
@student_required
def cancel_registration(event_id):
    student_id = g.user["student_id"]
    with db_cursor(commit=True) as cur:
        cur.execute(
            """
            SELECT r.registration_id, a.attendance_id
            FROM registration r
            LEFT JOIN attendance a ON a.registration_id = r.registration_id
            WHERE r.event_id = %s AND r.student_id = %s
            """,
            (event_id, student_id),
        )
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Registration not found."}), 404
        if row["attendance_id"] is not None:
            return jsonify({"error": "Cannot cancel registration after attendance has been verified."}), 400
        cur.execute("DELETE FROM registration WHERE registration_id = %s", (row["registration_id"],))
    return jsonify({"ok": True})


# ============================================================================
# QR CODE GENERATION & ATTENDANCE VERIFICATION
# ============================================================================

@app.get("/api/events/<int:event_id>/qr")
@board_required
def get_event_qr(event_id):
    with db_cursor() as cur:
        cur.execute("SELECT event_id, title, qr_token, qr_active, activity_points FROM event WHERE event_id = %s", (event_id,))
        ev = cur.fetchone()
    if not ev:
        return jsonify({"error": "Event not found."}), 404

    buf = _make_qr_png_bytes(ev["qr_token"])
    if request.args.get("format") == "png":
        return send_file(buf, mimetype="image/png")

    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return jsonify({
        "event_id": ev["event_id"],
        "title": ev["title"],
        "qr_token": ev["qr_token"],
        "qr_active": ev["qr_active"],
        "activity_points": ev["activity_points"],
        "qr_image_data_url": f"data:image/png;base64,{b64}",
    })


@app.post("/api/events/<int:event_id>/qr/toggle")
@board_required
def toggle_event_qr(event_id):
    data = request.get_json(silent=True) or {}
    regenerate = bool(data.get("regenerate"))
    new_active = data.get("qr_active")

    with db_cursor(commit=True) as cur:
        cur.execute("SELECT qr_token, qr_active FROM event WHERE event_id = %s", (event_id,))
        ev = cur.fetchone()
        if not ev:
            return jsonify({"error": "Event not found."}), 404

        token = f"QR-RVCE-{secrets.token_urlsafe(12)}" if regenerate else ev["qr_token"]
        active = bool(new_active) if new_active is not None else ev["qr_active"]

        cur.execute(
            """
            UPDATE event
            SET qr_token = %s, qr_active = %s, qr_enabled_by = %s
            WHERE event_id = %s
            RETURNING event_id, title, qr_token, qr_active
            """,
            (token, active, g.user["member_id"], event_id),
        )
        updated = _serialize_row(cur.fetchone())

    return jsonify(updated)


@app.get("/api/events/<int:event_id>/my-pass-qr")
@student_required
def get_my_registration_pass_qr(event_id):
    student_id = g.user["student_id"]
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT r.registration_id, e.title
            FROM registration r
            JOIN event e ON e.event_id = r.event_id
            WHERE r.event_id = %s AND r.student_id = %s
            """,
            (event_id, student_id),
        )
        reg = cur.fetchone()
    if not reg:
        return jsonify({"error": "You must register for this event before generating a pass."}), 403

    pass_token = issue_pass_qr_token(reg["registration_id"], event_id, student_id)
    buf = _make_qr_png_bytes(pass_token)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return jsonify({
        "event_id": event_id,
        "title": reg["title"],
        "pass_token": pass_token,
        "qr_image_data_url": f"data:image/png;base64,{b64}",
    })


@app.post("/api/attendance/qr-checkin")
@student_required
def student_qr_checkin():
    """
    Registered student scans the board-authorised Event QR token.
    Backend strictly derives student_id from session, event_id & points from qr_token,
    and enforces registration + duplicate prevention + trigger-backed AP allocation.
    """
    data = request.get_json(silent=True) or {}
    qr_token = str(data.get("qr_token") or "").strip()
    if not qr_token:
        return jsonify({"error": "QR token is required."}), 400

    student_id = g.user["student_id"]

    with db_cursor(commit=True) as cur:
        cur.execute(
            """
            SELECT event_id, title, activity_points, qr_active, qr_enabled_by, poc_member_id, created_by
            FROM event
            WHERE qr_token = %s
            """,
            (qr_token,),
        )
        ev = cur.fetchone()
        if not ev:
            return jsonify({"error": "Invalid QR token."}), 404
        if not ev["qr_active"]:
            return jsonify({"error": "QR attendance is currently closed by the board member for this event."}), 403

        authorising_member_id = ev["qr_enabled_by"] or ev["poc_member_id"] or ev["created_by"]
        if not authorising_member_id:
            return jsonify({"error": "No board member has authorised QR check-in for this event."}), 403

        cur.execute(
            "SELECT registration_id FROM registration WHERE event_id = %s AND student_id = %s",
            (ev["event_id"], student_id),
        )
        reg = cur.fetchone()
        if not reg:
            return jsonify({"error": "You are not registered for this event. Registration is required before QR attendance."}), 403

        cur.execute("SELECT attendance_id FROM attendance WHERE registration_id = %s", (reg["registration_id"],))
        if cur.fetchone():
            return jsonify({"error": "Duplicate attendance prevented: your attendance is already recorded for this event."}), 409

        cur.execute(
            """
            INSERT INTO attendance (registration_id, attendance_status, verification_method, verified_by)
            VALUES (%s, 'present', 'qr', %s)
            RETURNING attendance_id
            """,
            (reg["registration_id"], authorising_member_id),
        )
        att_id = cur.fetchone()["attendance_id"]

        cur.execute(
            """
            INSERT INTO activity_points (attendance_id, student_id, event_id, points_awarded, awarded_by)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING point_id, points_awarded
            """,
            (att_id, student_id, ev["event_id"], ev["activity_points"], authorising_member_id),
        )
        ap = _serialize_row(cur.fetchone())

    return jsonify({
        "ok": True,
        "event_id": ev["event_id"],
        "event_title": ev["title"],
        "verification_method": "qr",
        "points_awarded": ap["points_awarded"],
    }), 201


@app.post("/api/events/<int:event_id>/attendance/qr-verify")
@board_required
def board_qr_verify_student(event_id):
    """Board member scans a student's signed registration pass QR token (or verifies by USN) via QR flow."""
    data = request.get_json(silent=True) or {}
    pass_token = str(data.get("pass_token") or "").strip()
    student_usn = str(data.get("usn") or "").strip().upper()

    with db_cursor(commit=True) as cur:
        cur.execute("SELECT event_id, title, activity_points FROM event WHERE event_id = %s", (event_id,))
        ev = cur.fetchone()
        if not ev:
            return jsonify({"error": "Event not found."}), 404

        if pass_token:
            decoded = verify_pass_qr_token(pass_token)
            if not decoded or decoded.get("event_id") != event_id:
                return jsonify({"error": "Invalid or mismatched student QR pass token."}), 400
            student_id = decoded["student_id"]
            cur.execute(
                """
                SELECT r.registration_id, s.student_id, s.name, s.usn
                FROM registration r
                JOIN student s ON s.student_id = r.student_id
                WHERE r.registration_id = %s AND r.event_id = %s AND r.student_id = %s
                """,
                (decoded["registration_id"], event_id, student_id),
            )
            reg = cur.fetchone()
        elif student_usn:
            cur.execute(
                """
                SELECT r.registration_id, s.student_id, s.name, s.usn
                FROM registration r
                JOIN student s ON s.student_id = r.student_id
                WHERE r.event_id = %s AND upper(s.usn) = %s
                """,
                (event_id, student_usn),
            )
            reg = cur.fetchone()
        else:
            return jsonify({"error": "Provide a student QR pass token or registered USN."}), 400

        if not reg:
            return jsonify({"error": "Student is not registered for this event."}), 403

        cur.execute("SELECT attendance_id FROM attendance WHERE registration_id = %s", (reg["registration_id"],))
        if cur.fetchone():
            return jsonify({"error": f"Duplicate attendance prevented: {reg['usn']} is already marked."}), 409

        cur.execute(
            """
            INSERT INTO attendance (registration_id, attendance_status, verification_method, verified_by)
            VALUES (%s, 'present', 'qr', %s)
            RETURNING attendance_id
            """,
            (reg["registration_id"], g.user["member_id"]),
        )
        att_id = cur.fetchone()["attendance_id"]

        cur.execute(
            """
            INSERT INTO activity_points (attendance_id, student_id, event_id, points_awarded, awarded_by)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (att_id, reg["student_id"], event_id, ev["activity_points"], g.user["member_id"]),
        )

    return jsonify({
        "ok": True,
        "student_name": reg["name"],
        "usn": reg["usn"],
        "verification_method": "qr",
        "points_awarded": ev["activity_points"],
    }), 201


@app.get("/api/events/<int:event_id>/attendance")
@board_required
def get_event_attendance(event_id):
    with db_cursor() as cur:
        cur.execute("SELECT * FROM event WHERE event_id = %s", (event_id,))
        ev = _serialize_row(cur.fetchone())
        if not ev:
            return jsonify({"error": "Event not found."}), 404

        cur.execute(
            """
            SELECT
                s.student_id,
                s.usn,
                s.name,
                s.email,
                s.department,
                s.semester,
                s.blood_group,
                s.phone,
                r.registration_id,
                CASE
                    WHEN r.registration_id IS NULL THEN 'not_registered'
                    ELSE COALESCE(a.attendance_status, 'registered')
                END AS attendance_status,
                a.verification_method,
                a.verified_at AS marked_at,
                COALESCE(ap.points_awarded, 0) AS points_awarded
            FROM student s
            LEFT JOIN registration r ON r.student_id = s.student_id AND r.event_id = %s
            LEFT JOIN attendance a ON a.registration_id = r.registration_id
            LEFT JOIN activity_points ap ON ap.attendance_id = a.attendance_id
            ORDER BY CASE WHEN r.registration_id IS NOT NULL THEN 0 ELSE 1 END, s.usn ASC
            """,
            (event_id,),
        )
        rows = _serialize_rows(cur.fetchall())

    return jsonify({"event": ev, "rows": rows})


@app.post("/api/events/<int:event_id>/attendance")
@board_required
def save_event_attendance(event_id):
    data = request.get_json(silent=True) or {}
    records = data.get("records")
    if not isinstance(records, list):
        return jsonify({"error": "records array is required."}), 400

    updated = 0
    with db_cursor(commit=True) as cur:
        cur.execute("SELECT event_id, activity_points FROM event WHERE event_id = %s", (event_id,))
        ev = cur.fetchone()
        if not ev:
            return jsonify({"error": "Event not found."}), 404

        for rec in records:
            status = rec.get("attendance_status")
            if status not in ("present", "absent"):
                continue
            student_id = int(rec["student_id"])

            cur.execute(
                "SELECT registration_id FROM registration WHERE event_id = %s AND student_id = %s",
                (event_id, student_id),
            )
            reg = cur.fetchone()
            if not reg:
                return jsonify({
                    "error": f"Cannot mark attendance for unregistered student_id={student_id}. Student must register first."
                }), 400

            reg_id = reg["registration_id"]
            cur.execute(
                """
                INSERT INTO attendance (registration_id, attendance_status, verification_method, verified_by, verified_at)
                VALUES (%s, %s, 'manual', %s, NOW())
                ON CONFLICT (registration_id) DO UPDATE SET
                    attendance_status = EXCLUDED.attendance_status,
                    verified_by = EXCLUDED.verified_by,
                    verified_at = NOW()
                RETURNING attendance_id
                """,
                (reg_id, status, g.user["member_id"]),
            )
            att_id = cur.fetchone()["attendance_id"]

            if status == "present":
                cur.execute(
                    """
                    INSERT INTO activity_points (attendance_id, student_id, event_id, points_awarded, awarded_by)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (attendance_id) DO UPDATE SET
                        points_awarded = EXCLUDED.points_awarded,
                        awarded_by = EXCLUDED.awarded_by,
                        awarded_at = NOW()
                    """,
                    (att_id, student_id, event_id, ev["activity_points"], g.user["member_id"]),
                )
            else:
                # Absent students must never retain activity points
                cur.execute("DELETE FROM activity_points WHERE attendance_id = %s", (att_id,))

            updated += 1

    return jsonify({"ok": True, "updated": updated})


# ============================================================================
# STUDENT ACTIVITY POINTS & CERTIFICATE DATA
# ============================================================================

@app.get("/api/student/activity-points")
@student_required
def student_activity_points():
    student_id = g.user["student_id"]
    with db_cursor() as cur:
        cur.execute("SELECT * FROM v_student_activity_summary WHERE student_id = %s", (student_id,))
        summary = _serialize_row(cur.fetchone())

        cur.execute(
            """
            SELECT
                r.registration_id,
                COALESCE(a.attendance_status, 'registered') AS attendance_status,
                a.verification_method,
                COALESCE(ap.points_awarded, 0) AS points_awarded,
                r.registered_at,
                a.verified_at AS marked_at,
                e.event_id,
                e.title,
                e.event_type,
                e.event_date,
                e.venue,
                e.activity_points AS max_points,
                e.status AS event_status,
                bm.name AS verified_by_name
            FROM registration r
            JOIN event e ON e.event_id = r.event_id
            LEFT JOIN attendance a ON a.registration_id = r.registration_id
            LEFT JOIN activity_points ap ON ap.attendance_id = a.attendance_id
            LEFT JOIN board_member bm ON bm.member_id = a.verified_by
            WHERE r.student_id = %s
            ORDER BY e.event_date DESC
            """,
            (student_id,),
        )
        records = _serialize_rows(cur.fetchall())

        cur.execute(
            """
            SELECT fd.*, o.name AS ngo_name
            FROM fistfull_donation fd
            LEFT JOIN organisation o ON o.org_id = fd.org_id
            WHERE fd.student_id = %s
            ORDER BY fd.donated_at DESC
            """,
            (student_id,),
        )
        fistfull = _serialize_rows(cur.fetchall())

        cur.execute(
            """
            SELECT pd.*, o.name AS ngo_name
            FROM pustak_donation pd
            LEFT JOIN organisation o ON o.org_id = pd.org_id
            WHERE pd.student_id = %s
            ORDER BY pd.donated_at DESC
            """,
            (student_id,),
        )
        pustak = _serialize_rows(cur.fetchall())

        cur.execute(
            """
            SELECT b.*, o.name AS hospital_name
            FROM blood_camp_donation b
            LEFT JOIN organisation o ON o.org_id = b.org_id
            WHERE b.student_id = %s
            ORDER BY b.donated_at DESC
            """,
            (student_id,),
        )
        blood = _serialize_rows(cur.fetchall())

        cur.execute("SELECT name, designation FROM board_member WHERE designation = 'President' LIMIT 1")
        pres = cur.fetchone()

    return jsonify({
        "summary": summary,
        "records": records,
        "contributions": {"fistfull": fistfull, "pustak": pustak, "blood": blood},
        "signatories": {
            "dean": "Dr. K. N. Subramanya, Dean & Principal, RVCE",
            "president": f"{pres['name']} ({pres['designation']})" if pres else "Rtr. Pavana (President)",
        },
    })


# ============================================================================
# EVENT-SPECIFIC MODULES (Blood Camp, Pustak, Fistfull)
# ============================================================================

@app.post("/api/events/<int:event_id>/fistfull")
@login_required
def record_fistfull_donation(event_id):
    data = request.get_json(silent=True) or {}
    item_type = str(data.get("item_type") or "").strip()
    if item_type not in ("rice_5kg", "toor_dal_2kg"):
        return jsonify({"error": "Item must be either rice_5kg (5 kg Rice) or toor_dal_2kg (2 kg Toor Dal)."}), 400

    qty = 5.0 if item_type == "rice_5kg" else 2.0
    org_id = int(data.get("org_id") or data.get("ngo_id") or 3)

    if g.role == "student":
        target_student_id = g.user["student_id"]
        verified_by = None
    else:
        if not data.get("student_id"):
            return jsonify({"error": "student_id is required."}), 400
        target_student_id = int(data["student_id"])
        verified_by = g.user["member_id"]

    with db_cursor(commit=True) as cur:
        cur.execute("SELECT event_id, activity_points FROM event WHERE event_id = %s", (event_id,))
        ev = cur.fetchone()
        if not ev:
            return jsonify({"error": "Event not found."}), 404

        cur.execute(
            """
            INSERT INTO fistfull_donation (event_id, student_id, item_type, quantity_kg, verified_by, org_id)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (event_id, target_student_id, item_type, qty, verified_by, org_id),
        )

        # Ensure registration exists; award points ONLY when verified by an authorised board member
        cur.execute(
            """
            INSERT INTO registration (event_id, student_id)
            VALUES (%s, %s)
            ON CONFLICT (event_id, student_id) DO NOTHING
            """,
            (event_id, target_student_id),
        )
        points_awarded = 0
        if verified_by is not None:
            cur.execute(
                "SELECT registration_id FROM registration WHERE event_id = %s AND student_id = %s",
                (event_id, target_student_id),
            )
            reg_id = cur.fetchone()["registration_id"]
            cur.execute(
                """
                INSERT INTO attendance (registration_id, attendance_status, verification_method, verified_by)
                VALUES (%s, 'present', 'manual', %s)
                ON CONFLICT (registration_id) DO UPDATE SET
                    attendance_status = 'present',
                    verified_by = EXCLUDED.verified_by,
                    verified_at = NOW()
                RETURNING attendance_id
                """,
                (reg_id, verified_by),
            )
            att_id = cur.fetchone()["attendance_id"]
            cur.execute(
                """
                INSERT INTO activity_points (attendance_id, student_id, event_id, points_awarded, awarded_by)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (attendance_id) DO UPDATE SET points_awarded = EXCLUDED.points_awarded
                """,
                (att_id, target_student_id, event_id, ev["activity_points"], verified_by),
            )
            points_awarded = ev["activity_points"]

    return jsonify({"ok": True, "points_earned": points_awarded, "verified": verified_by is not None}), 201


@app.post("/api/events/<int:event_id>/pustak")
@login_required
def record_pustak_donation(event_id):
    data = request.get_json(silent=True) or {}
    book_category = str(data.get("book_category") or "Textbooks").strip()
    target_school = str(data.get("target_school_name") or "").strip()
    org_id = int(data.get("org_id") or data.get("recipient_ngo_id") or 6)
    try:
        quantity = int(data.get("quantity") or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "Quantity must be a positive integer."}), 400

    if quantity <= 0 or not target_school:
        return jsonify({"error": "Book quantity and target school are required."}), 400

    target_student_id = g.user["student_id"] if g.role == "student" else int(data.get("student_id") or 0)
    if not target_student_id:
        return jsonify({"error": "student_id is required."}), 400

    with db_cursor(commit=True) as cur:
        cur.execute("SELECT event_id, activity_points FROM event WHERE event_id = %s", (event_id,))
        ev = cur.fetchone()
        if not ev:
            return jsonify({"error": "Event not found."}), 404

        cur.execute(
            """
            INSERT INTO pustak_donation (event_id, student_id, book_category, quantity, org_id, target_school_name)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (event_id, target_student_id, book_category, quantity, org_id, target_school),
        )
        cur.execute(
            "INSERT INTO registration (event_id, student_id) VALUES (%s, %s) ON CONFLICT (event_id, student_id) DO NOTHING",
            (event_id, target_student_id),
        )

        if g.role == "board":
            cur.execute(
                "SELECT registration_id FROM registration WHERE event_id = %s AND student_id = %s",
                (event_id, target_student_id),
            )
            reg_id = cur.fetchone()["registration_id"]
            cur.execute(
                """
                INSERT INTO attendance (registration_id, attendance_status, verification_method, verified_by)
                VALUES (%s, 'present', 'manual', %s)
                ON CONFLICT (registration_id) DO UPDATE SET attendance_status = 'present', verified_by = EXCLUDED.verified_by
                RETURNING attendance_id
                """,
                (reg_id, g.user["member_id"]),
            )
            att_id = cur.fetchone()["attendance_id"]
            cur.execute(
                """
                INSERT INTO activity_points (attendance_id, student_id, event_id, points_awarded, awarded_by)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (attendance_id) DO UPDATE SET points_awarded = EXCLUDED.points_awarded
                """,
                (att_id, target_student_id, event_id, ev["activity_points"], g.user["member_id"]),
            )

    return jsonify({"ok": True}), 201


@app.post("/api/events/<int:event_id>/blood-donation")
@board_required
def record_blood_donation(event_id):
    data = request.get_json(silent=True) or {}
    student_id = int(data.get("student_id") or 0)
    blood_group = str(data.get("blood_group") or "").strip().upper()
    units = int(data.get("units_donated") or 1)
    org_id = int(data.get("org_id") or data.get("hospital_id") or 8)

    if not student_id or blood_group not in VALID_BLOOD_GROUPS or units <= 0:
        return jsonify({"error": "Valid student, blood group, and positive units are required."}), 400

    with db_cursor(commit=True) as cur:
        cur.execute("SELECT event_id, activity_points FROM event WHERE event_id = %s", (event_id,))
        ev = cur.fetchone()
        if not ev:
            return jsonify({"error": "Event not found."}), 404

        cur.execute("SELECT phone FROM student WHERE student_id = %s", (student_id,))
        stu = cur.fetchone()
        if not stu:
            return jsonify({"error": "Student not found."}), 404

        donor_phone = str(data.get("donor_phone") or stu["phone"]).strip()
        cur.execute(
            """
            INSERT INTO blood_camp_donation (event_id, student_id, blood_group, units_donated, volume_ml, org_id, donor_phone, urgency_status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'available')
            ON CONFLICT (event_id, student_id) DO UPDATE SET
                blood_group = EXCLUDED.blood_group,
                units_donated = EXCLUDED.units_donated,
                volume_ml = EXCLUDED.volume_ml,
                org_id = EXCLUDED.org_id,
                donor_phone = EXCLUDED.donor_phone
            """,
            (event_id, student_id, blood_group, units, units * 350, org_id, donor_phone),
        )

        # Register -> Verify Attendance -> Award Activity Points inside same transaction
        cur.execute(
            "INSERT INTO registration (event_id, student_id) VALUES (%s, %s) ON CONFLICT (event_id, student_id) DO NOTHING",
            (event_id, student_id),
        )
        cur.execute("SELECT registration_id FROM registration WHERE event_id = %s AND student_id = %s", (event_id, student_id))
        reg_id = cur.fetchone()["registration_id"]
        cur.execute(
            """
            INSERT INTO attendance (registration_id, attendance_status, verification_method, verified_by)
            VALUES (%s, 'present', 'manual', %s)
            ON CONFLICT (registration_id) DO UPDATE SET attendance_status = 'present', verified_by = EXCLUDED.verified_by
            RETURNING attendance_id
            """,
            (reg_id, g.user["member_id"]),
        )
        att_id = cur.fetchone()["attendance_id"]
        cur.execute(
            """
            INSERT INTO activity_points (attendance_id, student_id, event_id, points_awarded, awarded_by)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (attendance_id) DO UPDATE SET points_awarded = EXCLUDED.points_awarded
            """,
            (att_id, student_id, event_id, ev["activity_points"], g.user["member_id"]),
        )

    return jsonify({"ok": True}), 201


@app.post("/api/blood/urgency-request")
@board_required
def create_urgency_request():
    data = request.get_json(silent=True) or {}
    org_id = int(data.get("org_id") or data.get("hospital_id") or 0)
    event_id = int(data.get("event_id") or 0)
    blood_group = str(data.get("blood_group") or "").strip().upper()
    units = int(data.get("units_requested") or 0)
    urgency_level = str(data.get("urgency_level") or "critical").strip()
    notes = str(data.get("notes") or "").strip()

    if not org_id or not event_id or blood_group not in VALID_BLOOD_GROUPS or units <= 0:
        return jsonify({"error": "Hospital/Blood Bank, event, blood group, and units are required."}), 400

    with db_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO blood_urgency_request (org_id, event_id, blood_group, units_requested, urgency_level, status, notes)
            VALUES (%s, %s, %s, %s, %s, 'pending', %s)
            RETURNING request_id
            """,
            (org_id, event_id, blood_group, units, urgency_level, notes),
        )
        req_id = cur.fetchone()["request_id"]
    return jsonify({"request_id": req_id}), 201


@app.patch("/api/blood/urgency-request/<int:req_id>")
@board_required
def dispatch_urgency_request(req_id):
    data = request.get_json(silent=True) or {}
    status = str(data.get("status") or "dispatched").strip()

    with db_cursor(commit=True) as cur:
        cur.execute("SELECT * FROM blood_urgency_request WHERE request_id = %s", (req_id,))
        urgent = cur.fetchone()
        if not urgent:
            return jsonify({"error": "Urgency request not found."}), 404

        cur.execute("UPDATE blood_urgency_request SET status = %s WHERE request_id = %s", (status, req_id))
        if status in ("dispatched", "fulfilled"):
            cur.execute(
                """
                UPDATE blood_camp_donation
                SET urgency_status = 'dispatched', org_id = %s
                WHERE donation_id IN (
                    SELECT donation_id FROM blood_camp_donation
                    WHERE blood_group = %s AND urgency_status <> 'dispatched'
                    LIMIT %s
                )
                """,
                (urgent["org_id"], urgent["blood_group"], urgent["units_requested"]),
            )
    return jsonify({"ok": True})


# ============================================================================
# BOARD DASHBOARD & DBMS REPORTS
# ============================================================================

@app.get("/api/board/dashboard")
@board_required
def board_dashboard():
    with db_cursor() as cur:
        cur.execute("SELECT COUNT(*)::INT AS cnt FROM event")
        total_events = cur.fetchone()["cnt"]
        cur.execute("SELECT COUNT(*)::INT AS cnt FROM event WHERE status = 'upcoming'")
        upcoming_events = cur.fetchone()["cnt"]
        cur.execute("SELECT COUNT(*)::INT AS cnt FROM student")
        total_students = cur.fetchone()["cnt"]
        cur.execute("SELECT COUNT(*)::INT AS cnt FROM attendance WHERE attendance_status = 'present'")
        total_participations = cur.fetchone()["cnt"]
        cur.execute("SELECT COALESCE(SUM(points_awarded), 0)::INT AS total FROM activity_points")
        total_points = cur.fetchone()["total"]
        cur.execute("SELECT COALESCE(SUM(units_donated), 0)::INT AS total FROM blood_camp_donation")
        total_blood_units = cur.fetchone()["total"]
        cur.execute("SELECT COUNT(*)::INT AS cnt FROM organisation")
        total_orgs = cur.fetchone()["cnt"]
        cur.execute("SELECT COUNT(*)::INT AS cnt FROM blood_urgency_request WHERE status = 'pending'")
        pending_urgency = cur.fetchone()["cnt"]

    return jsonify({
        "stats": {
            "totalEvents": total_events,
            "upcomingEvents": upcoming_events,
            "totalStudents": total_students,
            "totalParticipations": total_participations,
            "totalPointsAwarded": total_points,
            "totalBloodUnits": total_blood_units,
            "totalNgos": total_orgs,
            "pendingUrgency": pending_urgency,
        }
    })


@app.get("/api/board/students")
@board_required
def board_students_summary():
    with db_cursor() as cur:
        cur.execute("SELECT * FROM v_student_activity_summary ORDER BY total_activity_points DESC, usn ASC")
        students = _serialize_rows(cur.fetchall())
    return jsonify({"students": students})


@app.get("/api/dbms/overview")
@board_required
def dbms_overview():
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT table_name AS name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """
        )
        table_names = [r["name"] for r in cur.fetchall()]
        tables = []
        for t in table_names:
            cur.execute(f'SELECT COUNT(*)::INT AS cnt FROM "{t}"')
            tables.append({"name": t, "rows": cur.fetchone()["cnt"]})

        cur.execute(
            """
            SELECT table_name AS name
            FROM information_schema.views
            WHERE table_schema = 'public'
            ORDER BY table_name
            """
        )
        views = _serialize_rows(cur.fetchall())

        cur.execute(
            """
            SELECT trigger_name AS name, event_object_table AS tbl_name
            FROM information_schema.triggers
            WHERE trigger_schema = 'public'
            ORDER BY trigger_name
            """
        )
        triggers = _serialize_rows(cur.fetchall())

        cur.execute("SELECT * FROM v_event_participation_stats ORDER BY event_date DESC")
        event_stats = _serialize_rows(cur.fetchall())

        cur.execute("SELECT * FROM v_blood_inventory ORDER BY blood_group ASC")
        blood_inventory = _serialize_rows(cur.fetchall())

    return jsonify({
        "tables": tables,
        "views": views,
        "triggers": triggers,
        "event_stats": event_stats,
        "blood_inventory": blood_inventory,
    })


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_ENV") == "development"
    app.run(host="127.0.0.1", port=port, debug=debug)
