-- ============================================================================
-- Seed Data for Rotaract Club of RVCE DBMS Portal
-- ============================================================================
PRAGMA foreign_keys = ON;

-- 1. Students (Default password for demo students: rvce123)
INSERT INTO students (usn, name, email, password_hash, department, semester, phone, blood_group) VALUES
('1RV23CS001', 'Deeksha Verma', 'deeksha.cs23@rvce.edu.in', 'rvce123', 'Computer Science & Engg', 5, '9876543210', 'O+'),
('1RV23CS002', 'Riya Sharma', 'riya.cs23@rvce.edu.in', 'rvce123', 'Computer Science & Engg', 5, '9876543211', 'A+'),
('1RV23IS012', 'Ananya Rao', 'ananya.is23@rvce.edu.in', 'rvce123', 'Information Science', 5, '9876543212', 'B+'),
('1RV23EC045', 'Ishaan Gupta', 'ishaan.ec23@rvce.edu.in', 'rvce123', 'Electronics & Comm', 5, '9876543213', 'AB+'),
('1RV24CS019', 'Sneha Iyer', 'sneha.cs24@rvce.edu.in', 'rvce123', 'Computer Science & Engg', 3, '9876543214', 'O-'),
('1RV24ME031', 'Karthik Hegde', 'karthik.me24@rvce.edu.in', 'rvce123', 'Mechanical Engg', 3, '9876543215', 'B-'),
('1RV23AI008', 'Pranav Kulkarni', 'pranav.ai23@rvce.edu.in', 'rvce123', 'AI & Machine Learning', 5, '9876543216', 'A-'),
('1RV24BT011', 'Meera Nair', 'meera.bt24@rvce.edu.in', 'rvce123', 'Biotechnology', 3, '9876543217', 'O+');

