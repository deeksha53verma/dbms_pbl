import os
from functools import wraps
from flask import request, jsonify, session, g, current_app
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from db_pg import db_cursor

TOKEN_SALT = "rotaract-rvce-auth-token-v1"
PASS_QR_SALT = "rotaract-rvce-reg-pass-v1"


def _get_serializer(salt=TOKEN_SALT):
    secret = current_app.config["SECRET_KEY"]
    return URLSafeTimedSerializer(secret, salt=salt)


def issue_auth_token(role, user_id):
    return _get_serializer(TOKEN_SALT).dumps({"role": role, "id": int(user_id)})


def verify_auth_token(token, max_age=86400 * 7):
    if not token:
        return None
    try:
        return _get_serializer(TOKEN_SALT).loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None


def issue_pass_qr_token(registration_id, event_id, student_id):
    return _get_serializer(PASS_QR_SALT).dumps({
        "registration_id": int(registration_id),
        "event_id": int(event_id),
        "student_id": int(student_id),
    })


def verify_pass_qr_token(token, max_age=86400 * 30):
    if not token:
        return None
    try:
        return _get_serializer(PASS_QR_SALT).loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None


def resolve_current_user():
    """Resolve authenticated user from Flask session or signed Bearer token, verified against PostgreSQL."""
    auth_header = request.headers.get("Authorization", "")
    payload = None

    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        payload = verify_auth_token(token)
    elif session.get("role") and session.get("user_id"):
        payload = {"role": session["role"], "id": session["user_id"]}

    if not payload:
        return None, None

    role = payload.get("role")
    uid = payload.get("id")
    if role == "student":
        with db_cursor() as cur:
            cur.execute(
                """
                SELECT student_id, usn, name, email, department, semester, phone, blood_group, created_at
                FROM student
                WHERE student_id = %s
                """,
                (uid,),
            )
            row = cur.fetchone()
            return ("student", dict(row)) if row else (None, None)

    if role == "board":
        with db_cursor() as cur:
            cur.execute(
                """
                SELECT member_id, college_id, rotary_number, name, designation, portfolio,
                       photo_url, department, email, phone, tenure_year, display_order
                FROM board_member
                WHERE member_id = %s
                """,
                (uid,),
            )
            row = cur.fetchone()
            return ("board", dict(row)) if row else (None, None)

    return None, None


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        role, user = resolve_current_user()
        if not user:
            return jsonify({"error": "Authentication required. Please log in."}), 401
        g.role = role
        g.user = user
        return fn(*args, **kwargs)

    return wrapper


def student_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        role, user = resolve_current_user()
        if not user:
            return jsonify({"error": "Authentication required. Please log in."}), 401
        if role != "student":
            return jsonify({"error": "Student account required for this action."}), 403
        g.role = role
        g.user = user
        return fn(*args, **kwargs)

    return wrapper


def board_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        role, user = resolve_current_user()
        if not user:
            return jsonify({"error": "Authentication required. Please log in."}), 401
        if role != "board":
            return jsonify({"error": "Unauthorised: Board Member access required."}), 403
        g.role = role
        g.user = user
        return fn(*args, **kwargs)

    return wrapper
