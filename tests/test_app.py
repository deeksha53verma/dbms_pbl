import base64
import os
import unittest
from contextlib import contextmanager
from unittest.mock import patch
from werkzeug.security import generate_password_hash, check_password_hash

import app as flask_app
import auth_utils


class FakePostgreSQLStore:
    """In-memory relational simulator used when DB_PASSWORD is not configured for live Postgres."""

    def __init__(self):
        self.students = [
            {
                "student_id": 1,
                "usn": "1RV23CS001",
                "name": "Deeksha Verma",
                "email": "deeksha.cs23@rvce.edu.in",
                "password_hash": generate_password_hash("rvce123", method="pbkdf2:sha256"),
                "department": "CSE",
                "semester": 5,
                "phone": "9876543210",
                "blood_group": "O+",
                "created_at": "2026-11-25T10:00:00",
            },
            {
                "student_id": 2,
                "usn": "1RV23CS002",
                "name": "Riya Sharma",
                "email": "riya.cs23@rvce.edu.in",
                "password_hash": generate_password_hash("rvce123", method="pbkdf2:sha256"),
                "department": "CSE",
                "semester": 5,
                "phone": "9876543211",
                "blood_group": "A+",
                "created_at": "2026-11-25T10:00:00",
            },
        ]
        self.board_members = [
            {
                "member_id": 1,
                "college_id": "1RV23CS001B",
                "rotary_number": "RI-3191-101",
                "password_hash": generate_password_hash("rotary123", method="pbkdf2:sha256"),
                "name": "Rtr. Pavana",
                "designation": "President",
                "portfolio": "Core Board",
                "photo_url": "/images/board/pavana.jpg",
                "department": "CSE",
                "email": "pavana.cs23@rvce.edu.in",
                "phone": "9845011101",
                "tenure_year": "2026-27",
                "display_order": 1,
            }
        ]
        self.organisations = [
            {
                "org_id": 1,
                "name": "Rotary Bangalore Blood Bank",
                "org_type": "Blood Bank",
                "category": "Healthcare",
                "contact_person": "Dr. Suresh",
                "phone": "+91 98765 43210",
                "email": "bb@rotary.org",
                "address": "Bengaluru",
                "description": "Blood bank",
            },
            {
                "org_id": 2,
                "name": "Kengeri Govt. High School",
                "org_type": "School",
                "category": "Education",
                "contact_person": "Shivakumar",
                "phone": "+91 94480 55678",
                "email": "school@karnataka.edu.in",
                "address": "Kengeri",
                "description": "Partner school",
            },
        ]
        self.events = [
            {
                "event_id": 1,
                "title": "Blood Donation Camp",
                "event_type": "blood_donation",
                "short_tagline": "Donate blood, save lives.",
                "description": "Annual camp",
                "event_date": "2026-12-05",
                "start_time": "09:00 AM",
                "end_time": "02:00 PM",
                "venue": "RVCE Auditorium",
                "activity_points": 30,
                "status": "upcoming",
                "poc_member_id": 1,
                "poc_name": "Rtr. Pavana",
                "poc_phone": "9845011101",
                "qr_token": "QR-RVCE-BDC-2026-01",
                "qr_active": True,
                "qr_enabled_by": 1,
                "created_by": 1,
            }
        ]
        self.event_organisations = [{"event_id": 1, "org_id": 1, "partnership_role": "Blood Bank Partner"}]
        self.registrations = []
        self.attendances = []
        self.activity_points = []
        self.email_otps = []