-- 2. Board Members (Actual Rotaract Club of RVCE Board 2026-27, District 3191)
INSERT INTO board_members (college_id, rotary_number, name, designation, portfolio, photo_url, department, email, phone, tenure_year, display_order) VALUES
-- Core Board
('1RV23CS001B', 'RI-3191-101', 'Rtr. Pavana', 'President', 'Core Board', '/images/board/pavana.jpg', 'Computer Science & Engg', 'pavana.cs23@rvce.edu.in', '9845011101', '2026-27', 1),
('1RV23EC002B', 'RI-3191-102', 'Rtr. Aditya K', 'Vice President', 'Core Board', '/images/board/aditya_k.jpg', 'Electronics & Comm', 'adityak.ec23@rvce.edu.in', '9845011102', '2026-27', 2),
('1RV23ME003B', 'RI-3191-103', 'Rtr. Darshan', 'Treasurer', 'Core Board', '/images/board/darshan.jpg', 'Mechanical Engg', 'darshan.me23@rvce.edu.in', '9845011103', '2026-27', 3),
-- Secretariat
('1RV23IS004B', 'RI-3191-104', 'Rtr. Priyansh', 'Secretary', 'Secretariat', '/images/board/priyansh.jpg', 'Information Science', 'priyansh.is23@rvce.edu.in', '9845011104', '2026-27', 4),
('1RV23CS005B', 'RI-3191-105', 'Rtr. Afnaan', 'Joint Secretary', 'Secretariat', '/images/board/afnaan.jpg', 'Computer Science & Engg', 'afnaan.cs23@rvce.edu.in', '9845011105', '2026-27', 5),
('1RV23AI006B', 'RI-3191-106', 'Rtr. Raghava', 'Joint Secretary', 'Secretariat', '/images/board/raghava.jpg', 'AI & Machine Learning', 'raghava.ai23@rvce.edu.in', '9845011106', '2026-27', 6),
('1RV23BT007B', 'RI-3191-107', 'Rtr. Ritisha', 'Joint Secretary', 'Secretariat', '/images/board/ritisha.jpg', 'Biotechnology', 'ritisha.bt23@rvce.edu.in', '9845011107', '2026-27', 7),
-- Club Services
('1RV23CS008B', 'RI-3191-108', 'Rtr. Vedant', 'Director - Club Services', 'Club Services', '/images/board/vedant.jpg', 'Computer Science & Engg', 'vedant.cs23@rvce.edu.in', '9845011108', '2026-27', 8),
('1RV23CS009B', 'RI-3191-109', 'Rtr. Deeksha', 'Joint Director - Club Services', 'Club Services', '/images/board/deeksha.jpg', 'Computer Science & Engg', 'deeksha.cs23@rvce.edu.in', '9845011109', '2026-27', 9),
('1RV23EC010B', 'RI-3191-110', 'Rtr. Dhanush', 'Joint Director - Club Services', 'Club Services', '/images/board/dhanush.jpg', 'Electronics & Comm', 'dhanush.ec23@rvce.edu.in', '9845011110', '2026-27', 10),
-- Community Services
('1RV23IS011B', 'RI-3191-111', 'Rtr. Sumana', 'Director - Community Services', 'Community Services', '/images/board/sumana.jpg', 'Information Science', 'sumana.is23@rvce.edu.in', '9845011111', '2026-27', 11),
('1RV23EE012B', 'RI-3191-112', 'Rtr. Kavyashree', 'Joint Director - Community Services', 'Community Services', '/images/board/kavyashree.jpg', 'Electrical & Electronics', 'kavyashree.ee23@rvce.edu.in', '9845011112', '2026-27', 12),
('1RV23CV013B', 'RI-3191-113', 'Rtr. Sakshi', 'Joint Director - Community Services', 'Community Services', '/images/board/sakshi.jpg', 'Civil Engg', 'sakshi.cv23@rvce.edu.in', '9845011113', '2026-27', 13),
-- Finance
('1RV23ME014B', 'RI-3191-114', 'Rtr. Ghanashyam', 'Director - Finance', 'Finance', '/images/board/ghanashyam.jpg', 'Mechanical Engg', 'ghanashyam.me23@rvce.edu.in', '9845011114', '2026-27', 14),
('1RV23CH015B', 'RI-3191-115', 'Rtr. Aditya', 'Joint Director - Finance', 'Finance', '/images/board/aditya_fin.jpg', 'Chemical Engg', 'aditya.ch23@rvce.edu.in', '9845011115', '2026-27', 15),
-- International Services
('1RV23AE016B', 'RI-3191-116', 'Rtr. Advik', 'Director - International Services', 'International Services', '/images/board/advik.jpg', 'Aerospace Engg', 'advik.ae23@rvce.edu.in', '9845011116', '2026-27', 16),
('1RV23CS017B', 'RI-3191-117', 'Rtr. Anwesha', 'Joint Director - International Services', 'International Services', '/images/board/anwesha.jpg', 'Computer Science & Engg', 'anwesha.cs23@rvce.edu.in', '9845011117', '2026-27', 17),
('1RV23EC018B', 'RI-3191-118', 'Rtr. Aryan', 'Joint Director - International Services', 'International Services', '/images/board/aryan.jpg', 'Electronics & Comm', 'aryan.ec23@rvce.edu.in', '9845011118', '2026-27', 18),
-- Literary Services
('1RV23IS019B', 'RI-3191-119', 'Rtr. Nihar', 'Director - Literary Services', 'Literary Services', '/images/board/nihar.jpg', 'Information Science', 'nihar.is23@rvce.edu.in', '9845011119', '2026-27', 19),
('1RV23BT020B', 'RI-3191-120', 'Rtr. Aayushi', 'Joint Director - Literary Services', 'Literary Services', '/images/board/aayushi.jpg', 'Biotechnology', 'aayushi.bt23@rvce.edu.in', '9845011120', '2026-27', 20),
('1RV23AI021B', 'RI-3191-121', 'Rtr. Ashutosh', 'Joint Director - Literary Services', 'Literary Services', '/images/board/ashutosh.jpg', 'AI & Machine Learning', 'ashutosh.ai23@rvce.edu.in', '9845011121', '2026-27', 21),
-- Professional Development
('1RV23ME022B', 'RI-3191-122', 'Rtr. Chandrakant', 'Director - Professional Development', 'Professional Development', '/images/board/chandrakant.jpg', 'Mechanical Engg', 'chandrakant.me23@rvce.edu.in', '9845011122', '2026-27', 22),
('1RV23EC023B', 'RI-3191-123', 'Rtr. Stuthi', 'Joint Director - Professional Development', 'Professional Development', '/images/board/stuthi.jpg', 'Electronics & Comm', 'stuthi.ec23@rvce.edu.in', '9845011123', '2026-27', 23),
-- Public Image
('1RV23CS024B', 'RI-3191-124', 'Rtr. Pranjal', 'Director - Public Image', 'Public Image', '/images/board/pranjal.jpg', 'Computer Science & Engg', 'pranjal.cs23@rvce.edu.in', '9845011124', '2026-27', 24),
('1RV23IS025B', 'RI-3191-125', 'Rtr. Akshaj', 'Joint Director - Public Image', 'Public Image', '/images/board/akshaj.jpg', 'Information Science', 'akshaj.is23@rvce.edu.in', '9845011125', '2026-27', 25),
('1RV23BT026B', 'RI-3191-126', 'Rtr. Madiha', 'Joint Director - Public Image', 'Public Image', '/images/board/madiha.jpg', 'Biotechnology', 'madiha.bt23@rvce.edu.in', '9845011126', '2026-27', 26),
('1RV23EC027B', 'RI-3191-127', 'Rtr. Shreya', 'Joint Director - Public Image', 'Public Image', '/images/board/shreya.jpg', 'Electronics & Comm', 'shreya.ec23@rvce.edu.in', '9845011127', '2026-27', 27),
-- Past President & Sergeant-at-Arms
('1RV22CS028B', 'RI-3191-128', 'Rtr. Pratham', 'Immediate Past President', 'Advisory & Protocol', '/images/board/pratham.jpg', 'Computer Science & Engg', 'pratham.cs22@rvce.edu.in', '9845011128', '2026-27', 28),
('1RV23IS029B', 'RI-3191-129', 'Rtr. Divya', 'Sergeant-at-Arms', 'Advisory & Protocol', '/images/board/divya.jpg', 'Information Science', 'divya.is23@rvce.edu.in', '9845011129', '2026-27', 29);

