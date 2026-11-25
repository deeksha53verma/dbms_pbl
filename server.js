import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getDb } from './database/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);
const TOKEN_SECRET = process.env.ROTARACT_SECRET || 'rotaract-rvce-dbms-lab-2026';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

// Initialize DB on startup
const db = getDb();

// --- Token helpers ---
function signToken(payload) {
    const encoded = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
    const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
    return `${encoded}.${sig}`;
}

function verifyToken(token) {
    if (!token || !token.includes('.')) return null;
    const [encoded, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
    if (sig !== expected) return null;
    try {
        return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
        return null;
    }
}

function getAuthUser(req) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    return verifyToken(token);
}

// --- HTTP helpers ---
function sendJson(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
}

async function readBody(req) {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk) => {
            raw += chunk;
            if (raw.length > 1_000_000) {
                reject(new Error('Payload too large'));
                req.destroy();
            }
        });
        req.on('end', () => {
            if (!raw.trim()) return resolve({});
            try {
                resolve(JSON.parse(raw));
            } catch {
                reject(new Error('Invalid JSON body'));
            }
        });
        req.on('error', reject);
    });
}

function enrichEvents(events, studentId = null) {
    const getNgos = db.prepare(`
        SELECT n.ngo_id, n.name, n.category, n.contact_person, n.phone, n.email, n.address, en.partnership_role
        FROM event_ngos en
        JOIN ngos n ON n.ngo_id = en.ngo_id
        WHERE en.event_id = ?
        ORDER BY n.name
    `);
    const getCounts = db.prepare(`
        SELECT
            COUNT(*) AS registered_count,
            COALESCE(SUM(CASE WHEN attendance_status = 'present' THEN 1 ELSE 0 END), 0) AS present_count
        FROM registrations
        WHERE event_id = ?
    `);
    const getStudentReg = studentId
        ? db.prepare('SELECT registration_id, attendance_status, points_awarded, registered_at FROM registrations WHERE event_id = ? AND student_id = ?')
        : null;
    const getWalkathon = db.prepare('SELECT * FROM walkathon_details WHERE event_id = ?');
    const getTrek = db.prepare('SELECT * FROM trek_details WHERE event_id = ?');
    const getBloodStats = db.prepare('SELECT COALESCE(SUM(units_donated), 0) AS total_units, COUNT(*) AS donor_count FROM blood_camp_donations WHERE event_id = ?');
    const getPustakStats = db.prepare('SELECT COALESCE(SUM(quantity), 0) AS total_books, COUNT(*) AS donor_count FROM pustak_donations WHERE event_id = ?');
    const getFistfullStats = db.prepare('SELECT COALESCE(SUM(quantity_kg), 0) AS total_kg, COUNT(*) AS donor_count FROM fistfull_donations WHERE event_id = ?');

    return events.map((ev) => {
        const counts = getCounts.get(ev.event_id);
        const ngos = getNgos.all(ev.event_id);
        const myReg = getStudentReg ? getStudentReg.get(ev.event_id, studentId) : null;
        let special = null;

        if (ev.event_type === 'walkathon') {
            special = getWalkathon.get(ev.event_id) || null;
        } else if (ev.event_type === 'trek') {
            special = getTrek.get(ev.event_id) || null;
        } else if (ev.event_type === 'blood_donation') {
            special = getBloodStats.get(ev.event_id);
        } else if (ev.event_type === 'project_pustak') {
            special = getPustakStats.get(ev.event_id);
        } else if (ev.event_type === 'fistfull') {
            special = getFistfullStats.get(ev.event_id);
        }

        return {
            ...ev,
            ngos,
            registered_count: counts.registered_count,
            present_count: counts.present_count,
            my_registration: myReg || null,
            special
        };
    });
}