class FakeCursor:
    def __init__(self, store):
        self.store = store
        self._one = None
        self._many = []

    def execute(self, sql, params=None):
        q = " ".join(sql.split()).lower()
        params = params or ()
        self._one = None
        self._many = []

        if "select student_id from student where lower(email)" in q:
            email = params[0]
            s = next((x for x in self.store.students if x["email"].lower() == email), None)
            self._one = {"student_id": s["student_id"]} if s else None
        elif "delete from email_otp" in q:
            email = params[0]
            self.store.email_otps = [o for o in self.store.email_otps if not (o["email"].lower() == email and not o["verified"])]
        elif "insert into email_otp" in q:
            email, otp_hash = params
            from datetime import datetime, timedelta, timezone
            self.store.email_otps.append({
                "otp_id": len(self.store.email_otps) + 1,
                "email": email,
                "otp_hash": otp_hash,
                "purpose": "student_register",
                "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
                "verified": False,
                "attempts": 0,
            })
        elif "from email_otp" in q:
            email = params[0]
            matches = [o for o in self.store.email_otps if o["email"].lower() == email and o["purpose"] == "student_register" and not o["verified"]]
            self._one = matches[-1] if matches else None
        elif "update email_otp set attempts" in q:
            oid = params[0]
            for o in self.store.email_otps:
                if o["otp_id"] == oid:
                    o["attempts"] += 1
        elif "update email_otp set verified = true" in q:
            oid = params[0]
            for o in self.store.email_otps:
                if o["otp_id"] == oid:
                    o["verified"] = True
        elif "from student where lower(email)" in q:
            email = params[0]
            self._one = next((s for s in self.store.students if s["email"].lower() == email), None)
        elif "from student where student_id" in q:
            sid = params[0]
            self._one = next((s for s in self.store.students if s["student_id"] == sid), None)
        elif "insert into student" in q:
            usn, name, email, pw_hash, dept, sem, phone, bg = params
            if any(s["usn"] == usn or s["email"] == email for s in self.store.students):
                raise flask_app.psycopg2.IntegrityError("duplicate student")
            new_s = {
                "student_id": len(self.store.students) + 1,
                "usn": usn,
                "name": name,
                "email": email,
                "password_hash": pw_hash,
                "department": dept,
                "semester": sem,
                "phone": phone,
                "blood_group": bg,
                "created_at": "2026-11-25T10:00:00",
            }
            self.store.students.append(new_s)
            self._one = {k: v for k, v in new_s.items() if k != "password_hash"}
        elif "from board_member where upper(college_id)" in q:
            cid, rno = params
            self._one = next(
                (b for b in self.store.board_members if b["college_id"].upper() == cid and b["rotary_number"].upper() == rno),
                None,
            )
        elif "from board_member where member_id" in q:
            mid = params[0]
            self._one = next((b for b in self.store.board_members if b["member_id"] == mid), None)
        elif "from event_organisation eo" in q:
            ev_id = params[0]
            linked_ids = {eo["org_id"]: eo["partnership_role"] for eo in self.store.event_organisations if eo["event_id"] == ev_id}
            self._many = [
                {**o, "ngo_id": o["org_id"], "partnership_role": linked_ids[o["org_id"]]}
                for o in self.store.organisations
                if o["org_id"] in linked_ids
            ]
        elif "from registration r left join attendance a" in q and "count(" in q:
            ev_id = params[0]
            regs = [r for r in self.store.registrations if r["event_id"] == ev_id]
            pres = [a for a in self.store.attendances if any(r["registration_id"] == a["registration_id"] for r in regs) and a["attendance_status"] == "present"]
            self._one = {"registered_count": len(regs), "present_count": len(pres)}
        elif "from registration r left join attendance a" in q and "r.student_id = %s" in q:
            ev_id, sid = params
            reg = next((r for r in self.store.registrations if r["event_id"] == ev_id and r["student_id"] == sid), None)
            if reg:
                att = next((a for a in self.store.attendances if a["registration_id"] == reg["registration_id"]), None)
                ap = next((p for p in self.store.activity_points if att and p["attendance_id"] == att["attendance_id"]), None)
                self._one = {
                    "registration_id": reg["registration_id"],
                    "registered_at": "2026-11-25T10:00:00",
                    "attendance_status": att["attendance_status"] if att else "registered",
                    "verification_method": att["verification_method"] if att else None,
                    "verified_at": "2026-11-25T10:05:00" if att else None,
                    "points_awarded": ap["points_awarded"] if ap else 0,
                }
        elif "select * from event where event_id" in q:
            self._one = next((e for e in self.store.events if e["event_id"] == params[0]), None)
        elif "select * from event" in q:
            self._many = list(self.store.events)
        elif "select event_id, title, qr_token, qr_active, activity_points from event" in q:
            self._one = next((e for e in self.store.events if e["event_id"] == params[0]), None)
        elif "select event_id, title, activity_points, qr_active" in q and "where qr_token" in q:
            self._one = next((e for e in self.store.events if e["qr_token"] == params[0]), None)
        elif "select event_id, status from event" in q:
            self._one = next((e for e in self.store.events if e["event_id"] == params[0]), None)
        elif "select event_id, activity_points from event" in q:
            self._one = next((e for e in self.store.events if e["event_id"] == params[0]), None)
        elif "insert into event (" in q:
            ev_id = len(self.store.events) + 1
            new_ev = {
                "event_id": ev_id,
                "title": params[0],
                "event_type": params[1],
                "short_tagline": params[2],
                "description": params[3],
                "event_date": params[4],
                "start_time": params[5],
                "end_time": params[6],
                "venue": params[7],
                "activity_points": params[8],
                "status": params[9],
                "poc_member_id": params[10],
                "poc_name": params[11],
                "poc_phone": params[12],
                "qr_token": params[13],
                "qr_active": True,
                "qr_enabled_by": params[14],
                "created_by": params[15],
            }
            self.store.events.append(new_ev)
            self._one = new_ev
        elif "insert into event_organisation" in q:
            ev_id, oid = params
            if not any(x["event_id"] == ev_id and x["org_id"] == oid for x in self.store.event_organisations):
                self.store.event_organisations.append({"event_id": ev_id, "org_id": oid, "partnership_role": "Event Partner"})
        elif "insert into registration" in q:
            ev_id, sid = params
            if any(r["event_id"] == ev_id and r["student_id"] == sid for r in self.store.registrations):
                raise flask_app.psycopg2.IntegrityError("duplicate registration")
            reg = {"registration_id": len(self.store.registrations) + 1, "event_id": ev_id, "student_id": sid}
            self.store.registrations.append(reg)
            self._one = reg
        elif "select registration_id from registration where event_id" in q:
            ev_id, sid = params
            self._one = next((r for r in self.store.registrations if r["event_id"] == ev_id and r["student_id"] == sid), None)
        elif "select attendance_id from attendance where registration_id" in q:
            rid = params[0]
            self._one = next((a for a in self.store.attendances if a["registration_id"] == rid), None)
        elif "insert into attendance" in q and "on conflict" in q:
            rid, status, vby = params
            att = next((a for a in self.store.attendances if a["registration_id"] == rid), None)
            if att:
                att["attendance_status"] = status
                att["verified_by"] = vby
            else:
                att = {
                    "attendance_id": len(self.store.attendances) + 1,
                    "registration_id": rid,
                    "attendance_status": status,
                    "verification_method": "manual",
                    "verified_by": vby,
                }
                self.store.attendances.append(att)
            self._one = att
        elif "insert into attendance" in q:
            rid, vby = params
            att = {
                "attendance_id": len(self.store.attendances) + 1,
                "registration_id": rid,
                "attendance_status": "present",
                "verification_method": "qr",
                "verified_by": vby,
            }
            self.store.attendances.append(att)
            self._one = att
        elif "insert into activity_points" in q:
            att_id, sid, ev_id, pts, aby = params
            att = next((a for a in self.store.attendances if a["attendance_id"] == att_id), None)
            if not att or att["attendance_status"] != "present":
                raise RuntimeError("Trigger violation: attendance must be present")
            ap = next((p for p in self.store.activity_points if p["attendance_id"] == att_id), None)
            if ap:
                ap["points_awarded"] = pts
            else:
                ap = {
                    "point_id": len(self.store.activity_points) + 1,
                    "attendance_id": att_id,
                    "student_id": sid,
                    "event_id": ev_id,
                    "points_awarded": pts,
                    "awarded_by": aby,
                }
                self.store.activity_points.append(ap)
            self._one = ap
        elif "delete from activity_points where attendance_id" in q:
            att_id = params[0]
            self.store.activity_points = [p for p in self.store.activity_points if p["attendance_id"] != att_id]
        elif "select coalesce(sum(units_donated), 0)" in q:
            self._one = {"total_units": 0, "donor_count": 0}
        elif "from blood_urgency_request" in q:
            self._many = []
        elif "where eo.event_id = %s and o.org_type" in q:
            self._many = []
        elif "from v_student_activity_summary where student_id" in q:
            sid = params[0]
            stu = next(s for s in self.store.students if s["student_id"] == sid)
            total_ap = sum(p["points_awarded"] for p in self.store.activity_points if p["student_id"] == sid)
            regs = [r for r in self.store.registrations if r["student_id"] == sid]
            pres = [a for a in self.store.attendances if any(r["registration_id"] == a["registration_id"] for r in regs) and a["attendance_status"] == "present"]
            self._one = {**stu, "total_activity_points": total_ap, "events_attended": len(pres), "events_registered": len(regs)}
        elif "from registration r join event e" in q:
            self._many = []
        elif "from fistfull_donation" in q or "from pustak_donation" in q or "from blood_camp_donation" in q:
            self._many = []
        elif "from board_member where designation = 'president'" in q:
            self._one = self.store.board_members[0]

    def fetchone(self):
        return self._one

    def fetchall(self):
        return self._many