-- 3. General NGOs Directory (Separate directory with contact phone numbers)
INSERT INTO ngos (name, category, contact_person, phone, email, address, description) VALUES
('Rotary Bangalore Blood Bank', 'Healthcare', 'Dr. Suresh Bhat', '+91 98765 43210', 'bloodbank@rotaryblr.org', 'Lavelle Road, Bengaluru 560001', 'Regional Rotary blood bank supporting campus camps and emergency hospital dispatches.'),
('Smile Foundation', 'Education', 'Meenakshi Deshmukh', '+91 87654 32109', 'karnataka@smilefoundation.org', 'Indiranagar 2nd Stage, Bengaluru 560038', 'Empowers underprivileged children through school supplies, books, and learning support.'),
('Akshaya Patra & FeedIndia', 'Food & Hunger', 'Raghavendra Rao', '+91 99001 23456', 'connect@feedindia.org', 'Rajajinagar Industrial Area, Bengaluru 560010', 'Collects staple grains like rice and toor dal for community kitchens and orphanages.'),
('Goonj Bengaluru', 'Community', 'Nandini Verma', '+91 65432 10987', 'blr@goonj.org', 'Jayanagar 4th Block, Bengaluru 560011', 'Disaster relief, rural education kits, and community grain distribution drives.'),
('GiveIndia Partner Network', 'Community', 'Vikram Sethi', '+91 76543 21098', 'partners@giveindia.org', 'Koramangala 5th Block, Bengaluru 560095', 'Connects campus volunteers with verified local grassroots initiatives.'),
('Kengeri Govt. School Trust', 'Education', 'Headmaster Shivakumar', '+91 94480 55678', 'kengeri.school@karnataka.edu.in', 'Kengeri Satellite Town, Bengaluru 560060', 'Public school network near RVCE receiving textbooks and notebooks under Project Pustak.'),
('EcoWatch Karnataka', 'Environment', 'Harish Gowda', '+91 97310 88990', 'trails@ecowatch.in', 'Malleshwaram 8th Cross, Bengaluru 560003', 'Trail conservation, zero-waste trekking, and hill clean-up partner.');

