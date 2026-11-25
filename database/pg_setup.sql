-- ============================================================================
-- Rotaract Club of RVCE — PostgreSQL Database Setup Script
-- Execute this script in pgAdmin 4 Query Tool on database: rotaract_rvce
-- ============================================================================

BEGIN;

-- Drop views & tables in dependency order for clean re-execution
DROP VIEW IF EXISTS v_event_participation_stats CASCADE;
DROP VIEW IF EXISTS v_blood_inventory CASCADE;
DROP VIEW IF EXISTS v_student_activity_summary CASCADE;

DROP TABLE IF EXISTS trek_detail CASCADE;
DROP TABLE IF EXISTS fistfull_donation CASCADE;
DROP TABLE IF EXISTS pustak_donation CASCADE;
DROP TABLE IF EXISTS walkathon_detail CASCADE;
DROP TABLE IF EXISTS blood_urgency_request CASCADE;
DROP TABLE IF EXISTS blood_camp_donation CASCADE;
DROP TABLE IF EXISTS activity_points CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS registration CASCADE;
DROP TABLE IF EXISTS event_organisation CASCADE;
DROP TABLE IF EXISTS event CASCADE;
DROP TABLE IF EXISTS organisation CASCADE;
DROP TABLE IF EXISTS email_otp CASCADE;
DROP TABLE IF EXISTS board_member CASCADE;
DROP TABLE IF EXISTS student CASCADE;

-- ============================================================================
-- 1. CORE ENTITIES
-- ============================================================================