// --- API Router ---
async function handleApi(req, res, urlObj) {
    const pathname = urlObj.pathname;
    const method = req.method;
    const user = getAuthUser(req);

    // 1. Demo credentials helper
    if (method === 'GET' && pathname === '/api/demo-accounts') {
        const students = db.prepare('SELECT usn, name, email, department, semester FROM students ORDER BY student_id LIMIT 4').all();
        const board = db.prepare('SELECT college_id, rotary_number, name, designation FROM board_members ORDER BY display_order LIMIT 4').all();
        return sendJson(res, 200, { students, board, defaultStudentPassword: 'rvce123' });
    }

    // 2. Student Login (must end with @rvce.edu.in)
    if (method === 'POST' && pathname === '/api/auth/student-login') {
        const { email, password } = await readBody(req);
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!cleanEmail.endsWith('@rvce.edu.in')) {
            return sendJson(res, 400, { error: 'Students must sign in using their official @rvce.edu.in email ID.' });
        }
        const student = db.prepare('SELECT * FROM students WHERE lower(email) = ?').get(cleanEmail);
        if (!student || student.password_hash !== String(password || '')) {
            return sendJson(res, 401, { error: 'Invalid RVCE email or password.' });
        }
        const token = signToken({ role: 'student', id: student.student_id, name: student.name, email: student.email, usn: student.usn });
        const { password_hash, ...safeStudent } = student;
        return sendJson(res, 200, { token, role: 'student', user: safeStudent });
    }

    // 3. Student Self-Registration (@rvce.edu.in enforced by API + SQL CHECK constraint)
    if (method === 'POST' && pathname === '/api/auth/student-register') {
        const { usn, name, email, password, department, semester, phone, blood_group } = await readBody(req);
        const cleanEmail = String(email || '').trim().toLowerCase();
        const cleanUsn = String(usn || '').trim().toUpperCase();
        if (!cleanEmail.endsWith('@rvce.edu.in')) {
            return sendJson(res, 400, { error: 'Email must end with @rvce.edu.in' });
        }
        if (!cleanUsn || !name || !password || !department || !phone) {
            return sendJson(res, 400, { error: 'Please fill in all required student fields.' });
        }
        try {
            const info = db.prepare(`
                INSERT INTO students (usn, name, email, password_hash, department, semester, phone, blood_group)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(cleanUsn, name.trim(), cleanEmail, String(password), department.trim(), Number(semester || 5), phone.trim(), blood_group || 'O+');

            const student = db.prepare('SELECT student_id, usn, name, email, department, semester, phone, blood_group FROM students WHERE student_id = ?').get(info.lastInsertRowid);
            const token = signToken({ role: 'student', id: student.student_id, name: student.name, email: student.email, usn: student.usn });
            return sendJson(res, 201, { token, role: 'student', user: student });
        } catch (err) {
            return sendJson(res, 409, { error: err.message.includes('UNIQUE') ? 'USN or @rvce.edu.in email is already registered.' : err.message });
        }
    }

    // 4. Board Member Login (College ID + Rotary Number)
    if (method === 'POST' && pathname === '/api/auth/board-login') {
        const { college_id, rotary_number } = await readBody(req);
        const cid = String(college_id || '').trim().toUpperCase();
        const rno = String(rotary_number || '').trim().toUpperCase();
        if (!cid || !rno) {
            return sendJson(res, 400, { error: 'Both College ID and Rotary Number are required.' });
        }
        const member = db.prepare('SELECT * FROM board_members WHERE upper(college_id) = ? AND upper(rotary_number) = ?').get(cid, rno);
        if (!member) {
            return sendJson(res, 401, { error: 'No matching Board Member found for this College ID and Rotary Number.' });
        }
        const token = signToken({
            role: 'board',
            id: member.member_id,
            name: member.name,
            designation: member.designation,
            college_id: member.college_id,
            rotary_number: member.rotary_number
        });
        return sendJson(res, 200, { token, role: 'board', user: member });
    }

    // 5. Current authenticated user
    if (method === 'GET' && pathname === '/api/auth/me') {
        if (!user) return sendJson(res, 401, { error: 'Not authenticated' });
        if (user.role === 'student') {
            const student = db.prepare('SELECT student_id, usn, name, email, department, semester, phone, blood_group FROM students WHERE student_id = ?').get(user.id);
            return sendJson(res, 200, { role: 'student', user: student });
        }
        const member = db.prepare('SELECT * FROM board_members WHERE member_id = ?').get(user.id);
        return sendJson(res, 200, { role: 'board', user: member });
    }

    // 6. Board Members list (shown at top of student dashboard & Our Team)
    if (method === 'GET' && pathname === '/api/board-members') {
        const members = db.prepare('SELECT * FROM board_members ORDER BY display_order ASC, member_id ASC').all();
        return sendJson(res, 200, { members });
    }

    // 7. General NGOs Directory + Connected Events
    if (method === 'GET' && pathname === '/api/ngos') {
        const ngos = db.prepare('SELECT * FROM ngos ORDER BY name ASC').all();
        const getLinkedEvents = db.prepare(`
            SELECT e.event_id, e.title, e.event_type, e.status, en.partnership_role
            FROM event_ngos en
            JOIN events e ON e.event_id = en.event_id
            WHERE en.ngo_id = ?
            ORDER BY e.event_date DESC
        `);
        const enriched = ngos.map((n) => ({
            ...n,
            connected_events: getLinkedEvents.all(n.ngo_id)
        }));
        return sendJson(res, 200, { ngos: enriched });
    }

    if (method === 'POST' && pathname === '/api/ngos') {
        if (!user || user.role !== 'board') return sendJson(res, 403, { error: 'Board member access required.' });
        const { name, category, contact_person, phone, email, address, description } = await readBody(req);
        if (!name || !category || !contact_person || !phone || !address) {
            return sendJson(res, 400, { error: 'Name, category, contact person, phone, and address are required.' });
        }
        try {
            const info = db.prepare(`
                INSERT INTO ngos (name, category, contact_person, phone, email, address, description)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(name.trim(), category, contact_person.trim(), phone.trim(), (email || '').trim(), address.trim(), (description || '').trim());
            const ngo = db.prepare('SELECT * FROM ngos WHERE ngo_id = ?').get(info.lastInsertRowid);
            return sendJson(res, 201, { ngo });
        } catch (err) {
            return sendJson(res, 400, { error: err.message });
        }
    }

    const ngoDeleteMatch = pathname.match(/^\/api\/ngos\/(\d+)$/);
    if (method === 'DELETE' && ngoDeleteMatch) {
        if (!user || user.role !== 'board') return sendJson(res, 403, { error: 'Board member access required.' });
        db.prepare('DELETE FROM ngos WHERE ngo_id = ?').run(Number(ngoDeleteMatch[1]));
        return sendJson(res, 200, { ok: true });
    }

    // 8. Hospitals & Blood Inventory / Urgency Requests
    if (method === 'GET' && pathname === '/api/hospitals') {
        const hospitals = db.prepare('SELECT * FROM hospitals ORDER BY name ASC').all();
        const inventory = db.prepare('SELECT * FROM v_blood_inventory ORDER BY blood_group ASC').all();
        const requests = db.prepare(`
            SELECT bur.*, h.name AS hospital_name, h.emergency_phone, h.urgency_contact_person, e.title AS event_title
            FROM blood_urgency_requests bur
            JOIN hospitals h ON h.hospital_id = bur.hospital_id
            JOIN events e ON e.event_id = bur.event_id
            ORDER BY CASE bur.status WHEN 'pending' THEN 0 WHEN 'dispatched' THEN 1 ELSE 2 END, bur.requested_at DESC
        `).all();
        const donations = db.prepare(`
            SELECT b.*, s.name AS student_name, s.usn, s.department, h.name AS hospital_name, e.title AS event_title
            FROM blood_camp_donations b
            JOIN students s ON s.student_id = b.student_id
            LEFT JOIN hospitals h ON h.hospital_id = b.hospital_id
            JOIN events e ON e.event_id = b.event_id
            ORDER BY b.donated_at DESC
        `).all();
        return sendJson(res, 200, { hospitals, inventory, requests, donations });
    }

    // 9. Events List & Creation
    if (method === 'GET' && pathname === '/api/events') {
        const statusFilter = urlObj.searchParams.get('status');
        let rows;
        if (statusFilter === 'upcoming' || statusFilter === 'past') {
            rows = db.prepare('SELECT * FROM events WHERE status = ? ORDER BY event_date ASC').all(statusFilter);
        } else {
            rows = db.prepare("SELECT * FROM events ORDER BY CASE status WHEN 'upcoming' THEN 0 ELSE 1 END, event_date ASC").all();
        }
        const studentId = user?.role === 'student' ? user.id : null;
        return sendJson(res, 200, { events: enrichEvents(rows, studentId) });
    }

    if (method === 'POST' && pathname === '/api/events') {
        if (!user || user.role !== 'board') return sendJson(res, 403, { error: 'Board member access required.' });
        const body = await readBody(req);
        const {
            title, event_type, short_tagline, description, event_date,
            start_time, end_time, venue, activity_points, status, ngo_ids,
            walkathon, trek
        } = body;

        if (!title || !description || !event_date || !start_time || !venue) {
            return sendJson(res, 400, { error: 'Title, description, date, time, and venue are required.' });
        }

        const safeType = ['blood_donation', 'walkathon', 'project_pustak', 'fistfull', 'trek', 'general'].includes(event_type)
            ? event_type
            : 'general';

        const info = db.prepare(`
            INSERT INTO events (title, event_type, short_tagline, description, event_date, start_time, end_time, venue, activity_points, status, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            title.trim(),
            safeType,
            (short_tagline || description.slice(0, 80)).trim(),
            description.trim(),
            event_date,
            start_time,
            end_time || '05:00 PM',
            venue.trim(),
            Number(activity_points ?? (safeType === 'fistfull' ? 10 : 20)),
            status === 'past' ? 'past' : 'upcoming',
            user.id
        );

        const eventId = Number(info.lastInsertRowid);

        if (Array.isArray(ngo_ids)) {
            const linkStmt = db.prepare('INSERT OR IGNORE INTO event_ngos (event_id, ngo_id, partnership_role) VALUES (?, ?, ?)');
            for (const nid of ngo_ids) {
                linkStmt.run(eventId, Number(nid), 'Event Partner');
            }
        }

        if (safeType === 'walkathon' && walkathon) {
            db.prepare(`
                INSERT INTO walkathon_details (event_id, route_description, distance_km, reporting_time, start_point, end_point, cause_theme)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                eventId,
                walkathon.route_description || `${venue} Loop`,
                Number(walkathon.distance_km || 5),
                walkathon.reporting_time || start_time,
                walkathon.start_point || venue,
                walkathon.end_point || venue,
                walkathon.cause_theme || 'Community Health & Fitness'
            );
        }

        if (safeType === 'trek' && trek) {
            db.prepare(`
                INSERT INTO trek_details (event_id, hill_name, location_area, elevation_m, trek_distance_km, difficulty, pickup_point, departure_time, checklist)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                eventId,
                trek.hill_name || title,
                trek.location_area || 'Karnataka',
                Number(trek.elevation_m || 1200),
                Number(trek.trek_distance_km || 6),
                ['Easy', 'Moderate', 'Challenging'].includes(trek.difficulty) ? trek.difficulty : 'Moderate',
                trek.pickup_point || 'RVCE Main Gate',
                trek.departure_time || start_time,
                trek.checklist || 'Trekking shoes, 2L water, ID card'
            );
        }

        const created = db.prepare('SELECT * FROM events WHERE event_id = ?').get(eventId);
        return sendJson(res, 201, { event: enrichEvents([created])[0] });
    }

    // 10. Event Detail (Full specialization records + NGOs + registrations)
    const eventDetailMatch = pathname.match(/^\/api\/events\/(\d+)$/);
    if (method === 'GET' && eventDetailMatch) {
        const eventId = Number(eventDetailMatch[1]);
        const ev = db.prepare('SELECT * FROM events WHERE event_id = ?').get(eventId);
        if (!ev) return sendJson(res, 404, { error: 'Event not found' });

        const studentId = user?.role === 'student' ? user.id : null;
        const [enriched] = enrichEvents([ev], studentId);

        let blood_donors = [];
        let urgency_requests = [];
        let hospitals = [];
        let pustak_donations = [];
        let fistfull_donations = [];

        if (ev.event_type === 'blood_donation') {
            blood_donors = db.prepare(`
                SELECT b.*, s.name AS student_name, s.usn, s.department, h.name AS hospital_name, h.emergency_phone AS hospital_phone
                FROM blood_camp_donations b
                JOIN students s ON s.student_id = b.student_id
                LEFT JOIN hospitals h ON h.hospital_id = b.hospital_id
                WHERE b.event_id = ?
                ORDER BY b.donated_at DESC
            `).all(eventId);
            urgency_requests = db.prepare(`
                SELECT bur.*, h.name AS hospital_name, h.emergency_phone
                FROM blood_urgency_requests bur
                JOIN hospitals h ON h.hospital_id = bur.hospital_id
                WHERE bur.event_id = ?
                ORDER BY bur.requested_at DESC
            `).all(eventId);
            hospitals = db.prepare('SELECT * FROM hospitals ORDER BY name').all();
        } else if (ev.event_type === 'project_pustak') {
            pustak_donations = db.prepare(`
                SELECT pd.*, s.name AS student_name, s.usn, n.name AS ngo_name, n.phone AS ngo_phone
                FROM pustak_donations pd
                JOIN students s ON s.student_id = pd.student_id
                LEFT JOIN ngos n ON n.ngo_id = pd.recipient_ngo_id
                WHERE pd.event_id = ?
                ORDER BY pd.donated_at DESC
            `).all(eventId);
        } else if (ev.event_type === 'fistfull') {
            fistfull_donations = db.prepare(`
                SELECT fd.*, s.name AS student_name, s.usn, n.name AS ngo_name, n.phone AS ngo_phone
                FROM fistfull_donations fd
                JOIN students s ON s.student_id = fd.student_id
                LEFT JOIN ngos n ON n.ngo_id = fd.ngo_id
                WHERE fd.event_id = ?
                ORDER BY fd.donated_at DESC
            `).all(eventId);
        }

        return sendJson(res, 200, {
            event: enriched,
            blood_donors,
            urgency_requests,
            hospitals,
            pustak_donations,
            fistfull_donations
        });
    }

    if (method === 'PATCH' && eventDetailMatch) {
        if (!user || user.role !== 'board') return sendJson(res, 403, { error: 'Board member access required.' });
        const eventId = Number(eventDetailMatch[1]);
        const { status, event_date, start_time, end_time, venue, description } = await readBody(req);
        const existing = db.prepare('SELECT * FROM events WHERE event_id = ?').get(eventId);
        if (!existing) return sendJson(res, 404, { error: 'Event not found' });

        db.prepare(`
            UPDATE events
            SET status = ?, event_date = ?, start_time = ?, end_time = ?, venue = ?, description = ?
            WHERE event_id = ?
        `).run(
            status || existing.status,
            event_date || existing.event_date,
            start_time || existing.start_time,
            end_time || existing.end_time,
            venue || existing.venue,
            description || existing.description,
            eventId
        );
        const updated = db.prepare('SELECT * FROM events WHERE event_id = ?').get(eventId);
        return sendJson(res, 200, { event: enrichEvents([updated])[0] });
    }

    // 11. Student Event Registration
    const regMatch = pathname.match(/^\/api\/events\/(\d+)\/register$/);
    if (regMatch && method === 'POST') {
        if (!user || user.role !== 'student') return sendJson(res, 403, { error: 'Please sign in as an RVCE student to register.' });
        const eventId = Number(regMatch[1]);
        const ev = db.prepare('SELECT * FROM events WHERE event_id = ?').get(eventId);
        if (!ev) return sendJson(res, 404, { error: 'Event not found.' });
        if (ev.status !== 'upcoming') return sendJson(res, 400, { error: 'Registration is only open for upcoming events.' });

        db.prepare(`
            INSERT OR IGNORE INTO registrations (event_id, student_id, attendance_status, points_awarded)
            VALUES (?, ?, 'registered', 0)
        `).run(eventId, user.id);

        const reg = db.prepare('SELECT * FROM registrations WHERE event_id = ? AND student_id = ?').get(eventId, user.id);
        return sendJson(res, 201, { registration: reg });
    }

    if (regMatch && method === 'DELETE') {
        if (!user || user.role !== 'student') return sendJson(res, 403, { error: 'Student access required.' });
        const eventId = Number(regMatch[1]);
        const reg = db.prepare('SELECT * FROM registrations WHERE event_id = ? AND student_id = ?').get(eventId, user.id);
        if (!reg) return sendJson(res, 404, { error: 'Registration not found.' });
        if (reg.attendance_status === 'present') {
            return sendJson(res, 400, { error: 'Cannot cancel registration after attendance has been marked.' });
        }
        db.prepare('DELETE FROM registrations WHERE registration_id = ?').run(reg.registration_id);
        return sendJson(res, 200, { ok: true });
    }

    // 12. Student Activity Points & Certificate Summary
    if (method === 'GET' && pathname === '/api/student/activity-points') {
        if (!user || user.role !== 'student') return sendJson(res, 403, { error: 'Student access required.' });
        const summary = db.prepare('SELECT * FROM v_student_activity_summary WHERE student_id = ?').get(user.id);
        const records = db.prepare(`
            SELECT
                r.registration_id,
                r.attendance_status,
                r.points_awarded,
                r.registered_at,
                r.marked_at,
                e.event_id,
                e.title,
                e.event_type,
                e.event_date,
                e.venue,
                e.activity_points AS max_points,
                e.status AS event_status,
                bm.name AS verified_by_name
            FROM registrations r
            JOIN events e ON e.event_id = r.event_id
            LEFT JOIN board_members bm ON bm.member_id = r.marked_by
            WHERE r.student_id = ?
            ORDER BY e.event_date DESC
        `).all(user.id);
        const fistfull = db.prepare(`
            SELECT fd.*, n.name AS ngo_name
            FROM fistfull_donations fd
            LEFT JOIN ngos n ON n.ngo_id = fd.ngo_id
            WHERE fd.student_id = ?
            ORDER BY fd.donated_at DESC
        `).all(user.id);
        const pustak = db.prepare(`
            SELECT pd.*, n.name AS ngo_name
            FROM pustak_donations pd
            LEFT JOIN ngos n ON n.ngo_id = pd.recipient_ngo_id
            WHERE pd.student_id = ?
            ORDER BY pd.donated_at DESC
        `).all(user.id);
        const blood = db.prepare(`
            SELECT b.*, h.name AS hospital_name
            FROM blood_camp_donations b
            LEFT JOIN hospitals h ON h.hospital_id = b.hospital_id
            WHERE b.student_id = ?
            ORDER BY b.donated_at DESC
        `).all(user.id);

        const president = db.prepare("SELECT name, designation FROM board_members WHERE designation = 'President' LIMIT 1").get();

        return sendJson(res, 200, {
            summary,
            records,
            contributions: { fistfull, pustak, blood },
            signatories: {
                dean: 'Dr. K. N. Subramanya, Dean & Principal, RVCE',
                president: president ? `${president.name} (${president.designation})` : 'Rtr. Pavana (President)'
            }
        });
    }

    // 13. Fistfull Donation (5 kg Rice OR 2 kg Toor Dal -> 10 Activity Points + NGO)
    const fistfullMatch = pathname.match(/^\/api\/events\/(\d+)\/fistfull$/);
    if (method === 'POST' && fistfullMatch) {
        if (!user) return sendJson(res, 401, { error: 'Please sign in first.' });
        const eventId = Number(fistfullMatch[1]);
        const { student_id, item_type, ngo_id } = await readBody(req);
        const targetStudentId = user.role === 'student' ? user.id : Number(student_id);
        if (!targetStudentId) return sendJson(res, 400, { error: 'Student ID is required.' });
        if (!['rice_5kg', 'toor_dal_2kg'].includes(item_type)) {
            return sendJson(res, 400, { error: 'Item must be either 5 kg Rice or 2 kg Toor Dal.' });
        }
        const qty = item_type === 'rice_5kg' ? 5.0 : 2.0;
        const verifiedBy = user.role === 'board' ? user.id : null;

        db.prepare(`
            INSERT INTO fistfull_donations (event_id, student_id, item_type, quantity_kg, points_earned, ngo_id, verified_by)
            VALUES (?, ?, ?, ?, 10, ?, ?)
        `).run(eventId, targetStudentId, item_type, qty, ngo_id ? Number(ngo_id) : 3, verifiedBy);

        return sendJson(res, 201, { ok: true, points_earned: 10 });
    }

    // 14. Project Pustak Donation (Books to Partner NGO / School)
    const pustakMatch = pathname.match(/^\/api\/events\/(\d+)\/pustak$/);
    if (method === 'POST' && pustakMatch) {
        if (!user) return sendJson(res, 401, { error: 'Please sign in first.' });
        const eventId = Number(pustakMatch[1]);
        const { student_id, book_category, quantity, recipient_ngo_id, target_school_name } = await readBody(req);
        const targetStudentId = user.role === 'student' ? user.id : Number(student_id);
        if (!targetStudentId || !quantity || !target_school_name) {
            return sendJson(res, 400, { error: 'Student, book quantity, and target school are required.' });
        }
        db.prepare(`
            INSERT INTO pustak_donations (event_id, student_id, book_category, quantity, recipient_ngo_id, target_school_name)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            eventId,
            targetStudentId,
            book_category || 'Textbooks',
            Number(quantity),
            recipient_ngo_id ? Number(recipient_ngo_id) : 6,
            target_school_name.trim()
        );
        return sendJson(res, 201, { ok: true });
    }

    // 15. Blood Donation Camp Donor Recording (Board Member)
    const bloodMatch = pathname.match(/^\/api\/events\/(\d+)\/blood-donation$/);
    if (method === 'POST' && bloodMatch) {
        if (!user || user.role !== 'board') return sendJson(res, 403, { error: 'Board member access required.' });
        const eventId = Number(bloodMatch[1]);
        const { student_id, blood_group, units_donated, hospital_id, donor_phone } = await readBody(req);
        if (!student_id || !blood_group) {
            return sendJson(res, 400, { error: 'Student and Blood Group are required.' });
        }
        const stu = db.prepare('SELECT phone FROM students WHERE student_id = ?').get(Number(student_id));
        if (!stu) return sendJson(res, 404, { error: 'Student not found.' });

        db.prepare(`
            INSERT INTO blood_camp_donations (event_id, student_id, blood_group, units_donated, volume_ml, hospital_id, donor_phone, urgency_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'available')
            ON CONFLICT(event_id, student_id) DO UPDATE SET
                blood_group = excluded.blood_group,
                units_donated = excluded.units_donated,
                hospital_id = excluded.hospital_id,
                donor_phone = excluded.donor_phone
        `).run(
            eventId,
            Number(student_id),
            blood_group,
            Number(units_donated || 1),
            Number(units_donated || 1) * 350,
            hospital_id ? Number(hospital_id) : 1,
            (donor_phone || stu.phone).trim()
        );

        return sendJson(res, 201, { ok: true });
    }

    // 16. Hospital Urgency Blood Request & Dispatch
    if (method === 'POST' && pathname === '/api/blood/urgency-request') {
        if (!user) return sendJson(res, 401, { error: 'Authentication required.' });
        const { hospital_id, event_id, blood_group, units_requested, urgency_level, notes } = await readBody(req);
        if (!hospital_id || !event_id || !blood_group || !units_requested) {
            return sendJson(res, 400, { error: 'Hospital, event, blood group, and units are required.' });
        }
        const info = db.prepare(`
            INSERT INTO blood_urgency_requests (hospital_id, event_id, blood_group, units_requested, urgency_level, status, notes)
            VALUES (?, ?, ?, ?, ?, 'pending', ?)
        `).run(Number(hospital_id), Number(event_id), blood_group, Number(units_requested), urgency_level || 'critical', (notes || '').trim());
        return sendJson(res, 201, { request_id: info.lastInsertRowid });
    }

    const urgencyPatchMatch = pathname.match(/^\/api\/blood\/urgency-request\/(\d+)$/);
    if (method === 'PATCH' && urgencyPatchMatch) {
        if (!user || user.role !== 'board') return sendJson(res, 403, { error: 'Board member access required.' });
        const reqId = Number(urgencyPatchMatch[1]);
        const { status } = await readBody(req);
        const urgentReq = db.prepare('SELECT * FROM blood_urgency_requests WHERE request_id = ?').get(reqId);
        if (!urgentReq) return sendJson(res, 404, { error: 'Urgency request not found.' });

        db.prepare('UPDATE blood_urgency_requests SET status = ? WHERE request_id = ?').run(status || 'dispatched', reqId);

        if (status === 'dispatched' || status === 'fulfilled') {
            db.prepare(`
                UPDATE blood_camp_donations
                SET urgency_status = 'dispatched', hospital_id = ?
                WHERE donation_id IN (
                    SELECT donation_id FROM blood_camp_donations
                    WHERE blood_group = ? AND urgency_status != 'dispatched'
                    LIMIT ?
                )
            `).run(urgentReq.hospital_id, urgentReq.blood_group, urgentReq.units_requested);
        }
        return sendJson(res, 200, { ok: true });
    }

    // 17. Attendance Sheet (Board Member)
    const attendanceMatch = pathname.match(/^\/api\/events\/(\d+)\/attendance$/);
    if (method === 'GET' && attendanceMatch) {
        if (!user || user.role !== 'board') return sendJson(res, 403, { error: 'Board member access required.' });
        const eventId = Number(attendanceMatch[1]);
        const ev = db.prepare('SELECT * FROM events WHERE event_id = ?').get(eventId);
        if (!ev) return sendJson(res, 404, { error: 'Event not found.' });

        const rows = db.prepare(`
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
                COALESCE(r.attendance_status, 'not_registered') AS attendance_status,
                COALESCE(r.points_awarded, 0) AS points_awarded,
                r.marked_at
            FROM students s
            LEFT JOIN registrations r ON s.student_id = r.student_id AND r.event_id = ?
            ORDER BY
                CASE WHEN r.registration_id IS NOT NULL THEN 0 ELSE 1 END,
                s.usn ASC
        `).all(eventId);

        return sendJson(res, 200, { event: ev, rows });
    }

    if (method === 'POST' && attendanceMatch) {
        if (!user || user.role !== 'board') return sendJson(res, 403, { error: 'Board member access required.' });
        const eventId = Number(attendanceMatch[1]);
        const ev = db.prepare('SELECT * FROM events WHERE event_id = ?').get(eventId);
        if (!ev) return sendJson(res, 404, { error: 'Event not found.' });

        const { records } = await readBody(req);
        if (!Array.isArray(records)) return sendJson(res, 400, { error: 'records array is required.' });

        const upsertStmt = db.prepare(`
            INSERT INTO registrations (event_id, student_id, attendance_status, points_awarded, marked_by, marked_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(event_id, student_id) DO UPDATE SET
                attendance_status = excluded.attendance_status,
                points_awarded = excluded.points_awarded,
                marked_by = excluded.marked_by,
                marked_at = datetime('now')
        `);

        for (const rec of records) {
            if (!['registered', 'present', 'absent'].includes(rec.attendance_status)) continue;
            const pts = rec.attendance_status === 'present' ? ev.activity_points : 0;
            upsertStmt.run(eventId, Number(rec.student_id), rec.attendance_status, pts, user.id);
        }

        return sendJson(res, 200, { ok: true, updated: records.length });
    }

    // 18. Board Dashboard & DBMS Reports
    if (method === 'GET' && pathname === '/api/board/dashboard') {
        if (!user || user.role !== 'board') return sendJson(res, 403, { error: 'Board member access required.' });
        const totalEvents = db.prepare('SELECT COUNT(*) AS cnt FROM events').get().cnt;
        const upcomingEvents = db.prepare("SELECT COUNT(*) AS cnt FROM events WHERE status = 'upcoming'").get().cnt;
        const totalStudents = db.prepare('SELECT COUNT(*) AS cnt FROM students').get().cnt;
        const totalParticipations = db.prepare("SELECT COUNT(*) AS cnt FROM registrations WHERE attendance_status = 'present'").get().cnt;
        const totalPointsAwarded = db.prepare("SELECT COALESCE(SUM(points_awarded), 0) AS total FROM registrations WHERE attendance_status = 'present'").get().total;
        const totalBloodUnits = db.prepare('SELECT COALESCE(SUM(units_donated), 0) AS total FROM blood_camp_donations').get().total;
        const totalNgos = db.prepare('SELECT COUNT(*) AS cnt FROM ngos').get().cnt;
        const pendingUrgency = db.prepare("SELECT COUNT(*) AS cnt FROM blood_urgency_requests WHERE status = 'pending'").get().cnt;

        return sendJson(res, 200, {
            stats: {
                totalEvents,
                upcomingEvents,
                totalStudents,
                totalParticipations,
                totalPointsAwarded,
                totalBloodUnits,
                totalNgos,
                pendingUrgency
            }
        });
    }

    if (method === 'GET' && pathname === '/api/board/students') {
        if (!user || user.role !== 'board') return sendJson(res, 403, { error: 'Board member access required.' });
        const students = db.prepare('SELECT * FROM v_student_activity_summary ORDER BY total_activity_points DESC, usn ASC').all();
        return sendJson(res, 200, { students });
    }

    if (method === 'GET' && pathname === '/api/dbms/overview') {
        if (!user || user.role !== 'board') return sendJson(res, 403, { error: 'Board member access required.' });
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
        const tableCounts = tables.map((t) => ({
            name: t.name,
            rows: db.prepare(`SELECT COUNT(*) AS cnt FROM "${t.name}"`).get().cnt
        }));
        const views = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='view' ORDER BY name").all();
        const triggers = db.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all();
        return sendJson(res, 200, { tables: tableCounts, views, triggers });
    }

    return sendJson(res, 404, { error: `Unknown API route: ${method} ${pathname}` });
}

// --- Static File Server ---
function serveStatic(req, res, urlObj) {
    let reqPath = decodeURIComponent(urlObj.pathname);
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.normalize(path.join(PUBLIC_DIR, reqPath));
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        return res.end('Forbidden');
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            // Fallback to index.html for SPA routes
            fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, html) => {
                if (err2) {
                    res.writeHead(404);
                    return res.end('Not Found');
                }
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
            });
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(content);
    });
}

const server = http.createServer(async (req, res) => {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
        if (urlObj.pathname.startsWith('/api/')) {
            await handleApi(req, res, urlObj);
        } else {
            serveStatic(req, res, urlObj);
        }
    } catch (err) {
        console.error('Server error:', err);
        sendJson(res, 500, { error: err.message || 'Internal Server Error' });
    }
});

server.listen(PORT, () => {
    console.log(`Rotaract Club of RVCE DBMS Portal running at http://localhost:${PORT}`);
});