-- 4. Connected Hospitals (For Blood Donation Camp Urgency Access)
INSERT INTO hospitals (name, emergency_phone, blood_bank_email, address, urgency_contact_person) VALUES
('KC General Hospital', '+91 80 2334 1771', 'bloodbank@kcgh.gov.in', 'Malleshwaram, Bengaluru 560003', 'Dr. Prakash Shetty'),
('Victoria Hospital (BMCRI)', '+91 80 2670 1150', 'emergency.blood@victoria.gov.in', 'Fort Road, KR Market, Bengaluru 560002', 'Dr. Kavitha Murthy'),
('Rajarajeswari Medical College Hospital', '+91 80 2843 7444', 'bloodunit@rrmch.org', 'Mysore Road, Kambipura, Bengaluru 560074', 'Dr. Naveen Kumar'),
('St. Johns Medical College Hospital', '+91 80 2206 5000', 'transfusion@stjohns.in', 'Sarjapur Road, Koramangala, Bengaluru 560034', 'Dr. Anitha George');

-- 5. Events (All 5 Core Rotaract Events + Past/Upcoming split)
INSERT INTO events (title, event_type, short_tagline, description, event_date, start_time, end_time, venue, activity_points, status, created_by) VALUES
(
    'Blood Donation Camp',
    'blood_donation',
    'Donate blood, save lives.',
    'Annual RVCE Mega Blood Donation Camp organized in collaboration with Rotary Bangalore Blood Bank and partner government & teaching hospitals. Collected units are directly linked to partner hospital blood banks for urgent surgical and trauma requirements.',
    '2026-12-05',
    '09:00 AM',
    '02:00 PM',
    'RVCE IEM Auditorium',
    30,
    'upcoming',
    1
),
(
    'Walkathon',
    'walkathon',
    'Walk for a healthier & greener community.',
    'A 5 km morning awareness walkathon around RVCE Campus and Mysore Road corridor promoting cardiovascular health, youth fitness, and road safety.',
    '2026-11-29',
    '06:00 AM',
    '08:30 AM',
    'RVCE Main Quadrangle (Start)',
    20,
    'upcoming',
    2
),
(
    'Project Pustak',
    'project_pustak',
    'Donate books, spread the joy of learning.',
    'Collect gently used engineering textbooks, school storybooks, reference guides, and fresh notebooks from RVCE students and deliver them directly to partner NGOs and government schools around Kengeri.',
    '2026-12-15',
    '10:00 AM',
    '03:30 PM',
    'Govt. School Kengeri & RVCE Rotaract Desk',
    15,
    'upcoming',
    3
),
(
    'Fistfull - Grain Donation Drive',
    'fistfull',
    'Donate 5 kg Rice or 2 kg Toor Dal & earn 10 AP.',
    'Every RVCE student can contribute either 5 kg of Rice OR 2 kg of Toor Dal at the Rotaract collection counter. Verified donations earn 10 Activity Points and directly support partner food-security NGOs.',
    '2026-12-10',
    '09:30 AM',
    '04:00 PM',
    'RVCE Student Activity Centre',
    10,
    'upcoming',
    4
),
(
    'Skandagiri Sunrise Trek',
    'trek',
    'Conquer the clouds on an eco-clean trek.',
    'Guided dawn trek to Skandagiri Hills (Kalavara Durga) combining outdoor adventure with a trail clean-up drive alongside EcoWatch Karnataka.',
    '2026-12-20',
    '04:00 AM',
    '02:00 PM',
    'Skandagiri Hills (Bus from RVCE Main Gate)',
    20,
    'upcoming',
    5
),
(
    'Blood Donation Camp - Monsoon Edition',
    'blood_donation',
    'Emergency blood reserve drive for city hospitals.',
    'Previous semester blood donation drive that collected 54 units of blood and fulfilled critical emergency requests across KC General and Victoria Hospital.',
    '2026-09-18',
    '09:00 AM',
    '01:30 PM',
    'RVCE Main Auditorium',
    30,
    'past',
    1
),
(
    'Fistfull - Independence Drive',
    'fistfull',
    '5 kg Rice / 2 kg Toor Dal student grain drive.',
    'Completed grain collection drive where students donated over 180 kg of rice and 64 kg of toor dal to Akshaya Patra & Goonj.',
    '2026-08-22',
    '10:00 AM',
    '03:00 PM',
    'RVCE Quadrangle',
    10,
    'past',
    4
),
(
    'Nandi Hills Heritage Trek',
    'trek',
    'Morning fitness & plastic-free hill trek.',
    'Completed Rotaract trek to Nandi Hills with 65 RVCE student trekkers and EcoWatch volunteers.',
    '2026-07-19',
    '04:30 AM',
    '01:00 PM',
    'Nandi Hills Base (Pickup: RVCE Gate)',
    20,
    'past',
    5
);

