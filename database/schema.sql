-- ============================================================================
-- Rotaract Club of RVCE - Relational Database Schema (SQLite)
-- Features: 3NF Tables, Foreign Keys, CHECK Constraints, EER Specialization
--           Tables, Junction Tables (M:N), Views, and Triggers.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Students Table (RVCE students authenticated via @rvce.edu.in email)
CREATE TABLE IF NOT EXISTS students (
    student_id INTEGER PRIMARY KEY AUTOINCREMENT,
    usn TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE CHECK (lower(email) LIKE '%@rvce.edu.in'),
    password_hash TEXT NOT NULL,
    department TEXT NOT NULL,
    semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
    phone TEXT NOT NULL,
    blood_group TEXT CHECK (blood_group IN ('A+','A-','B+','B-','O+','O-','AB+','AB-')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Board Members Table (Authenticated via College ID + Rotary Number)
CREATE TABLE IF NOT EXISTS board_members (
    member_id INTEGER PRIMARY KEY AUTOINCREMENT,
    college_id TEXT NOT NULL UNIQUE,
    rotary_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    designation TEXT NOT NULL,
    portfolio TEXT NOT NULL DEFAULT 'Core Board',
    photo_url TEXT,
    department TEXT NOT NULL,
    email TEXT NOT NULL CHECK (lower(email) LIKE '%@rvce.edu.in'),
    phone TEXT NOT NULL,
    tenure_year TEXT NOT NULL DEFAULT '2026-27',
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. General NGOs Directory (Independent list with contact phone numbers)
CREATE TABLE IF NOT EXISTS ngos (
    ngo_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN ('Community', 'Healthcare', 'Education', 'Food & Hunger', 'Environment')),
    contact_person TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Connected Hospitals (For Blood Donation Camp urgency unit access)
CREATE TABLE IF NOT EXISTS hospitals (
    hospital_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    emergency_phone TEXT NOT NULL,
    blood_bank_email TEXT NOT NULL,
    address TEXT NOT NULL,
    urgency_contact_person TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Events Table (Supertype for all Rotaract events)
CREATE TABLE IF NOT EXISTS events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('blood_donation', 'walkathon', 'project_pustak', 'fistfull', 'trek', 'general')),
    short_tagline TEXT NOT NULL,
    description TEXT NOT NULL,
    event_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    venue TEXT NOT NULL,
    activity_points INTEGER NOT NULL CHECK (activity_points >= 0),
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'past')),
    created_by INTEGER REFERENCES board_members(member_id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Event <-> NGO Junction Table (NGOs connected to specific events)
CREATE TABLE IF NOT EXISTS event_ngos (
    event_id INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    ngo_id INTEGER NOT NULL REFERENCES ngos(ngo_id) ON DELETE CASCADE,
    partnership_role TEXT NOT NULL DEFAULT 'Event Partner',
    PRIMARY KEY (event_id, ngo_id)
);

-- 7. Event Registrations & Attendance Sheet
CREATE TABLE IF NOT EXISTS registrations (
    registration_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    registered_at TEXT NOT NULL DEFAULT (datetime('now')),
    attendance_status TEXT NOT NULL DEFAULT 'registered' CHECK (attendance_status IN ('registered', 'present', 'absent')),
    points_awarded INTEGER NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
    marked_by INTEGER REFERENCES board_members(member_id) ON DELETE SET NULL,
    marked_at TEXT,
    UNIQUE (event_id, student_id)
);

-- 8a. Blood Donation Camp Specialization (Donors & Units linked to Hospitals)
CREATE TABLE IF NOT EXISTS blood_camp_donations (
    donation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    blood_group TEXT NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','O+','O-','AB+','AB-')),
    units_donated INTEGER NOT NULL DEFAULT 1 CHECK (units_donated > 0),
    volume_ml INTEGER NOT NULL DEFAULT 350 CHECK (volume_ml > 0),
    hospital_id INTEGER REFERENCES hospitals(hospital_id) ON DELETE SET NULL,
    donor_phone TEXT NOT NULL,
    urgency_status TEXT NOT NULL DEFAULT 'available' CHECK (urgency_status IN ('available', 'reserved_urgent', 'dispatched')),
    donated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (event_id, student_id)
);

-- 8b. Hospital Blood Urgency Requests (Connects collected units to hospitals in emergencies)
CREATE TABLE IF NOT EXISTS blood_urgency_requests (
    request_id INTEGER PRIMARY KEY AUTOINCREMENT,
    hospital_id INTEGER NOT NULL REFERENCES hospitals(hospital_id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    blood_group TEXT NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','O+','O-','AB+','AB-')),
    units_requested INTEGER NOT NULL CHECK (units_requested > 0),
    urgency_level TEXT NOT NULL CHECK (urgency_level IN ('critical', 'high', 'normal')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dispatched', 'fulfilled')),
    notes TEXT,
    requested_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8c. Walkathon Specialization Details
CREATE TABLE IF NOT EXISTS walkathon_details (
    event_id INTEGER PRIMARY KEY REFERENCES events(event_id) ON DELETE CASCADE,
    route_description TEXT NOT NULL,
    distance_km REAL NOT NULL CHECK (distance_km > 0),
    reporting_time TEXT NOT NULL,
    start_point TEXT NOT NULL,
    end_point TEXT NOT NULL,
    cause_theme TEXT NOT NULL
);

-- 8d. Project Pustak Donations (Books donated to Partner NGOs / Schools)
CREATE TABLE IF NOT EXISTS pustak_donations (
    pustak_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    book_category TEXT NOT NULL CHECK (book_category IN ('Textbooks', 'Storybooks', 'Reference Books', 'Notebooks & Stationery')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    recipient_ngo_id INTEGER REFERENCES ngos(ngo_id) ON DELETE SET NULL,
    target_school_name TEXT NOT NULL,
    donated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8e. Fistfull Donations (5 kg Rice OR 2 kg Toor Dal -> 10 Activity Points + NGO)
CREATE TABLE IF NOT EXISTS fistfull_donations (
    fistfull_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('rice_5kg', 'toor_dal_2kg')),
    quantity_kg REAL NOT NULL CHECK (quantity_kg > 0),
    points_earned INTEGER NOT NULL DEFAULT 10 CHECK (points_earned >= 0),
    ngo_id INTEGER REFERENCES ngos(ngo_id) ON DELETE SET NULL,
    verified_by INTEGER REFERENCES board_members(member_id) ON DELETE SET NULL,
    donated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8f. Trek Specialization Details
CREATE TABLE IF NOT EXISTS trek_details (
    event_id INTEGER PRIMARY KEY REFERENCES events(event_id) ON DELETE CASCADE,
    hill_name TEXT NOT NULL,
    location_area TEXT NOT NULL,
    elevation_m INTEGER NOT NULL CHECK (elevation_m > 0),
    trek_distance_km REAL NOT NULL CHECK (trek_distance_km > 0),
    difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Moderate', 'Challenging')),
    pickup_point TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    checklist TEXT NOT NULL
);

-- ============================================================================
-- SQL VIEWS (Pre-computed Aggregations for Reporting & Certificates)
-- ============================================================================

CREATE VIEW IF NOT EXISTS v_student_activity_summary AS
SELECT
    s.student_id,
    s.usn,
    s.name,
    s.email,
    s.department,
    s.semester,
    COALESCE(SUM(CASE WHEN r.attendance_status = 'present' THEN r.points_awarded ELSE 0 END), 0) AS total_activity_points,
    COUNT(CASE WHEN r.attendance_status = 'present' THEN 1 END) AS events_attended,
    COUNT(r.registration_id) AS events_registered
FROM students s
LEFT JOIN registrations r ON s.student_id = r.student_id
GROUP BY s.student_id;

CREATE VIEW IF NOT EXISTS v_blood_inventory AS
SELECT
    b.blood_group,
    COUNT(b.donation_id) AS donor_count,
    COALESCE(SUM(b.units_donated), 0) AS total_units_collected,
    COALESCE(SUM(CASE WHEN b.urgency_status = 'available' THEN b.units_donated ELSE 0 END), 0) AS available_units,
    COALESCE(SUM(CASE WHEN b.urgency_status = 'dispatched' THEN b.units_donated ELSE 0 END), 0) AS dispatched_units
FROM blood_camp_donations b
GROUP BY b.blood_group;

-- ============================================================================
-- SQL TRIGGERS (Automated Integrity & Activity Point Allocation)
-- ============================================================================

-- Trigger 1: Recording a blood donation automatically registers & marks student present with event AP
CREATE TRIGGER IF NOT EXISTS trg_blood_donation_award_ap
AFTER INSERT ON blood_camp_donations
BEGIN
    INSERT INTO registrations (event_id, student_id, attendance_status, points_awarded, marked_at)
    VALUES (
        NEW.event_id,
        NEW.student_id,
        'present',
        COALESCE((SELECT activity_points FROM events WHERE event_id = NEW.event_id), 30),
        datetime('now')
    )
    ON CONFLICT(event_id, student_id) DO UPDATE SET
        attendance_status = 'present',
        points_awarded = COALESCE((SELECT activity_points FROM events WHERE event_id = NEW.event_id), 30),
        marked_at = datetime('now');
END;

-- Trigger 2: Recording a Fistfull donation (5kg rice or 2kg toor dal) awards 10 AP
CREATE TRIGGER IF NOT EXISTS trg_fistfull_award_ap
AFTER INSERT ON fistfull_donations
BEGIN
    INSERT INTO registrations (event_id, student_id, attendance_status, points_awarded, marked_by, marked_at)
    VALUES (
        NEW.event_id,
        NEW.student_id,
        'present',
        NEW.points_earned,
        NEW.verified_by,
        datetime('now')
    )
    ON CONFLICT(event_id, student_id) DO UPDATE SET
        attendance_status = 'present',
        points_awarded = NEW.points_earned,
        marked_by = COALESCE(NEW.verified_by, registrations.marked_by),
        marked_at = datetime('now');
END;

-- Trigger 3: Recording a Project Pustak book donation marks student present with event AP
CREATE TRIGGER IF NOT EXISTS trg_pustak_award_ap
AFTER INSERT ON pustak_donations
BEGIN
    INSERT INTO registrations (event_id, student_id, attendance_status, points_awarded, marked_at)
    VALUES (
        NEW.event_id,
        NEW.student_id,
        'present',
        COALESCE((SELECT activity_points FROM events WHERE event_id = NEW.event_id), 15),
        datetime('now')
    )
    ON CONFLICT(event_id, student_id) DO UPDATE SET
        attendance_status = 'present',
        points_awarded = COALESCE((SELECT activity_points FROM events WHERE event_id = NEW.event_id), 15),
        marked_at = datetime('now');
END;