-- 1.1 Student (Authenticated via @rvce.edu.in email + Werkzeug password hash)
CREATE TABLE student (
    student_id    SERIAL PRIMARY KEY,
    usn           VARCHAR(20)  NOT NULL UNIQUE,
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE CHECK (lower(email) LIKE '%@rvce.edu.in'),
    password_hash TEXT         NOT NULL,
    department    VARCHAR(100) NOT NULL,
    semester      SMALLINT     NOT NULL CHECK (semester BETWEEN 1 AND 8),
    phone         VARCHAR(20)  NOT NULL,
    blood_group   VARCHAR(5)   CHECK (blood_group IN ('A+','A-','B+','B-','O+','O-','AB+','AB-')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 1.1b Email OTP Verification for Student Registration
CREATE TABLE email_otp (
    otp_id     SERIAL PRIMARY KEY,
    email      VARCHAR(150) NOT NULL CHECK (lower(email) LIKE '%@rvce.edu.in'),
    otp_hash   TEXT         NOT NULL,
    purpose    VARCHAR(30)  NOT NULL DEFAULT 'student_register',
    expires_at TIMESTAMPTZ  NOT NULL,
    verified   BOOLEAN      NOT NULL DEFAULT FALSE,
    attempts   SMALLINT     NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 1.2 Board Member (Authenticated via College ID + Rotary Number + Werkzeug password hash)
CREATE TABLE board_member (
    member_id     SERIAL PRIMARY KEY,
    college_id    VARCHAR(20)  NOT NULL UNIQUE,
    rotary_number VARCHAR(30)  NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    name          VARCHAR(120) NOT NULL,
    designation   VARCHAR(100) NOT NULL,
    portfolio     VARCHAR(80)  NOT NULL DEFAULT 'Core Board',
    photo_url     TEXT,
    department    VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL CHECK (lower(email) LIKE '%@rvce.edu.in'),
    phone         VARCHAR(20)  NOT NULL,
    tenure_year   VARCHAR(15)  NOT NULL DEFAULT '2026-27',
    display_order INT          NOT NULL DEFAULT 1,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 1.3 Organisation (Stores Schools, Hospitals, Blood Banks, and NGOs; org_type lives ONLY here)
CREATE TABLE organisation (
    org_id         SERIAL PRIMARY KEY,
    name           VARCHAR(150) NOT NULL UNIQUE,
    org_type       VARCHAR(20)  NOT NULL CHECK (org_type IN ('NGO', 'School', 'Hospital', 'Blood Bank')),
    category       VARCHAR(60)  NOT NULL,
    contact_person VARCHAR(120) NOT NULL,
    phone          VARCHAR(25)  NOT NULL,
    email          VARCHAR(150),
    address        TEXT         NOT NULL,
    description    TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 1.4 Event (No org_type column — associated organisations are linked via event_organisation)
CREATE TABLE event (
    event_id        SERIAL PRIMARY KEY,
    title           VARCHAR(150) NOT NULL,
    event_type      VARCHAR(30)  NOT NULL CHECK (event_type IN ('blood_donation', 'walkathon', 'project_pustak', 'fistfull', 'trek', 'general')),
    short_tagline   VARCHAR(255) NOT NULL,
    description     TEXT         NOT NULL,
    event_date      DATE         NOT NULL,
    start_time      VARCHAR(20)  NOT NULL,
    end_time        VARCHAR(20)  NOT NULL,
    venue           VARCHAR(200) NOT NULL,
    activity_points INT          NOT NULL CHECK (activity_points >= 0),
    status          VARCHAR(15)  NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'past')),
    poc_member_id   INT          REFERENCES board_member(member_id) ON DELETE SET NULL,
    poc_name        VARCHAR(120) NOT NULL,
    poc_phone       VARCHAR(25)  NOT NULL,
    qr_token        VARCHAR(64)  NOT NULL UNIQUE,
    qr_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    qr_enabled_by   INT          REFERENCES board_member(member_id) ON DELETE SET NULL,
    created_by      INT          REFERENCES board_member(member_id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 1.5 Event <-> Organisation M:N Junction Table
CREATE TABLE event_organisation (
    event_id         INT          NOT NULL REFERENCES event(event_id) ON DELETE CASCADE,
    org_id           INT          NOT NULL REFERENCES organisation(org_id) ON DELETE CASCADE,
    partnership_role VARCHAR(120) NOT NULL DEFAULT 'Event Partner',
    PRIMARY KEY (event_id, org_id)
);

-- 1.6 Registration (Unique constraint prevents duplicate registration by same student)
CREATE TABLE registration (
    registration_id SERIAL PRIMARY KEY,
    event_id        INT         NOT NULL REFERENCES event(event_id) ON DELETE CASCADE,
    student_id      INT         NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_registration_event_student UNIQUE (event_id, student_id)
);

-- 1.7 Attendance (Strictly linked 1:1 to a valid registration; verified by an authorised board member)
CREATE TABLE attendance (
    attendance_id       SERIAL PRIMARY KEY,
    registration_id     INT         NOT NULL UNIQUE REFERENCES registration(registration_id) ON DELETE CASCADE,
    attendance_status   VARCHAR(15) NOT NULL CHECK (attendance_status IN ('present', 'absent')),
    verification_method VARCHAR(15) NOT NULL DEFAULT 'manual' CHECK (verification_method IN ('manual', 'qr')),
    verified_by         INT         NOT NULL REFERENCES board_member(member_id) ON DELETE RESTRICT,
    verified_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.8 Activity Points (Awarded only after attendance is verified as 'present')
CREATE TABLE activity_points (
    point_id       SERIAL PRIMARY KEY,
    attendance_id  INT         NOT NULL UNIQUE REFERENCES attendance(attendance_id) ON DELETE CASCADE,
    student_id     INT         NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
    event_id       INT         NOT NULL REFERENCES event(event_id) ON DELETE CASCADE,
    points_awarded INT         NOT NULL CHECK (points_awarded >= 0),
    awarded_by     INT         REFERENCES board_member(member_id) ON DELETE SET NULL,
    awarded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. SUPPORTING EVENT-DETAIL TABLES
-- ============================================================================

-- 2.1 Blood Camp Donations (linked to Hospital / Blood Bank in organisation)
CREATE TABLE blood_camp_donation (
    donation_id    SERIAL PRIMARY KEY,
    event_id       INT         NOT NULL REFERENCES event(event_id) ON DELETE CASCADE,
    student_id     INT         NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
    blood_group    VARCHAR(5)  NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','O+','O-','AB+','AB-')),
    units_donated  INT         NOT NULL DEFAULT 1 CHECK (units_donated > 0),
    volume_ml      INT         NOT NULL DEFAULT 350 CHECK (volume_ml > 0),
    org_id         INT         REFERENCES organisation(org_id) ON DELETE SET NULL,
    donor_phone    VARCHAR(20) NOT NULL,
    urgency_status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (urgency_status IN ('available', 'reserved_urgent', 'dispatched')),
    donated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_blood_donor_event UNIQUE (event_id, student_id)
);

-- 2.2 Hospital / Blood Bank Urgency Requests
CREATE TABLE blood_urgency_request (
    request_id      SERIAL PRIMARY KEY,
    org_id          INT         NOT NULL REFERENCES organisation(org_id) ON DELETE CASCADE,
    event_id        INT         NOT NULL REFERENCES event(event_id) ON DELETE CASCADE,
    blood_group     VARCHAR(5)  NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','O+','O-','AB+','AB-')),
    units_requested INT         NOT NULL CHECK (units_requested > 0),
    urgency_level   VARCHAR(15) NOT NULL CHECK (urgency_level IN ('critical', 'high', 'normal')),
    status          VARCHAR(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dispatched', 'fulfilled')),
    notes           TEXT,
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.3 Walkathon Details
CREATE TABLE walkathon_detail (
    event_id          INT           PRIMARY KEY REFERENCES event(event_id) ON DELETE CASCADE,
    route_description TEXT          NOT NULL,
    distance_km       NUMERIC(5,2)  NOT NULL CHECK (distance_km > 0),
    reporting_time    VARCHAR(20)   NOT NULL,
    start_point       VARCHAR(150)  NOT NULL,
    end_point         VARCHAR(150)  NOT NULL,
    cause_theme       VARCHAR(150)  NOT NULL
);

-- 2.4 Project Pustak Book Donations (linked to School / NGO in organisation)
CREATE TABLE pustak_donation (
    pustak_id          SERIAL PRIMARY KEY,
    event_id           INT          NOT NULL REFERENCES event(event_id) ON DELETE CASCADE,
    student_id         INT          NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
    book_category      VARCHAR(50)  NOT NULL CHECK (book_category IN ('Textbooks', 'Storybooks', 'Reference Books', 'Notebooks & Stationery')),
    quantity           INT          NOT NULL CHECK (quantity > 0),
    org_id             INT          REFERENCES organisation(org_id) ON DELETE SET NULL,
    target_school_name VARCHAR(150) NOT NULL,
    donated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 2.5 Fistfull Grain Donations (5 kg Rice or 2 kg Toor Dal -> 10 AP, linked to NGO in organisation)
CREATE TABLE fistfull_donation (
    fistfull_id SERIAL PRIMARY KEY,
    event_id    INT          NOT NULL REFERENCES event(event_id) ON DELETE CASCADE,
    student_id  INT          NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
    item_type   VARCHAR(20)  NOT NULL CHECK (item_type IN ('rice_5kg', 'toor_dal_2kg')),
    quantity_kg NUMERIC(5,2) NOT NULL CHECK (quantity_kg > 0),
    verified_by INT          REFERENCES board_member(member_id) ON DELETE SET NULL,
    org_id      INT          REFERENCES organisation(org_id) ON DELETE SET NULL,
    donated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 2.6 Trek Details
CREATE TABLE trek_detail (
    event_id         INT          PRIMARY KEY REFERENCES event(event_id) ON DELETE CASCADE,
    hill_name        VARCHAR(150) NOT NULL,
    location_area    VARCHAR(150) NOT NULL,
    elevation_m      INT          NOT NULL CHECK (elevation_m > 0),
    trek_distance_km NUMERIC(5,2) NOT NULL CHECK (trek_distance_km > 0),
    difficulty       VARCHAR(20)  NOT NULL CHECK (difficulty IN ('Easy', 'Moderate', 'Challenging')),
    pickup_point     VARCHAR(150) NOT NULL,
    departure_time   VARCHAR(20)  NOT NULL,
    checklist        TEXT         NOT NULL
);

-- ============================================================================
-- 3. ACTIVITY POINTS VALIDATION TRIGGER (Enforces Attendance Verification)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_validate_ap_after_attendance()
RETURNS TRIGGER AS $$
DECLARE
    v_status     VARCHAR(15);
    v_reg_stu_id INT;
    v_reg_ev_id  INT;
BEGIN
    SELECT a.attendance_status, r.student_id, r.event_id
      INTO v_status, v_reg_stu_id, v_reg_ev_id
      FROM attendance a
      JOIN registration r ON r.registration_id = a.registration_id
     WHERE a.attendance_id = NEW.attendance_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cannot award activity points: attendance_id % does not exist.', NEW.attendance_id;
    END IF;

    IF v_status <> 'present' THEN
        RAISE EXCEPTION 'Activity points can only be awarded when attendance_status is present (found: %).', v_status;
    END IF;

    IF NEW.student_id <> v_reg_stu_id OR NEW.event_id <> v_reg_ev_id THEN
        RAISE EXCEPTION 'Student/Event mismatch between activity_points and attendance registration.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_ap_after_attendance
BEFORE INSERT OR UPDATE ON activity_points
FOR EACH ROW
EXECUTE FUNCTION fn_validate_ap_after_attendance();

-- ============================================================================
-- 4. REPORTING VIEWS
-- ============================================================================

CREATE VIEW v_student_activity_summary AS
SELECT
    s.student_id,
    s.usn,
    s.name,
    s.email,
    s.department,
    s.semester,
    COALESCE(SUM(ap.points_awarded), 0)::INT AS total_activity_points,
    COUNT(CASE WHEN a.attendance_status = 'present' THEN 1 END)::INT AS events_attended,
    COUNT(r.registration_id)::INT AS events_registered
FROM student s
LEFT JOIN registration r ON r.student_id = s.student_id
LEFT JOIN attendance a ON a.registration_id = r.registration_id
LEFT JOIN activity_points ap ON ap.attendance_id = a.attendance_id
GROUP BY s.student_id, s.usn, s.name, s.email, s.department, s.semester;

CREATE VIEW v_blood_inventory AS
SELECT
    b.blood_group,
    COUNT(b.donation_id)::INT AS donor_count,
    COALESCE(SUM(b.units_donated), 0)::INT AS total_units_collected,
    COALESCE(SUM(CASE WHEN b.urgency_status = 'available' THEN b.units_donated ELSE 0 END), 0)::INT AS available_units,
    COALESCE(SUM(CASE WHEN b.urgency_status = 'dispatched' THEN b.units_donated ELSE 0 END), 0)::INT AS dispatched_units
FROM blood_camp_donation b
GROUP BY b.blood_group;

CREATE VIEW v_event_participation_stats AS
SELECT
    e.event_id,
    e.title,
    e.event_type,
    e.event_date,
    e.status,
    e.activity_points AS points_per_attendance,
    COUNT(r.registration_id)::INT AS registered_count,
    COUNT(CASE WHEN a.attendance_status = 'present' THEN 1 END)::INT AS present_count,
    COUNT(CASE WHEN a.attendance_status = 'absent' THEN 1 END)::INT AS absent_count,
    COUNT(CASE WHEN a.verification_method = 'qr' AND a.attendance_status = 'present' THEN 1 END)::INT AS qr_verified_count,
    COALESCE(SUM(ap.points_awarded), 0)::INT AS total_points_awarded
FROM event e
LEFT JOIN registration r ON r.event_id = e.event_id
LEFT JOIN attendance a ON a.registration_id = r.registration_id
LEFT JOIN activity_points ap ON ap.attendance_id = a.attendance_id
GROUP BY e.event_id, e.title, e.event_type, e.event_date, e.status, e.activity_points;

-- ============================================================================
-- 5. SEED DATA (Werkzeug PBKDF2-SHA256 Password Hashes)
--    Demo student password:      rvce123
--    Demo board member password: rotary123
-- ============================================================================

INSERT INTO student (usn, name, email, password_hash, department, semester, phone, blood_group) VALUES
('1RV23CS001', 'Deeksha Verma',  'deeksha.cs23@rvce.edu.in',  'pbkdf2:sha256:1000000$XNJc8yOn9VRtKdek$18fbfd86a02f0917f1a41e742f40dbb0d419dc06e3b6c287e9ca88763b60620d', 'Computer Science & Engg', 5, '9876543210', 'O+'),
('1RV23CS002', 'Riya Sharma',    'riya.cs23@rvce.edu.in',     'pbkdf2:sha256:1000000$XNJc8yOn9VRtKdek$18fbfd86a02f0917f1a41e742f40dbb0d419dc06e3b6c287e9ca88763b60620d', 'Computer Science & Engg', 5, '9876543211', 'A+'),
('1RV23IS012', 'Ananya Rao',     'ananya.is23@rvce.edu.in',   'pbkdf2:sha256:1000000$XNJc8yOn9VRtKdek$18fbfd86a02f0917f1a41e742f40dbb0d419dc06e3b6c287e9ca88763b60620d', 'Information Science',     5, '9876543212', 'B+'),
('1RV23EC045', 'Ishaan Gupta',   'ishaan.ec23@rvce.edu.in',   'pbkdf2:sha256:1000000$XNJc8yOn9VRtKdek$18fbfd86a02f0917f1a41e742f40dbb0d419dc06e3b6c287e9ca88763b60620d', 'Electronics & Comm',      5, '9876543213', 'AB+'),
('1RV24CS019', 'Sneha Iyer',     'sneha.cs24@rvce.edu.in',    'pbkdf2:sha256:1000000$XNJc8yOn9VRtKdek$18fbfd86a02f0917f1a41e742f40dbb0d419dc06e3b6c287e9ca88763b60620d', 'Computer Science & Engg', 3, '9876543214', 'O-'),
('1RV24ME031', 'Karthik Hegde',  'karthik.me24@rvce.edu.in',  'pbkdf2:sha256:1000000$XNJc8yOn9VRtKdek$18fbfd86a02f0917f1a41e742f40dbb0d419dc06e3b6c287e9ca88763b60620d', 'Mechanical Engg',         3, '9876543215', 'B-'),
('1RV23AI008', 'Pranav Kulkarni','pranav.ai23@rvce.edu.in',   'pbkdf2:sha256:1000000$XNJc8yOn9VRtKdek$18fbfd86a02f0917f1a41e742f40dbb0d419dc06e3b6c287e9ca88763b60620d', 'AI & Machine Learning',   5, '9876543216', 'A-'),
('1RV24BT011', 'Meera Nair',     'meera.bt24@rvce.edu.in',    'pbkdf2:sha256:1000000$XNJc8yOn9VRtKdek$18fbfd86a02f0917f1a41e742f40dbb0d419dc06e3b6c287e9ca88763b60620d', 'Biotechnology',           3, '9876543217', 'O+');

INSERT INTO board_member (college_id, rotary_number, password_hash, name, designation, portfolio, photo_url, department, email, phone, tenure_year, display_order) VALUES
('1RV23CS001B', 'RI-3191-101', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Pavana',       'President',                              'Core Board',               '/images/board/pavana.jpg',      'Computer Science & Engg', 'pavana.cs23@rvce.edu.in',      '9845011101', '2026-27', 1),
('1RV23EC002B', 'RI-3191-102', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Aditya K',     'Vice President',                         'Core Board',               '/images/board/aditya_k.jpg',    'Electronics & Comm',      'adityak.ec23@rvce.edu.in',     '9845011102', '2026-27', 2),
('1RV23ME003B', 'RI-3191-103', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Darshan',      'Treasurer',                              'Core Board',               '/images/board/darshan.jpg',     'Mechanical Engg',         'darshan.me23@rvce.edu.in',     '9845011103', '2026-27', 3),
('1RV23IS004B', 'RI-3191-104', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Priyansh',     'Secretary',                              'Secretariat',              '/images/board/priyansh.jpg',    'Information Science',     'priyansh.is23@rvce.edu.in',    '9845011104', '2026-27', 4),
('1RV23CS005B', 'RI-3191-105', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Afnaan',       'Joint Secretary',                        'Secretariat',              '/images/board/afnaan.jpg',      'Computer Science & Engg', 'afnaan.cs23@rvce.edu.in',      '9845011105', '2026-27', 5),
('1RV23AI006B', 'RI-3191-106', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Raghava',      'Joint Secretary',                        'Secretariat',              '/images/board/raghava.jpg',     'AI & Machine Learning',   'raghava.ai23@rvce.edu.in',     '9845011106', '2026-27', 6),
('1RV23BT007B', 'RI-3191-107', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Ritisha',      'Joint Secretary',                        'Secretariat',              '/images/board/ritisha.jpg',     'Biotechnology',           'ritisha.bt23@rvce.edu.in',     '9845011107', '2026-27', 7),
('1RV23CS008B', 'RI-3191-108', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Vedant',       'Director - Club Services',               'Club Services',            '/images/board/vedant.jpg',      'Computer Science & Engg', 'vedant.cs23@rvce.edu.in',      '9845011108', '2026-27', 8),
('1RV23CS009B', 'RI-3191-109', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Deeksha',      'Joint Director - Club Services',         'Club Services',            '/images/board/deeksha.jpg',     'Computer Science & Engg', 'deeksha.cs23@rvce.edu.in',     '9845011109', '2026-27', 9),
('1RV23EC010B', 'RI-3191-110', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Dhanush',      'Joint Director - Club Services',         'Club Services',            '/images/board/dhanush.jpg',     'Electronics & Comm',      'dhanush.ec23@rvce.edu.in',     '9845011110', '2026-27', 10),
('1RV23IS011B', 'RI-3191-111', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Sumana',       'Director - Community Services',          'Community Services',       '/images/board/sumana.jpg',      'Information Science',     'sumana.is23@rvce.edu.in',      '9845011111', '2026-27', 11),
('1RV23EE012B', 'RI-3191-112', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Kavyashree',   'Joint Director - Community Services',    'Community Services',       '/images/board/kavyashree.jpg',  'Electrical & Electronics','kavyashree.ee23@rvce.edu.in',  '9845011112', '2026-27', 12),
('1RV23CV013B', 'RI-3191-113', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Sakshi',       'Joint Director - Community Services',    'Community Services',       '/images/board/sakshi.jpg',      'Civil Engg',              'sakshi.cv23@rvce.edu.in',      '9845011113', '2026-27', 13),
('1RV23ME014B', 'RI-3191-114', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Ghanashyam',   'Director - Finance',                     'Finance',                  '/images/board/ghanashyam.jpg',  'Mechanical Engg',         'ghanashyam.me23@rvce.edu.in',  '9845011114', '2026-27', 14),
('1RV23CH015B', 'RI-3191-115', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Aditya',       'Joint Director - Finance',               'Finance',                  '/images/board/aditya_fin.jpg',  'Chemical Engg',           'aditya.ch23@rvce.edu.in',      '9845011115', '2026-27', 15),
('1RV23AE016B', 'RI-3191-116', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Advik',        'Director - International Services',      'International Services',   '/images/board/advik.jpg',       'Aerospace Engg',          'advik.ae23@rvce.edu.in',       '9845011116', '2026-27', 16),
('1RV23CS017B', 'RI-3191-117', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Anwesha',      'Joint Director - International Services','International Services',   '/images/board/anwesha.jpg',     'Computer Science & Engg', 'anwesha.cs23@rvce.edu.in',     '9845011117', '2026-27', 17),
('1RV23EC018B', 'RI-3191-118', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Aryan',        'Joint Director - International Services','International Services',   '/images/board/aryan.jpg',       'Electronics & Comm',      'aryan.ec23@rvce.edu.in',       '9845011118', '2026-27', 18),
('1RV23IS019B', 'RI-3191-119', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Nihar',        'Director - Literary Services',           'Literary Services',        '/images/board/nihar.jpg',       'Information Science',     'nihar.is23@rvce.edu.in',       '9845011119', '2026-27', 19),
('1RV23BT020B', 'RI-3191-120', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Aayushi',      'Joint Director - Literary Services',     'Literary Services',        '/images/board/aayushi.jpg',     'Biotechnology',           'aayushi.bt23@rvce.edu.in',     '9845011120', '2026-27', 20),
('1RV23AI021B', 'RI-3191-121', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Ashutosh',     'Joint Director - Literary Services',     'Literary Services',        '/images/board/ashutosh.jpg',    'AI & Machine Learning',   'ashutosh.ai23@rvce.edu.in',    '9845011121', '2026-27', 21),
('1RV23ME022B', 'RI-3191-122', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Chandrakant',  'Director - Professional Development',    'Professional Development', '/images/board/chandrakant.jpg', 'Mechanical Engg',         'chandrakant.me23@rvce.edu.in', '9845011122', '2026-27', 22),
('1RV23EC023B', 'RI-3191-123', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Stuthi',       'Joint Director - Professional Development','Professional Development','/images/board/stuthi.jpg',      'Electronics & Comm',      'stuthi.ec23@rvce.edu.in',      '9845011123', '2026-27', 23),
('1RV23CS024B', 'RI-3191-124', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Pranjal',      'Director - Public Image',                'Public Image',             '/images/board/pranjal.jpg',     'Computer Science & Engg', 'pranjal.cs23@rvce.edu.in',     '9845011124', '2026-27', 24),
('1RV23IS025B', 'RI-3191-125', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Akshaj',       'Joint Director - Public Image',          'Public Image',             '/images/board/akshaj.jpg',      'Information Science',     'akshaj.is23@rvce.edu.in',      '9845011125', '2026-27', 25),
('1RV23BT026B', 'RI-3191-126', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Madiha',       'Joint Director - Public Image',          'Public Image',             '/images/board/madiha.jpg',      'Biotechnology',           'madiha.bt23@rvce.edu.in',      '9845011126', '2026-27', 26),
('1RV23EC027B', 'RI-3191-127', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Shreya',       'Joint Director - Public Image',          'Public Image',             '/images/board/shreya.jpg',      'Electronics & Comm',      'shreya.ec23@rvce.edu.in',      '9845011127', '2026-27', 27),
('1RV22CS028B', 'RI-3191-128', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Pratham',      'Immediate Past President',               'Advisory & Protocol',      '/images/board/pratham.jpg',     'Computer Science & Engg', 'pratham.cs22@rvce.edu.in',     '9845011128', '2026-27', 28),
('1RV23IS029B', 'RI-3191-129', 'pbkdf2:sha256:1000000$195QsLyyHOw4Ssou$b0ad51ebbce04a7725c5c71781b963beefdc39a23100c30b1d1a945fec8bdf6f', 'Rtr. Divya',        'Sergeant-at-Arms',                       'Advisory & Protocol',      '/images/board/divya.jpg',       'Information Science',     'divya.is23@rvce.edu.in',       '9845011129', '2026-27', 29);

-- Organisations: NGOs, Schools, Hospitals, Blood Banks
INSERT INTO organisation (name, org_type, category, contact_person, phone, email, address, description) VALUES
('Rotary Bangalore Blood Bank',            'Blood Bank', 'Healthcare',    'Dr. Suresh Bhat',         '+91 98765 43210', 'bloodbank@rotaryblr.org',        'Lavelle Road, Bengaluru 560001',            'Regional Rotary blood bank supporting campus camps and emergency hospital dispatches.'),
('Smile Foundation',                       'NGO',        'Education',     'Meenakshi Deshmukh',      '+91 87654 32109', 'karnataka@smilefoundation.org',  'Indiranagar 2nd Stage, Bengaluru 560038',   'Empowers underprivileged children through school supplies, books, and learning support.'),
('Akshaya Patra & FeedIndia',              'NGO',        'Food & Hunger', 'Raghavendra Rao',         '+91 99001 23456', 'connect@feedindia.org',          'Rajajinagar Industrial Area, Bengaluru',    'Collects staple grains like rice and toor dal for community kitchens and orphanages.'),
('Goonj Bengaluru',                        'NGO',        'Community',     'Nandini Verma',           '+91 65432 10987', 'blr@goonj.org',                  'Jayanagar 4th Block, Bengaluru 560011',     'Disaster relief, rural education kits, and community grain distribution drives.'),
('GiveIndia Partner Network',              'NGO',        'Community',     'Vikram Sethi',            '+91 76543 21098', 'partners@giveindia.org',         'Koramangala 5th Block, Bengaluru 560095',   'Connects campus volunteers with verified local grassroots initiatives.'),
('Kengeri Govt. High School',              'School',     'Education',     'Headmaster Shivakumar',   '+91 94480 55678', 'kengeri.school@karnataka.edu.in','Kengeri Satellite Town, Bengaluru 560060',  'Public school near RVCE receiving textbooks and notebooks under Project Pustak.'),
('EcoWatch Karnataka',                     'NGO',        'Environment',   'Harish Gowda',            '+91 97310 88990', 'trails@ecowatch.in',             'Malleshwaram 8th Cross, Bengaluru 560003',  'Trail conservation, zero-waste trekking, and hill clean-up partner.'),
('KC General Hospital',                    'Hospital',   'Healthcare',    'Dr. Prakash Shetty',      '+91 80 2334 1771','bloodbank@kcgh.gov.in',          'Malleshwaram, Bengaluru 560003',            'Government hospital blood bank linked for urgent trauma and surgical blood access.'),
('Victoria Hospital (BMCRI)',              'Hospital',   'Healthcare',    'Dr. Kavitha Murthy',      '+91 80 2670 1150','emergency.blood@victoria.gov.in','Fort Road, KR Market, Bengaluru 560002',    'Tertiary government hospital receiving urgent O-/O+ blood dispatches.'),
('Rajarajeswari Medical College Hospital', 'Hospital',   'Healthcare',    'Dr. Naveen Kumar',        '+91 80 2843 7444','bloodunit@rrmch.org',            'Mysore Road, Kambipura, Bengaluru 560074',  'Nearby Mysore Road hospital linked with RVCE Blood Donation Camps.'),
('St. Johns Medical College Hospital',     'Hospital',   'Healthcare',    'Dr. Anitha George',       '+91 80 2206 5000','transfusion@stjohns.in',         'Sarjapur Road, Koramangala, Bengaluru',     'Teaching hospital transfusion medicine partner.');

-- Events
INSERT INTO event (title, event_type, short_tagline, description, event_date, start_time, end_time, venue, activity_points, status, poc_member_id, poc_name, poc_phone, qr_token, qr_active, qr_enabled_by, created_by) VALUES
('Blood Donation Camp',             'blood_donation', 'Donate blood, save lives.',                               'Annual RVCE Mega Blood Donation Camp in collaboration with Rotary Bangalore Blood Bank and partner hospitals for urgent surgical and trauma requirements.', '2026-12-05', '09:00 AM', '02:00 PM', 'RVCE IEM Auditorium',                     30, 'upcoming', 1,  'Rtr. Pavana',   '9845011101', 'QR-RVCE-BDC-2026-01', TRUE, 1,  1),
('Walkathon',                       'walkathon',      'Walk for a healthier & greener community.',               'A 5 km morning awareness walkathon around RVCE Campus and Mysore Road corridor promoting cardiovascular health, youth fitness, and road safety.',        '2026-11-29', '06:00 AM', '08:30 AM', 'RVCE Main Quadrangle (Start)',            20, 'upcoming', 2,  'Rtr. Aditya K', '9845011102', 'QR-RVCE-WLK-2026-02', TRUE, 2,  2),
('Project Pustak',                  'project_pustak', 'Donate books, spread the joy of learning.',               'Collect textbooks, storybooks, and fresh notebooks from RVCE students and deliver them directly to partner NGOs and Kengeri Govt. High School.',         '2026-12-15', '10:00 AM', '03:30 PM', 'Govt. School Kengeri & RVCE Desk',        15, 'upcoming', 4,  'Rtr. Priyansh', '9845011104', 'QR-RVCE-PST-2026-03', TRUE, 4,  4),
('Fistfull - Grain Donation Drive', 'fistfull',       'Donate 5 kg Rice or 2 kg Toor Dal & earn 10 AP.',       'Every RVCE student can contribute either 5 kg of Rice OR 2 kg of Toor Dal. Verified donations earn 10 Activity Points and support food-security NGOs.',  '2026-12-10', '09:30 AM', '04:00 PM', 'RVCE Student Activity Centre',            10, 'upcoming', 3,  'Rtr. Darshan',  '9845011103', 'QR-RVCE-FST-2026-04', TRUE, 3,  3),
('Skandagiri Sunrise Trek',         'trek',           'Conquer the clouds on an eco-clean trek.',                'Guided dawn trek to Skandagiri Hills (Kalavara Durga) combining outdoor adventure with a trail clean-up drive alongside EcoWatch Karnataka.',           '2026-12-20', '04:00 AM', '02:00 PM', 'Skandagiri Hills (Bus: RVCE Main Gate)',  20, 'upcoming', 8,  'Rtr. Vedant',   '9845011108', 'QR-RVCE-TRK-2026-05', TRUE, 8,  8),
('Blood Donation Camp - Monsoon',   'blood_donation', 'Emergency blood reserve drive for city hospitals.',       'Completed blood donation drive that collected units and fulfilled critical emergency requests across KC General and Victoria Hospital.',                '2026-09-18', '09:00 AM', '01:30 PM', 'RVCE Main Auditorium',                    30, 'past',     1,  'Rtr. Pavana',   '9845011101', 'QR-RVCE-BDC-2026-06', FALSE, 1, 1),
('Fistfull - Independence Drive',   'fistfull',       '5 kg Rice / 2 kg Toor Dal student grain drive.',          'Completed grain collection drive supporting Akshaya Patra & Goonj Bengaluru.',                                                                         '2026-08-22', '10:00 AM', '03:00 PM', 'RVCE Quadrangle',                         10, 'past',     11, 'Rtr. Sumana',   '9845011111', 'QR-RVCE-FST-2026-07', FALSE, 11, 11),
('Nandi Hills Heritage Trek',       'trek',           'Morning fitness & plastic-free hill trek.',               'Completed Rotaract trek to Nandi Hills with RVCE student trekkers and EcoWatch volunteers.',                                                          '2026-07-19', '04:30 AM', '01:00 PM', 'Nandi Hills Base (Pickup: RVCE Gate)',    20, 'past',     8,  'Rtr. Vedant',   '9845011108', 'QR-RVCE-TRK-2026-08', FALSE, 8,  8);

-- Event <-> Organisation Links (ONLY associated organisations per event)
INSERT INTO event_organisation (event_id, org_id, partnership_role) VALUES
(1, 1,  'Blood Collection & Screening Partner'),
(1, 8,  'Urgency Hospital Partner'),
(1, 9,  'Urgency Hospital Partner'),
(1, 10, 'Regional Hospital Partner'),
(2, 5,  'Health & Community Outreach Partner'),
(3, 2,  'School Distribution Partner'),
(3, 6,  'Beneficiary Partner School'),
(4, 3,  'Grain Collection & Kitchen Partner'),
(4, 4,  'Community Ration Distribution'),
(5, 7,  'Eco-Trail & Safety Partner'),
(6, 1,  'Blood Bank Partner'),
(6, 8,  'Emergency Dispatch Hospital'),
(6, 9,  'Emergency Dispatch Hospital'),
(7, 3,  'Food Grain Beneficiary'),
(7, 4,  'Rural Ration Partner'),
(8, 7,  'Trail Cleanup Partner');

-- Walkathon & Trek Details
INSERT INTO walkathon_detail (event_id, route_description, distance_km, reporting_time, start_point, end_point, cause_theme) VALUES
(2, 'RVCE Main Gate -> Pattanagere Metro Junction -> Kengeri Bus Terminal -> RVCE Quadrangle', 5.00, '05:45 AM', 'RVCE Main Quadrangle', 'RVCE Sports Ground', 'Youth Heart Health & Campus Fitness');

INSERT INTO trek_detail (event_id, hill_name, location_area, elevation_m, trek_distance_km, difficulty, pickup_point, departure_time, checklist) VALUES
(5, 'Skandagiri Hills (Kalavara Durga)', 'Chikkaballapur District, Karnataka', 1450, 8.20, 'Moderate', 'RVCE Main Gate Bus Bay', '04:00 AM', 'Trekking shoes, 2L water, torch/headlamp, light jacket, college ID card, reusable waste bag'),
(8, 'Nandi Hills (Brahmagiri Trail)',    'Chikkaballapur District, Karnataka', 1478, 6.50, 'Easy',     'RVCE Main Gate Bus Bay', '04:30 AM', 'Sports shoes, 1.5L water, cap, college ID card');

-- Registrations
INSERT INTO registration (event_id, student_id) VALUES
(6, 1), (6, 2), (6, 3), (6, 4), (6, 5), (6, 6), (6, 7), (6, 8), -- 1..8
(7, 1), (7, 3), (7, 5),                                         -- 9..11
(8, 1), (8, 2), (8, 6),                                         -- 12..14
(2, 1), (2, 2), (2, 3), (2, 4), (2, 5),                         -- 15..19
(1, 2), (1, 4),                                                 -- 20..21
(3, 1), (3, 3),                                                 -- 22..23
(5, 1),                                                         -- 24
(4, 2);                                                         -- 25

-- Verified Attendance
INSERT INTO attendance (registration_id, attendance_status, verification_method, verified_by) VALUES
(1,  'present', 'manual', 1),
(2,  'present', 'manual', 1),
(3,  'present', 'manual', 1),
(4,  'absent',  'manual', 1),
(5,  'present', 'qr',     1),
(6,  'present', 'manual', 1),
(7,  'present', 'qr',     1),
(8,  'present', 'manual', 1),
(9,  'present', 'manual', 11),
(10, 'present', 'qr',     11),
(11, 'present', 'manual', 11),
(12, 'present', 'qr',     8),
(13, 'present', 'manual', 8),
(14, 'present', 'manual', 8),
(22, 'present', 'manual', 4),
(23, 'present', 'manual', 4),
(25, 'present', 'manual', 3);

-- Activity Points (Trigger enforces attendance_status = 'present')
INSERT INTO activity_points (attendance_id, student_id, event_id, points_awarded, awarded_by) VALUES
(1,  1, 6, 30, 1),
(2,  2, 6, 30, 1),
(3,  3, 6, 30, 1),
(5,  5, 6, 30, 1),
(6,  6, 6, 30, 1),
(7,  7, 6, 30, 1),
(8,  8, 6, 30, 1),
(9,  1, 7, 10, 11),
(10, 3, 7, 10, 11),
(11, 5, 7, 10, 11),
(12, 1, 8, 20, 8),
(13, 2, 8, 20, 8),
(14, 6, 8, 20, 8),
(15, 1, 3, 15, 4),
(16, 3, 3, 15, 4),
(17, 2, 4, 10, 3);

-- Blood Donations & Urgency Requests (linked to Hospitals in organisation)
INSERT INTO blood_camp_donation (event_id, student_id, blood_group, units_donated, volume_ml, org_id, donor_phone, urgency_status) VALUES
(6, 1, 'O+', 1, 350, 8,  '9876543210', 'available'),
(6, 2, 'A+', 1, 350, 8,  '9876543211', 'dispatched'),
(6, 3, 'B+', 1, 350, 9,  '9876543212', 'available'),
(6, 5, 'O-', 1, 350, 9,  '9876543214', 'reserved_urgent'),
(6, 6, 'B-', 1, 350, 10, '9876543215', 'available'),
(6, 7, 'A-', 1, 350, 11, '9876543216', 'available'),
(6, 8, 'O+', 1, 350, 8,  '9876543217', 'dispatched');

INSERT INTO blood_urgency_request (org_id, event_id, blood_group, units_requested, urgency_level, status, notes) VALUES
(8,  6, 'O+', 1, 'critical', 'dispatched', 'Emergency trauma ward dispatch from RVCE Monsoon Camp'),
(9,  6, 'O-', 1, 'critical', 'pending',    'ICU universal donor urgent requirement at Victoria Hospital'),
(10, 1, 'B+', 2, 'high',     'pending',    'Pre-booking urgent units from upcoming Dec 5 RVCE Blood Camp');

-- Project Pustak & Fistfull Donations
INSERT INTO pustak_donation (event_id, student_id, book_category, quantity, org_id, target_school_name) VALUES
(3, 1, 'Textbooks',  6,  6, 'Kengeri Govt. High School'),
(3, 3, 'Storybooks', 10, 2, 'Smile Learning Centre, Mysore Road');

INSERT INTO fistfull_donation (event_id, student_id, item_type, quantity_kg, verified_by, org_id) VALUES
(7, 1, 'rice_5kg',     5.00, 11, 3),
(7, 3, 'toor_dal_2kg', 2.00, 11, 4),
(7, 5, 'rice_5kg',     5.00, 11, 3),
(4, 2, 'toor_dal_2kg', 2.00, 3,  3);

COMMIT;