-- 6. Event-NGO Connections (Specific NGOs linked to specific events)
INSERT INTO event_ngos (event_id, ngo_id, partnership_role) VALUES
(1, 1, 'Blood Collection & Screening Partner'),
(2, 5, 'Health & Community Outreach Partner'),
(3, 2, 'School Distribution Partner'),
(3, 6, 'Beneficiary School Network'),
(4, 3, 'Grain Collection & Kitchen Partner'),
(4, 4, 'Community Ration Distribution'),
(5, 7, 'Eco-Trail & Safety Partner'),
(6, 1, 'Blood Bank Partner'),
(7, 3, 'Food Grain Beneficiary'),
(7, 4, 'Rural Ration Partner'),
(8, 7, 'Trail Cleanup Partner');

-- 7. Event Specialization Details
INSERT INTO walkathon_details (event_id, route_description, distance_km, reporting_time, start_point, end_point, cause_theme) VALUES
(2, 'RVCE Main Gate -> Pattanagere Metro Junction -> Kengeri Bus Terminal -> RVCE Quadrangle', 5.0, '05:45 AM', 'RVCE Main Quadrangle', 'RVCE Sports Ground', 'Youth Heart Health & Campus Fitness');

INSERT INTO trek_details (event_id, hill_name, location_area, elevation_m, trek_distance_km, difficulty, pickup_point, departure_time, checklist) VALUES
(5, 'Skandagiri Hills (Kalavara Durga)', 'Chikkaballapur District, Karnataka', 1450, 8.2, 'Moderate', 'RVCE Main Gate Bus Bay', '04:00 AM', 'Trekking shoes, 2L water, torch/headlamp, light jacket, college ID card, reusable waste bag'),
(8, 'Nandi Hills (Brahmagiri Trail)', 'Chikkaballapur District, Karnataka', 1478, 6.5, 'Easy', 'RVCE Main Gate Bus Bay', '04:30 AM', 'Sports shoes, 1.5L water, cap, college ID card');