class RotaractFlaskBackendTests(unittest.TestCase):
    def setUp(self):
        self.store = FakePostgreSQLStore()
        flask_app.app.config["TESTING"] = True
        self.client = flask_app.app.test_client()

        @contextmanager
        def fake_db_cursor(commit=False):
            yield FakeCursor(self.store)

        self.p1 = patch.object(flask_app, "db_cursor", fake_db_cursor)
        self.p2 = patch.object(auth_utils, "db_cursor", fake_db_cursor)
        self.p1.start()
        self.p2.start()

    def tearDown(self):
        self.p1.stop()
        self.p2.stop()

    def test_01_student_register_login_and_rvce_email_check(self):
        bad = self.client.post("/api/auth/student-register", json={
            "usn": "1RV24CS099", "name": "Test User", "email": "test@gmail.com",
            "password": "password123", "otp": "123456", "department": "CSE", "semester": 3, "phone": "9999999999"
        })
        self.assertEqual(bad.status_code, 400)

        # Send OTP to @rvce.edu.in email
        otp_res = self.client.post("/api/auth/send-otp", json={"email": "test.cs24@rvce.edu.in"})
        self.assertEqual(otp_res.status_code, 200)
        otp_code = otp_res.get_json()["dev_otp"]

        # Wrong OTP must be rejected
        wrong_otp = self.client.post("/api/auth/student-register", json={
            "usn": "1RV24CS099", "name": "Test User", "email": "test.cs24@rvce.edu.in",
            "password": "password123", "otp": "000000", "department": "CSE", "semester": 3, "phone": "9999999999", "blood_group": "B+"
        })
        self.assertEqual(wrong_otp.status_code, 400)

        # Correct OTP succeeds
        ok = self.client.post("/api/auth/student-register", json={
            "usn": "1RV24CS099", "name": "Test User", "email": "test.cs24@rvce.edu.in",
            "password": "password123", "otp": otp_code, "department": "CSE", "semester": 3, "phone": "9999999999", "blood_group": "B+"
        })
        self.assertEqual(ok.status_code, 201)
        stored = self.store.students[-1]
        self.assertNotEqual(stored["password_hash"], "password123")
        self.assertTrue(check_password_hash(stored["password_hash"], "password123"))

        login = self.client.post("/api/auth/student-login", json={
            "email": "test.cs24@rvce.edu.in", "password": "password123"
        })
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.get_json()["role"], "student")

    def test_02_board_member_three_factor_login_and_rbac(self):
        bad_pw = self.client.post("/api/auth/board-login", json={
            "college_id": "1RV23CS001B", "rotary_number": "RI-3191-101", "password": "wrong"
        })
        self.assertEqual(bad_pw.status_code, 401)

        ok = self.client.post("/api/auth/board-login", json={
            "college_id": "1RV23CS001B", "rotary_number": "RI-3191-101", "password": "rotary123"
        })
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.get_json()["user"]["name"], "Rtr. Pavana")

        # Student must be blocked (403) from board-only endpoints
        stu = self.client.post("/api/auth/student-login", json={
            "email": "deeksha.cs23@rvce.edu.in", "password": "rvce123"
        }).get_json()
        stu_hdr = {"Authorization": f"Bearer {stu['token']}"}

        self.assertEqual(self.client.get("/api/events/1/qr", headers=stu_hdr).status_code, 403)
        self.assertEqual(self.client.get("/api/board/dashboard", headers=stu_hdr).status_code, 403)
        self.assertEqual(self.client.post("/api/events/1/attendance", json={"records": []}, headers=stu_hdr).status_code, 403)

    def test_03_duplicate_registration_and_organisation_isolation(self):
        stu = self.client.post("/api/auth/student-login", json={
            "email": "deeksha.cs23@rvce.edu.in", "password": "rvce123"
        }).get_json()
        stu_hdr = {"Authorization": f"Bearer {stu['token']}"}

        r1 = self.client.post("/api/events/1/register", headers=stu_hdr)
        self.assertEqual(r1.status_code, 201)

        r2 = self.client.post("/api/events/1/register", headers=stu_hdr)
        self.assertEqual(r2.status_code, 409)

        # Event 1 only returns linked org_id=1 (Rotary Bangalore Blood Bank), not org_id=2 (School)
        ev_detail = self.client.get("/api/events/1", headers=stu_hdr).get_json()
        org_names = [o["name"] for o in ev_detail["event"]["organisations"]]
        self.assertEqual(org_names, ["Rotary Bangalore Blood Bank"])

    def test_04_qr_attendance_verification_security_and_ap_rules(self):
        bm = self.client.post("/api/auth/board-login", json={
            "college_id": "1RV23CS001B", "rotary_number": "RI-3191-101", "password": "rotary123"
        }).get_json()
        bm_hdr = {"Authorization": f"Bearer {bm['token']}"}

        stu1 = self.client.post("/api/auth/student-login", json={
            "email": "deeksha.cs23@rvce.edu.in", "password": "rvce123"
        }).get_json()
        stu1_hdr = {"Authorization": f"Bearer {stu1['token']}"}

        stu2 = self.client.post("/api/auth/student-login", json={
            "email": "riya.cs23@rvce.edu.in", "password": "rvce123"
        }).get_json()
        stu2_hdr = {"Authorization": f"Bearer {stu2['token']}"}

        # Board fetches QR PNG & token
        qr_res = self.client.get("/api/events/1/qr", headers=bm_hdr)
        self.assertEqual(qr_res.status_code, 200)
        qr_json = qr_res.get_json()
        self.assertTrue(qr_json["qr_image_data_url"].startswith("data:image/png;base64,"))
        png_bytes = base64.b64decode(qr_json["qr_image_data_url"].split(",", 1)[1])
        self.assertTrue(png_bytes.startswith(b"\x89PNG"))

        # Invalid QR token rejected (404)
        bad_qr = self.client.post("/api/attendance/qr-checkin", json={"qr_token": "INVALID-TOKEN"}, headers=stu1_hdr)
        self.assertEqual(bad_qr.status_code, 404)

        # Unregistered student (stu2) rejected (403)
        unreg = self.client.post("/api/attendance/qr-checkin", json={"qr_token": qr_json["qr_token"]}, headers=stu2_hdr)
        self.assertEqual(unreg.status_code, 403)

        # Registered student (stu1) succeeds
        self.client.post("/api/events/1/register", headers=stu1_hdr)
        ok_qr = self.client.post("/api/attendance/qr-checkin", json={"qr_token": qr_json["qr_token"]}, headers=stu1_hdr)
        self.assertEqual(ok_qr.status_code, 201)
        self.assertEqual(ok_qr.get_json()["verification_method"], "qr")
        self.assertEqual(ok_qr.get_json()["points_awarded"], 30)

        # Duplicate QR attendance rejected (409)
        dup_qr = self.client.post("/api/attendance/qr-checkin", json={"qr_token": qr_json["qr_token"]}, headers=stu1_hdr)
        self.assertEqual(dup_qr.status_code, 409)

        # Verify AP awarded == 30
        ap = self.client.get("/api/student/activity-points", headers=stu1_hdr).get_json()
        self.assertEqual(ap["summary"]["total_activity_points"], 30)

        # Manual marking absent clears AP (points only for present students)
        self.client.post("/api/events/1/attendance", json={
            "records": [{"student_id": 1, "attendance_status": "absent"}]
        }, headers=bm_hdr)
        ap_after_absent = self.client.get("/api/student/activity-points", headers=stu1_hdr).get_json()
        self.assertEqual(ap_after_absent["summary"]["total_activity_points"], 0)

    def test_05_manual_attendance_rejects_unregistered_student(self):
        bm = self.client.post("/api/auth/board-login", json={
            "college_id": "1RV23CS001B", "rotary_number": "RI-3191-101", "password": "rotary123"
        }).get_json()
        bm_hdr = {"Authorization": f"Bearer {bm['token']}"}
        res = self.client.post("/api/events/1/attendance", json={
            "records": [{"student_id": 2, "attendance_status": "present"}]
        }, headers=bm_hdr)
        self.assertEqual(res.status_code, 400)


if __name__ == "__main__":
    unittest.main()