-- 8. Registrations & Attendance (Populating realistic student history)
-- Note: Events 6, 7, 8 are past events; 1..5 are upcoming (some students already registered or pre-donated)
INSERT INTO registrations (event_id, student_id, attendance_status, points_awarded, marked_by, marked_at) VALUES
-- Past Event 6: Blood Donation Monsoon (30 AP)
(6, 1, 'present', 30, 1, '2026-09-18 13:00:00'),
(6, 2, 'present', 30, 1, '2026-09-18 13:05:00'),
(6, 3, 'present', 30, 1, '2026-09-18 13:10:00'),
(6, 4, 'absent', 0, 1, '2026-09-18 13:15:00'),
-- Past Event 7: Fistfull Independence Drive (10 AP)
(7, 1, 'present', 10, 4, '2026-08-22 15:00:00'),
(7, 3, 'present', 10, 4, '2026-08-22 15:05:00'),
(7, 5, 'present', 10, 4, '2026-08-22 15:10:00'),
-- Past Event 8: Nandi Hills Trek (20 AP)
(8, 1, 'present', 20, 5, '2026-07-19 13:00:00'),
(8, 2, 'present', 20, 5, '2026-07-19 13:00:00'),
(8, 6, 'present', 20, 5, '2026-07-19 13:00:00'),
-- Upcoming registrations
(2, 1, 'registered', 0, NULL, NULL),
(2, 2, 'registered', 0, NULL, NULL),
(2, 3, 'registered', 0, NULL, NULL),
(2, 4, 'registered', 0, NULL, NULL),
(2, 5, 'registered', 0, NULL, NULL),
(1, 2, 'registered', 0, NULL, NULL),
(1, 4, 'registered', 0, NULL, NULL),
(3, 1, 'registered', 0, NULL, NULL),
(5, 1, 'registered', 0, NULL, NULL);

-- 9. Blood Donation Records (Linked to Hospitals)
INSERT INTO blood_camp_donations (event_id, student_id, blood_group, units_donated, volume_ml, hospital_id, donor_phone, urgency_status, donated_at) VALUES
(6, 1, 'O+', 1, 350, 1, '9876543210', 'available', '2026-09-18 10:15:00'),
(6, 2, 'A+', 1, 350, 1, '9876543211', 'dispatched', '2026-09-18 10:40:00'),
(6, 3, 'B+', 1, 350, 2, '9876543212', 'available', '2026-09-18 11:20:00'),
(6, 5, 'O-', 1, 350, 2, '9876543214', 'reserved_urgent', '2026-09-18 11:55:00'),
(6, 6, 'B-', 1, 350, 3, '9876543215', 'available', '2026-09-18 12:15:00'),
(6, 7, 'A-', 1, 350, 4, '9876543216', 'available', '2026-09-18 12:45:00'),
(6, 8, 'O+', 1, 350, 1, '9876543217', 'dispatched', '2026-09-18 13:05:00');

-- 10. Hospital Blood Urgency Requests
INSERT INTO blood_urgency_requests (hospital_id, event_id, blood_group, units_requested, urgency_level, status, notes, requested_at) VALUES
(1, 6, 'O+', 1, 'critical', 'dispatched', 'Emergency trauma ward dispatch from RVCE Monsoon Camp', '2026-09-18 15:20:00'),
(2, 6, 'O-', 1, 'critical', 'pending', 'ICU universal donor urgent requirement at Victoria Hospital', '2026-11-24 14:10:00'),
(3, 1, 'B+', 2, 'high', 'pending', 'Pre-booking urgent units from upcoming Dec 5 RVCE Blood Camp', '2026-11-24 16:30:00');

-- 11. Project Pustak Book Donations
INSERT INTO pustak_donations (event_id, student_id, book_category, quantity, recipient_ngo_id, target_school_name, donated_at) VALUES
(3, 1, 'Textbooks', 6, 6, 'Govt. High School, Kengeri', '2026-11-22 11:00:00'),
(3, 3, 'Storybooks', 10, 2, 'Smile Learning Centre, Mysore Road', '2026-11-23 14:30:00');

-- 12. Fistfull Donations (5 kg Rice OR 2 kg Toor Dal = 10 AP each)
INSERT INTO fistfull_donations (event_id, student_id, item_type, quantity_kg, points_earned, ngo_id, verified_by, donated_at) VALUES
(7, 1, 'rice_5kg', 5.0, 10, 3, 4, '2026-08-22 11:30:00'),
(7, 3, 'toor_dal_2kg', 2.0, 10, 4, 4, '2026-08-22 12:15:00'),
(7, 5, 'rice_5kg', 5.0, 10, 3, 4, '2026-08-22 13:00:00'),
(4, 2, 'toor_dal_2kg', 2.0, 10, 3, 4, '2026-11-24 10:15:00');
