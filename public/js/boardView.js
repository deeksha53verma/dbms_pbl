import { apiFetch, formatDate, getInitials, eventTypeLabel } from './api.js';
import { rotaractLogoSvg, eventBannerSvg } from './icons.js';

export function createBoardController({ user, onLogout, toast, openModal, closeModal }) {
    const state = {
        tab: 'dashboard', // dashboard | attendance | events | blood | drives | ngos | reports
        bloodSubTab: 'donors', // donors | hospitals | units
        driveSubTab: 'pustak', // pustak | fistfull | walkathon | trek
        selectedEventId: null,
        attendanceRows: [],
        attendanceEvent: null,
        dashboardStats: {},
        events: [],
        ngos: [],
        students: [],
        hospitalsData: { hospitals: [], inventory: [], requests: [], donations: [] },
        driveDetail: null,
        dbmsOverview: null,
        newEventType: 'general'
    };

    async function loadBaseData() {
        const [dashRes, evRes, ngoRes, stuRes, hospRes] = await Promise.all([
            apiFetch('/api/board/dashboard'),
            apiFetch('/api/events'),
            apiFetch('/api/ngos'),
            apiFetch('/api/board/students'),
            apiFetch('/api/hospitals')
        ]);
        state.dashboardStats = dashRes.stats || {};
        state.events = evRes.events || [];
        state.ngos = ngoRes.ngos || [];
        state.students = stuRes.students || [];
        state.hospitalsData = hospRes;

        if (!state.selectedEventId && state.events.length) {
            const walkathon = state.events.find((e) => e.event_type === 'walkathon') || state.events[0];
            state.selectedEventId = walkathon.event_id;
        }
    }

    async function loadAttendance(eventId) {
        const res = await apiFetch(`/api/events/${eventId}/attendance`);
        state.attendanceEvent = res.event;
        state.attendanceRows = res.rows || [];
    }

    async function loadDriveDetail(type) {
        const ev = state.events.find((e) => e.event_type === type);
        if (!ev) {
            state.driveDetail = null;
            return;
        }
        state.driveDetail = await apiFetch(`/api/events/${ev.event_id}`);
    }

    function renderSidebar() {
        const navItems = [
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'attendance', label: 'Attendance Sheet' },
            { id: 'events', label: 'Events & Upload' },
            { id: 'blood', label: 'Blood Camp & Hospitals' },
            { id: 'drives', label: 'Pustak, Fistfull & Trek' },
            { id: 'ngos', label: 'NGOs Directory' },
            { id: 'reports', label: 'DBMS & AP Reports' }
        ];
        return `
        <aside class="board-sidebar">
            <div class="sidebar-brand">
                ${rotaractLogoSvg(38)}
                <div>
                    <strong>Rotaract RVCE</strong>
                    <span>Board Member Portal</span>
                </div>
            </div>
            <nav class="sidebar-nav">
                ${navItems.map((n) => `
                    <button class="sidebar-btn ${state.tab === n.id ? 'active' : ''}" data-btab="${n.id}">
                        <span>${n.label}</span>
                    </button>
                `).join('')}
            </nav>
            <div class="sidebar-footer">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                    <div class="board-avatar" style="width:42px;height:42px;margin:0;flex-shrink:0;">
                        ${user.photo_url
                            ? `<img src="${user.photo_url}" alt="${user.name}" class="board-avatar-img" />`
                            : getInitials(user.name)
                        }
                    </div>
                    <div style="font-size:0.78rem;color:rgba(255,255,255,0.82);min-width:0;">
                        <strong style="display:block;color:#fff;">${user.name}</strong>
                        <span>${user.designation}</span><br>
                        <span>${user.rotary_number}</span>
                    </div>
                </div>
                <button class="sidebar-btn" id="board-logout-btn" style="width:100%;background:rgba(255,255,255,0.08);">
                    Logout
                </button>
            </div>
        </aside>`;
    }

    function renderDashboard() {
        const s = state.dashboardStats;
        const upcoming = state.events.filter((e) => e.status === 'upcoming');

        return `
        <div style="margin-bottom:22px;">
            <h1 style="font-size:1.7rem;">Welcome, ${user.name}!</h1>
            <p class="section-subtitle">Designation: <strong>${user.designation}</strong> • Rotary Number: <strong>${user.rotary_number}</strong></p>
        </div>

        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-icon" style="background:var(--magenta-soft);color:var(--magenta);">📅</div>
                <div><strong>${s.totalEvents || 0}</strong><span>Total Club Events (${s.upcomingEvents || 0} Upcoming)</span></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon" style="background:#e0e7ff;color:#4338ca;">👥</div>
                <div><strong>${s.totalParticipations || 0}</strong><span>Verified Attendances</span></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon" style="background:var(--gold-soft);color:#b45309;">⭐</div>
                <div><strong>${s.totalPointsAwarded || 0}</strong><span>Activity Points Awarded</span></div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon" style="background:#ffe4e6;color:#be123c;">🩸</div>
                <div><strong>${s.totalBloodUnits || 0}</strong><span>Blood Units (${s.pendingUrgency || 0} Urgent Req)</span></div>
            </div>
        </div>

        <h3 style="margin-bottom:12px;">Quick Actions</h3>
        <div class="quick-actions-grid" style="margin-bottom:26px;">
            <button class="quick-action-tile" data-btab="events">➕ Upload New Event</button>
            <button class="quick-action-tile" data-btab="attendance">✅ Mark Attendance</button>
            <button class="quick-action-tile" data-btab="blood">🏥 Blood Camp &amp; Hospitals</button>
            <button class="quick-action-tile" data-btab="ngos">🤝 Manage NGOs (${s.totalNgos || 0})</button>
        </div>

        <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <h3>Upcoming Events Overview</h3>
                <button class="btn btn-outline btn-sm" data-btab="events">Manage Events →</button>
            </div>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Event Title</th>
                            <th>Category</th>
                            <th>Date &amp; Time</th>
                            <th>Venue</th>
                            <th>Connected NGOs</th>
                            <th>AP</th>
                            <th>Registered</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${upcoming.map((ev) => `
                            <tr>
                                <td><strong>${ev.title}</strong></td>
                                <td><span class="badge badge-pink">${eventTypeLabel(ev.event_type)}</span></td>
                                <td>${formatDate(ev.event_date)} • ${ev.start_time}</td>
                                <td>${ev.venue}</td>
                                <td>${ev.ngos.map((n) => n.name).join(', ') || '—'}</td>
                                <td><strong>${ev.activity_points} AP</strong></td>
                                <td>${ev.registered_count}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    }

    function renderAttendanceTab() {
        const ev = state.attendanceEvent;
        const rows = state.attendanceRows;
        return `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:18px;">
            <div>
                <h1 style="font-size:1.65rem;">Event Attendance Sheet</h1>
                <p class="section-subtitle">Mark student attendance — marking Present automatically awards ${ev?.activity_points || 0} Activity Points</p>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <select id="att-event-select" class="input-control" style="min-width:260px;">
                    ${state.events.map((e) => `
                        <option value="${e.event_id}" ${Number(state.selectedEventId) === e.event_id ? 'selected' : ''}>
                            ${e.title} (${e.status.toUpperCase()} • ${e.activity_points} AP)
                        </option>
                    `).join('')}
                </select>
                <button class="btn btn-navy btn-sm" id="show-event-qr-btn">📷 Event QR &amp; Verify</button>
                <button class="btn btn-outline btn-sm" id="download-att-csv-btn">⬇ Download Sheet (CSV)</button>
                <button class="btn btn-primary btn-sm" id="save-attendance-btn">💾 Save Attendance</button>
            </div>
        </div>

        <div class="card">
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Student Name</th>
                            <th>USN</th>
                            <th>Department</th>
                            <th>Reg. Status</th>
                            <th>Mark Attendance</th>
                            <th>AP Awarded</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map((r, idx) => `
                            <tr data-att-student="${r.student_id}">
                                <td>${idx + 1}</td>
                                <td>
                                    <strong>${r.name}</strong><br>
                                    <span style="font-size:0.78rem;color:var(--text-muted);">${r.email}</span>
                                </td>
                                <td><strong>${r.usn}</strong></td>
                                <td>${r.department} (Sem ${r.semester})</td>
                                <td>
                                    ${r.registration_id
                                        ? `<span class="badge badge-navy">Registered</span>`
                                        : `<span class="badge badge-gold">Not Registered</span>`
                                    }
                                </td>
                                <td>
                                    ${r.registration_id ? `
                                        <div class="att-toggle-group">
                                            <button type="button" class="att-btn present ${r.attendance_status === 'present' ? 'active' : ''}" data-mark="${r.student_id}:present">✓ Present</button>
                                            <button type="button" class="att-btn absent ${r.attendance_status === 'absent' ? 'active' : ''}" data-mark="${r.student_id}:absent">✕ Absent</button>
                                            ${r.verification_method ? `<span class="badge badge-pink">${r.verification_method.toUpperCase()}</span>` : ''}
                                        </div>
                                    ` : `<span style="font-size:0.78rem;color:var(--text-muted);">Registration required</span>`}
                                </td>
                                <td>
                                    <strong style="color:${r.attendance_status === 'present' ? 'var(--emerald)' : 'var(--text-muted)'};">
                                        ${r.attendance_status === 'present' ? `+${ev?.activity_points || 0} AP` : '0 AP'}
                                    </strong>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    }

    function renderEventsAndUploadTab() {
        return `
        <div style="margin-bottom:18px;">
            <h1 style="font-size:1.65rem;">Upload New Event &amp; Manage Upcoming Details</h1>
            <p class="section-subtitle">Create new Rotaract events, connect partner NGOs, and update event status</p>
        </div>

        <div class="ap-grid" style="grid-template-columns:1fr 1.25fr;">
            <div class="card">
                <h3 style="margin-bottom:14px;">➕ Upload New Event</h3>
                <form id="upload-event-form">
                    <div class="form-group">
                        <label>Event Title</label>
                        <input class="input-control" name="title" placeholder="e.g., Monsoon Blood Donation Camp" required />
                    </div>
                    <div class="grid-2">
                        <div class="form-group">
                            <label>Event Category</label>
                            <select class="input-control" name="event_type" id="new-event-type">
                                <option value="blood_donation" ${state.newEventType === 'blood_donation' ? 'selected' : ''}>Blood Donation Camp</option>
                                <option value="walkathon" ${state.newEventType === 'walkathon' ? 'selected' : ''}>Walkathon</option>
                                <option value="project_pustak" ${state.newEventType === 'project_pustak' ? 'selected' : ''}>Project Pustak</option>
                                <option value="fistfull" ${state.newEventType === 'fistfull' ? 'selected' : ''}>Fistfull (10 AP)</option>
                                <option value="trek" ${state.newEventType === 'trek' ? 'selected' : ''}>Trek</option>
                                <option value="general" ${state.newEventType === 'general' ? 'selected' : ''}>General Event</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Activity Points</label>
                            <input class="input-control" type="number" name="activity_points" min="0" value="${state.newEventType === 'fistfull' ? 10 : 20}" required />
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Short Tagline</label>
                        <input class="input-control" name="short_tagline" placeholder="One-line summary for event cards" required />
                    </div>
                    <div class="form-group">
                        <label>Event Description</label>
                        <textarea class="input-control" name="description" rows="3" placeholder="Full details, purpose, and instructions..." required></textarea>
                    </div>
                    <div class="grid-2">
                        <div class="form-group">
                            <label>Event Date</label>
                            <input class="input-control" type="date" name="event_date" value="2026-12-22" required />
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select class="input-control" name="status">
                                <option value="upcoming">Upcoming</option>
                                <option value="past">Past</option>
                            </select>
                        </div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group">
                            <label>Start Time</label>
                            <input class="input-control" name="start_time" value="09:00 AM" required />
                        </div>
                        <div class="form-group">
                            <label>End Time</label>
                            <input class="input-control" name="end_time" value="01:00 PM" required />
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Venue / Location</label>
                        <input class="input-control" name="venue" placeholder="e.g., RVCE Main Quadrangle" required />
                    </div>
                    <div class="grid-2">
                        <div class="form-group">
                            <label>Event POC Name</label>
                            <input class="input-control" name="poc_name" value="${user.name}" required />
                        </div>
                        <div class="form-group">
                            <label>POC Phone</label>
                            <input class="input-control" name="poc_phone" value="${user.phone || ''}" required />
                        </div>
                    </div>

                    ${state.newEventType === 'trek' ? `
                        <div style="background:#eef2ff;padding:12px;border-radius:10px;margin-bottom:14px;">
                            <strong style="font-size:0.84rem;color:#3730a3;">⛰️ Trekking Hill Details</strong>
                            <div class="grid-2" style="margin-top:8px;">
                                <input class="input-control" name="hill_name" placeholder="Hill Name (e.g. Savandurga)" />
                                <input class="input-control" name="elevation_m" type="number" placeholder="Elevation (m)" value="1226" />
                                <input class="input-control" name="trek_distance_km" type="number" step="0.1" placeholder="Distance (km)" value="7.0" />
                                <select class="input-control" name="difficulty">
                                    <option value="Easy">Easy</option>
                                    <option value="Moderate" selected>Moderate</option>
                                    <option value="Challenging">Challenging</option>
                                </select>
                            </div>
                        </div>
                    ` : ''}

                    ${state.newEventType === 'walkathon' ? `
                        <div style="background:#fffbeb;padding:12px;border-radius:10px;margin-bottom:14px;">
                            <strong style="font-size:0.84rem;color:#b45309;">🏃 Walkathon Route Details</strong>
                            <div class="grid-2" style="margin-top:8px;">
                                <input class="input-control" name="distance_km" type="number" step="0.5" value="5" placeholder="Distance (km)" />
                                <input class="input-control" name="reporting_time" value="05:45 AM" placeholder="Reporting Time" />
                            </div>
                            <input class="input-control" style="margin-top:8px;" name="route_description" placeholder="Route (e.g. RVCE -> Metro -> RVCE)" />
                        </div>
                    ` : ''}

                    <div class="form-group">
                        <label>Connect NGOs to This Event</label>
                        <div style="display:grid;gap:6px;max-height:135px;overflow-y:auto;border:1px solid var(--border);padding:10px;border-radius:10px;background:#fafbfe;">
                            ${state.ngos.map((n) => `
                                <label style="display:flex;align-items:center;gap:8px;font-weight:500;margin:0;font-size:0.85rem;">
                                    <input type="checkbox" name="ngo_ids" value="${n.ngo_id}" />
                                    <span>${n.name} (${n.phone})</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Upload Event</button>
                </form>
            </div>

            <div class="card">
                <h3 style="margin-bottom:14px;">All Events &amp; Upcoming Schedule (${state.events.length})</h3>
                <div style="display:grid;gap:12px;">
                    ${state.events.map((ev) => `
                        <div style="border:1px solid var(--border);border-radius:12px;padding:14px;display:flex;gap:14px;align-items:center;">
                            <div style="width:92px;height:72px;border-radius:10px;overflow:hidden;flex-shrink:0;">
                                ${eventBannerSvg(ev.event_type)}
                            </div>
                            <div style="flex:1;min-width:0;">
                                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                    <strong>${ev.title}</strong>
                                    <span class="badge ${ev.status === 'upcoming' ? 'badge-green' : 'badge-navy'}">${ev.status}</span>
                                    <span class="badge badge-pink">${ev.activity_points} AP</span>
                                </div>
                                <div style="font-size:0.82rem;color:var(--text-muted);margin:3px 0;">
                                    📅 ${formatDate(ev.event_date)} • ⏰ ${ev.start_time} • 📍 ${ev.venue}
                                </div>
                                <div style="font-size:0.8rem;color:var(--navy);">
                                    NGOs: ${ev.ngos.map((n) => n.name).join(', ') || 'None'} • Registered: ${ev.registered_count}
                                </div>
                            </div>
                            <div style="display:flex;flex-direction:column;gap:6px;">
                                <button class="btn btn-ghost btn-sm" data-toggle-ev-status="${ev.event_id}:${ev.status === 'upcoming' ? 'past' : 'upcoming'}">
                                    Mark ${ev.status === 'upcoming' ? 'Past' : 'Upcoming'}
                                </button>
                                <button class="btn btn-outline btn-sm" data-edit-ev="${ev.event_id}">Edit</button>
                                <button class="btn btn-outline btn-sm" data-open-att="${ev.event_id}">Attendance</button>
                                <button class="btn btn-ghost btn-sm" data-del-ev="${ev.event_id}" style="color:var(--rose-red);">Delete</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>`;
    }

    function renderBloodCampTab() {
        const { hospitals, inventory, requests, donations } = state.hospitalsData;
        const totalUnits = donations.reduce((s, d) => s + d.units_donated, 0);
        const bloodEvents = state.events.filter((e) => e.event_type === 'blood_donation');

        return `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
            <div>
                <h1 style="font-size:1.65rem;">Blood Donation Camp Management</h1>
                <p class="section-subtitle">Manage student blood donors, units collected, and connect hospitals for urgent blood access</p>
            </div>
            <div style="background:#fff5f7;border:1.5px solid #fda4af;padding:10px 20px;border-radius:14px;text-align:right;">
                <span style="font-size:0.78rem;font-weight:700;color:var(--text-muted);">Total Units Collected</span>
                <div style="font-size:1.55rem;font-weight:800;color:#be123c;">🩸 ${totalUnits} Units</div>
            </div>
        </div>

        <div class="sub-tabs">
            <button class="sub-tab ${state.bloodSubTab === 'donors' ? 'active' : ''}" data-bsub="donors">Donor Details (${donations.length})</button>
            <button class="sub-tab ${state.bloodSubTab === 'hospitals' ? 'active' : ''}" data-bsub="hospitals">Hospital Link &amp; Urgency Access (${requests.length})</button>
            <button class="sub-tab ${state.bloodSubTab === 'units' ? 'active' : ''}" data-bsub="units">Units Collected by Blood Group</button>
        </div>

        ${state.bloodSubTab === 'donors' ? `
            <div class="ap-grid" style="grid-template-columns:1.4fr 0.9fr;">
                <div class="card">
                    <h3 style="margin-bottom:12px;">Student Blood Donors</h3>
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Name &amp; USN</th>
                                    <th>Blood Group</th>
                                    <th>Units</th>
                                    <th>Contact</th>
                                    <th>Hospital Linked</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${donations.map((d, i) => `
                                    <tr>
                                        <td>${i + 1}</td>
                                        <td><strong>${d.student_name}</strong><br><span style="font-size:0.78rem;color:var(--text-muted);">${d.usn}</span></td>
                                        <td><span class="badge badge-red">${d.blood_group}</span></td>
                                        <td><strong>${d.units_donated}</strong> (${d.volume_ml} ml)</td>
                                        <td>${d.donor_phone}</td>
                                        <td>${d.hospital_name || 'Unassigned'}</td>
                                        <td>
                                            <span class="badge ${d.urgency_status === 'dispatched' ? 'badge-navy' : d.urgency_status === 'reserved_urgent' ? 'badge-gold' : 'badge-green'}">
                                                ${d.urgency_status}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="card">
                    <h3 style="margin-bottom:12px;">➕ Record Student Blood Donor</h3>
                    <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px;">SQL trigger automatically marks the student Present &amp; awards 30 AP.</p>
                    <form id="add-donor-form">
                        <div class="form-group">
                            <label>Blood Camp Event</label>
                            <select class="input-control" name="event_id" required>
                                ${bloodEvents.map((be) => `<option value="${be.event_id}">${be.title}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Student</label>
                            <select class="input-control" name="student_id" required>
                                ${state.students.map((st) => `<option value="${st.student_id}">${st.name} (${st.usn})</option>`).join('')}
                            </select>
                        </div>
                        <div class="grid-2">
                            <div class="form-group">
                                <label>Blood Group</label>
                                <select class="input-control" name="blood_group">
                                    ${['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'].map((bg) => `<option value="${bg}">${bg}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Units Donated</label>
                                <input class="input-control" type="number" name="units_donated" min="1" max="2" value="1" />
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Assign to Partner Hospital</label>
                            <select class="input-control" name="hospital_id">
                                ${hospitals.map((h) => `<option value="${h.hospital_id}">${h.name}</option>`).join('')}
                            </select>
                        </div>
                        <button class="btn btn-primary btn-block" type="submit">Save Donor Record</button>
                    </form>
                </div>
            </div>
        ` : state.bloodSubTab === 'hospitals' ? `
            <div class="ap-grid" style="grid-template-columns:1.35fr 0.95fr;">
                <div>
                    <div class="card" style="margin-bottom:18px;">
                        <h3 style="margin-bottom:12px;">🚨 Hospital Urgency Blood Requests</h3>
                        <div class="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Hospital</th>
                                        <th>Blood Group</th>
                                        <th>Units</th>
                                        <th>Urgency</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${requests.map((r) => `
                                        <tr>
                                            <td>
                                                <strong>${r.hospital_name}</strong><br>
                                                <span style="font-size:0.78rem;color:var(--text-muted);">📞 ${r.emergency_phone}</span>
                                            </td>
                                            <td><span class="badge badge-red">${r.blood_group}</span></td>
                                            <td><strong>${r.units_requested}</strong></td>
                                            <td><span class="badge ${r.urgency_level === 'critical' ? 'badge-red' : 'badge-gold'}">${r.urgency_level.toUpperCase()}</span></td>
                                            <td><span class="badge ${r.status === 'pending' ? 'badge-gold' : 'badge-green'}">${r.status}</span></td>
                                            <td>
                                                ${r.status === 'pending'
                                                    ? `<button class="btn btn-primary btn-sm" data-dispatch-req="${r.request_id}">Dispatch Units</button>`
                                                    : `<span style="color:var(--emerald);font-weight:700;font-size:0.82rem;">Dispatched ✓</span>`
                                                }
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="card">
                        <h3 style="margin-bottom:12px;">🏥 Connected Hospitals Directory</h3>
                        <div style="display:grid;gap:10px;">
                            ${hospitals.map((h) => `
                                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border:1px solid var(--border);border-radius:10px;">
                                    <div>
                                        <strong>${h.name}</strong>
                                        <div style="font-size:0.82rem;color:var(--text-muted);">${h.address} • Nodal Officer: ${h.urgency_contact_person}</div>
                                    </div>
                                    <a class="btn btn-outline btn-sm" href="tel:${h.emergency_phone.replace(/\s+/g, '')}">📞 ${h.emergency_phone}</a>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <div class="card">
                    <h3 style="margin-bottom:12px;">🏥 Log Urgent Hospital Request</h3>
                    <form id="urgency-req-form">
                        <div class="form-group">
                            <label>Partner Hospital</label>
                            <select class="input-control" name="hospital_id" required>
                                ${hospitals.map((h) => `<option value="${h.hospital_id}">${h.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Source Blood Camp</label>
                            <select class="input-control" name="event_id" required>
                                ${bloodEvents.map((be) => `<option value="${be.event_id}">${be.title}</option>`).join('')}
                            </select>
                        </div>
                        <div class="grid-2">
                            <div class="form-group">
                                <label>Blood Group Needed</label>
                                <select class="input-control" name="blood_group">
                                    ${['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((bg) => `<option value="${bg}">${bg}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Units Requested</label>
                                <input class="input-control" type="number" name="units_requested" min="1" value="1" />
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Urgency Level</label>
                            <select class="input-control" name="urgency_level">
                                <option value="critical">Critical (Immediate)</option>
                                <option value="high">High Priority</option>
                                <option value="normal">Normal</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Clinical Notes</label>
                            <input class="input-control" name="notes" placeholder="e.g., Trauma / ICU surgical requirement" />
                        </div>
                        <button class="btn btn-primary btn-block" type="submit">Submit Hospital Urgency Request</button>
                    </form>
                </div>
            </div>
        ` : `
            <div class="blood-group-grid">
                ${inventory.map((item) => `
                    <div class="blood-stat-box">
                        <div class="bg-type">${item.blood_group}</div>
                        <div style="font-size:1.3rem;font-weight:800;margin:4px 0;">${item.total_units_collected} Units</div>
                        <div style="font-size:0.8rem;color:var(--text-muted);">
                            Available: <strong style="color:var(--emerald);">${item.available_units}</strong> •
                            Dispatched: <strong>${item.dispatched_units}</strong>
                        </div>
                    </div>
                `).join('')}
            </div>
        `}`;
    }

    function renderDrivesTab() {
        const d = state.driveDetail;
        const ev = d?.event;
        return `
        <div style="margin-bottom:16px;">
            <h1 style="font-size:1.65rem;">Specialized Rotaract Event Drives</h1>
            <p class="section-subtitle">Manage Project Pustak, Fistfull (5 kg Rice / 2 kg Toor Dal), Walkathon, and Hill Treks</p>
        </div>

        <div class="sub-tabs">
            <button class="sub-tab ${state.driveSubTab === 'pustak' ? 'active' : ''}" data-dsub="pustak">📚 Project Pustak</button>
            <button class="sub-tab ${state.driveSubTab === 'fistfull' ? 'active' : ''}" data-dsub="fistfull">🌾 Fistfull (10 AP)</button>
            <button class="sub-tab ${state.driveSubTab === 'walkathon' ? 'active' : ''}" data-dsub="walkathon">🏃 Walkathon</button>
            <button class="sub-tab ${state.driveSubTab === 'trek' ? 'active' : ''}" data-dsub="trek">⛰️ Hill Trek</button>
        </div>

        ${!ev ? `<div class="card">No event found for this category.</div>` : `
            ${state.driveSubTab === 'pustak' ? `
                <div class="ap-grid" style="grid-template-columns:1.35fr 0.95fr;">
                    <div class="card">
                        <h3 style="margin-bottom:10px;">📚 ${ev.title} — Book Donations &amp; School Distribution</h3>
                        <p style="font-size:0.86rem;color:var(--text-muted);margin-bottom:12px;">
                            Connected NGOs/Schools: ${ev.ngos.map((n) => `<strong>${n.name}</strong> (${n.phone})`).join(' • ')}
                        </p>
                        <div class="table-wrap">
                            <table>
                                <thead><tr><th>Student</th><th>Category</th><th>Qty</th><th>Target School &amp; NGO</th></tr></thead>
                                <tbody>
                                    ${(d.pustak_donations || []).map((pd) => `
                                        <tr>
                                            <td><strong>${pd.student_name}</strong><br><span style="font-size:0.78rem;">${pd.usn}</span></td>
                                            <td>${pd.book_category}</td>
                                            <td><strong>${pd.quantity} books</strong></td>
                                            <td>${pd.target_school_name}<br><span style="font-size:0.78rem;color:var(--text-muted);">${pd.ngo_name || ''} (${pd.ngo_phone || ''})</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="card">
                        <h3 style="margin-bottom:12px;">➕ Record Book Donation</h3>
                        <form id="board-pustak-form">
                            <div class="form-group">
                                <label>Student</label>
                                <select class="input-control" name="student_id">
                                    ${state.students.map((st) => `<option value="${st.student_id}">${st.name} (${st.usn})</option>`).join('')}
                                </select>
                            </div>
                            <div class="grid-2">
                                <div class="form-group">
                                    <label>Book Category</label>
                                    <select class="input-control" name="book_category">
                                        <option value="Textbooks">Textbooks</option>
                                        <option value="Storybooks">Storybooks</option>
                                        <option value="Reference Books">Reference Books</option>
                                        <option value="Notebooks & Stationery">Notebooks &amp; Stationery</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Quantity</label>
                                    <input class="input-control" type="number" name="quantity" min="1" value="5" required />
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Connected NGO / Trust</label>
                                <select class="input-control" name="recipient_ngo_id">
                                    ${state.ngos.map((n) => `<option value="${n.ngo_id}">${n.name}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Target School Name</label>
                                <input class="input-control" name="target_school_name" value="Govt. High School, Kengeri" required />
                            </div>
                            <button class="btn btn-primary btn-block" type="submit">Record Book Donation</button>
                        </form>
                    </div>
                </div>
            ` : state.driveSubTab === 'fistfull' ? `
                <div class="ap-grid" style="grid-template-columns:1.35fr 0.95fr;">
                    <div class="card">
                        <h3 style="margin-bottom:10px;">🌾 ${ev.title} — 5 kg Rice / 2 kg Toor Dal (10 AP)</h3>
                        <p style="font-size:0.86rem;color:var(--text-muted);margin-bottom:12px;">
                            Connected NGOs: ${ev.ngos.map((n) => `<strong>${n.name}</strong> (${n.phone})`).join(' • ')}
                        </p>
                        <div class="table-wrap">
                            <table>
                                <thead><tr><th>Student</th><th>Item Donated</th><th>Qty (kg)</th><th>AP</th><th>Partner NGO</th></tr></thead>
                                <tbody>
                                    ${(d.fistfull_donations || []).map((fd) => `
                                        <tr>
                                            <td><strong>${fd.student_name}</strong><br><span style="font-size:0.78rem;">${fd.usn}</span></td>
                                            <td><span class="badge badge-green">${fd.item_type === 'rice_5kg' ? '5 kg Rice' : '2 kg Toor Dal'}</span></td>
                                            <td><strong>${fd.quantity_kg} kg</strong></td>
                                            <td><strong style="color:var(--magenta);">+${fd.points_earned} AP</strong></td>
                                            <td>${fd.ngo_name || ''} <br><span style="font-size:0.78rem;color:var(--text-muted);">${fd.ngo_phone || ''}</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="card">
                        <h3 style="margin-bottom:12px;">➕ Verify Grain Donation (+10 AP)</h3>
                        <form id="board-fistfull-form">
                            <div class="form-group">
                                <label>Student</label>
                                <select class="input-control" name="student_id">
                                    ${state.students.map((st) => `<option value="${st.student_id}">${st.name} (${st.usn})</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Grain Package</label>
                                <select class="input-control" name="item_type">
                                    <option value="rice_5kg">5 kg Rice → 10 Activity Points</option>
                                    <option value="toor_dal_2kg">2 kg Toor Dal → 10 Activity Points</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Partner NGO Receiving Grain</label>
                                <select class="input-control" name="ngo_id">
                                    ${(ev.ngos.length ? ev.ngos : state.ngos).map((n) => `<option value="${n.ngo_id}">${n.name} (${n.phone})</option>`).join('')}
                                </select>
                            </div>
                            <button class="btn btn-success btn-block" type="submit">Verify &amp; Award 10 AP</button>
                        </form>
                    </div>
                </div>
            ` : state.driveSubTab === 'walkathon' ? `
                <div class="card">
                    <h3 style="margin-bottom:10px;">🏃 ${ev.title}</h3>
                    <p style="color:var(--text-muted);margin-bottom:14px;">${ev.description}</p>
                    <div class="grid-2" style="background:#fffbeb;padding:16px;border-radius:12px;border:1px solid #fde68a;">
                        <div><strong>Distance:</strong> ${ev.special?.distance_km || 5} km</div>
                        <div><strong>Reporting Time:</strong> ${ev.special?.reporting_time || ev.start_time}</div>
                        <div><strong>Start Point:</strong> ${ev.special?.start_point || ev.venue}</div>
                        <div><strong>End Point:</strong> ${ev.special?.end_point || ev.venue}</div>
                        <div style="grid-column:1/-1;"><strong>Route:</strong> ${ev.special?.route_description || ev.venue}</div>
                        <div style="grid-column:1/-1;"><strong>Connected NGOs:</strong> ${ev.ngos.map((n) => `${n.name} (${n.phone})`).join(', ') || 'RVCE Health Club'}</div>
                    </div>
                    <div style="margin-top:16px;">
                        <button class="btn btn-primary btn-sm" data-open-att="${ev.event_id}">Open Walkathon Attendance Sheet →</button>
                    </div>
                </div>
            ` : `
                <div class="card">
                    <h3 style="margin-bottom:10px;">⛰️ ${ev.title}</h3>
                    <p style="color:var(--text-muted);margin-bottom:14px;">${ev.description}</p>
                    <div class="grid-2" style="background:#eef2ff;padding:16px;border-radius:12px;border:1px solid #c7d2fe;">
                        <div><strong>Hill / Peak:</strong> ${ev.special?.hill_name || ev.title}</div>
                        <div><strong>Location:</strong> ${ev.special?.location_area || 'Karnataka'}</div>
                        <div><strong>Elevation:</strong> ${ev.special?.elevation_m || 1450} m</div>
                        <div><strong>Distance &amp; Difficulty:</strong> ${ev.special?.trek_distance_km || 8} km (${ev.special?.difficulty || 'Moderate'})</div>
                        <div><strong>Bus Pickup:</strong> ${ev.special?.pickup_point || 'RVCE Main Gate'}</div>
                        <div><strong>Departure:</strong> ${ev.special?.departure_time || ev.start_time}</div>
                        <div style="grid-column:1/-1;"><strong>Checklist:</strong> ${ev.special?.checklist || 'Trekking shoes, 2L water, ID card'}</div>
                        <div style="grid-column:1/-1;"><strong>Connected Eco NGO:</strong> ${ev.ngos.map((n) => `${n.name} (${n.phone})`).join(', ') || 'EcoWatch Karnataka'}</div>
                    </div>
                    <div style="margin-top:16px;">
                        <button class="btn btn-primary btn-sm" data-open-att="${ev.event_id}">Open Trek Attendance Sheet →</button>
                    </div>
                </div>
            `}
        `}`;
    }

    function renderNgosTab() {
        return `
        <div style="margin-bottom:16px;">
            <h1 style="font-size:1.65rem;">Manage Organisations Directory</h1>
            <p class="section-subtitle">Maintain partner NGOs, Schools, Hospitals, and Blood Banks with phone numbers</p>
        </div>
        <div class="ap-grid" style="grid-template-columns:1.35fr 0.9fr;">
            <div class="ngo-list">
                ${state.ngos.map((n) => `
                    <div class="ngo-row-card">
                        <div>
                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                <strong>${n.name}</strong>
                                <span class="badge badge-navy">${n.org_type || 'NGO'}</span>
                                <span class="badge badge-pink">${n.category}</span>
                            </div>
                            <div style="font-size:0.84rem;color:var(--text-muted);margin:4px 0;">
                                👤 ${n.contact_person} • 📞 <strong>${n.phone}</strong> • 📍 ${n.address}
                            </div>
                            ${n.connected_events?.length ? `<div style="font-size:0.78rem;color:var(--navy);">Connected: ${n.connected_events.map((e) => e.title).join(', ')}</div>` : ''}
                        </div>
                        <button class="btn btn-ghost btn-sm" data-del-ngo="${n.ngo_id}" style="color:var(--rose-red);">Remove</button>
                    </div>
                `).join('')}
            </div>

            <div class="card">
                <h3 style="margin-bottom:12px;">➕ Add New Organisation</h3>
                <form id="add-ngo-form">
                    <div class="form-group">
                        <label>Organisation Name</label>
                        <input class="input-control" name="name" placeholder="e.g., Robin Hood Army Bengaluru" required />
                    </div>
                    <div class="grid-2">
                        <div class="form-group">
                            <label>Organisation Type</label>
                            <select class="input-control" name="org_type">
                                <option value="NGO">NGO</option>
                                <option value="School">School</option>
                                <option value="Hospital">Hospital</option>
                                <option value="Blood Bank">Blood Bank</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Category</label>
                            <select class="input-control" name="category">
                                <option value="Community">Community</option>
                                <option value="Healthcare">Healthcare</option>
                                <option value="Education">Education</option>
                                <option value="Food & Hunger">Food &amp; Hunger</option>
                                <option value="Environment">Environment</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Contact Person</label>
                        <input class="input-control" name="contact_person" required />
                    </div>
                    <div class="form-group">
                        <label>Phone Number</label>
                        <input class="input-control" name="phone" placeholder="+91 98..." required />
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input class="input-control" type="email" name="email" />
                    </div>
                    <div class="form-group">
                        <label>Address</label>
                        <input class="input-control" name="address" required />
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea class="input-control" name="description" rows="2"></textarea>
                    </div>
                    <button class="btn btn-primary btn-block" type="submit">Add to NGO Directory</button>
                </form>
            </div>
        </div>`;
    }

    function renderReportsTab() {
        const ov = state.dbmsOverview;
        return `
        <div style="margin-bottom:18px;">
            <h1 style="font-size:1.65rem;">DBMS Reports &amp; Activity Points Leaderboard</h1>
            <p class="section-subtitle">Live SQL aggregations (Views, Triggers, and Normalized Tables) for RVCE DBMS Lab evaluation</p>
        </div>
        <div class="card" style="margin-bottom:20px;">
            <h3 style="margin-bottom:12px;">Student Activity Points Summary (SQL View: <code>v_student_activity_summary</code>)</h3>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>USN</th><th>Student Name</th><th>Department</th><th>Sem</th><th>Events Attended</th><th>Total AP</th></tr></thead>
                    <tbody>
                        ${state.students.map((st) => `
                            <tr>
                                <td><strong>${st.usn}</strong></td>
                                <td>${st.name}</td>
                                <td>${st.department}</td>
                                <td>${st.semester}</td>
                                <td>${st.events_attended}</td>
                                <td><strong style="color:var(--magenta);">${st.total_activity_points} AP</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        ${ov ? `
            <div class="card" style="margin-bottom:20px;">
                <h3 style="margin-bottom:12px;">Event-wise Participation Statistics (SQL View: <code>v_event_participation_stats</code>)</h3>
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>Event</th><th>Date</th><th>Registered</th><th>Present</th><th>Absent</th><th>QR Verified</th><th>Total AP</th></tr></thead>
                        <tbody>
                            ${(ov.event_stats || []).map((es) => `
                                <tr>
                                    <td><strong>${es.title}</strong></td>
                                    <td>${formatDate(es.event_date)}</td>
                                    <td>${es.registered_count}</td>
                                    <td><span class="badge badge-green">${es.present_count}</span></td>
                                    <td><span class="badge badge-red">${es.absent_count}</span></td>
                                    <td><span class="badge badge-pink">${es.qr_verified_count}</span></td>
                                    <td><strong>${es.total_points_awarded} AP</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="ap-grid">
                <div class="card">
                    <h3 style="margin-bottom:10px;">PostgreSQL Tables</h3>
                    <div class="table-wrap">
                        <table>
                            <thead><tr><th>Table Name</th><th>Row Count</th></tr></thead>
                            <tbody>
                                ${ov.tables.map((t) => `<tr><td><code>${t.name}</code></td><td><strong>${t.rows}</strong></td></tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="card">
                    <h3 style="margin-bottom:10px;">Active PostgreSQL Views &amp; Triggers</h3>
                    ${ov.views.map((v) => `<div style="margin-bottom:10px;"><span class="badge badge-navy">VIEW</span> <code>${v.name}</code></div>`).join('')}
                    ${ov.triggers.map((tr) => `<div style="margin-bottom:10px;"><span class="badge badge-pink">TRIGGER</span> <code>${tr.name}</code> on <code>${tr.tbl_name}</code></div>`).join('')}
                </div>
            </div>
        ` : ''}`;
    }

    async function refresh() {
        await loadBaseData();
        if (state.tab === 'attendance' && state.selectedEventId) {
            await loadAttendance(state.selectedEventId);
        } else if (state.tab === 'drives') {
            const typeMap = { pustak: 'project_pustak', fistfull: 'fistfull', walkathon: 'walkathon', trek: 'trek' };
            await loadDriveDetail(typeMap[state.driveSubTab]);
        } else if (state.tab === 'reports') {
            state.dbmsOverview = await apiFetch('/api/dbms/overview');
        }
        render();
    }

    function render() {
        const root = document.getElementById('app');
        let body = '';
        if (state.tab === 'dashboard') body = renderDashboard();
        else if (state.tab === 'attendance') body = renderAttendanceTab();
        else if (state.tab === 'events') body = renderEventsAndUploadTab();
        else if (state.tab === 'blood') body = renderBloodCampTab();
        else if (state.tab === 'drives') body = renderDrivesTab();
        else if (state.tab === 'ngos') body = renderNgosTab();
        else if (state.tab === 'reports') body = renderReportsTab();

        root.innerHTML = `
        <div class="board-layout">
            ${renderSidebar()}
            <div class="board-main">
                <header class="board-topbar">
                    <div>
                        <strong style="color:var(--navy);">Rotaract Club of RVCE — Administration</strong>
                    </div>
                    <div class="user-menu">
                        <span class="badge badge-pink">${user.designation}</span>
                        <div class="avatar-circle" style="overflow:hidden;">
                            ${user.photo_url
                                ? `<img src="${user.photo_url}" alt="${user.name}" class="board-avatar-img" />`
                                : getInitials(user.name)
                            }
                        </div>
                    </div>
                </header>
                <main class="board-content">${body}</main>
            </div>
        </div>`;

        // Sidebar & Quick Action navigation
        root.querySelectorAll('[data-btab]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                state.tab = btn.dataset.btab;
                await refresh();
            });
        });

        document.getElementById('board-logout-btn')?.addEventListener('click', onLogout);

        // Attendance handlers
        document.getElementById('att-event-select')?.addEventListener('change', async (e) => {
            state.selectedEventId = Number(e.target.value);
            await loadAttendance(state.selectedEventId);
            render();
        });

        root.querySelectorAll('[data-mark]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const [sid, status] = btn.dataset.mark.split(':');
                const row = state.attendanceRows.find((r) => r.student_id === Number(sid));
                if (row) {
                    row.attendance_status = status;
                    render();
                }
            });
        });

        document.getElementById('save-attendance-btn')?.addEventListener('click', async () => {
            try {
                const payload = state.attendanceRows
                    .filter((r) => r.registration_id && ['present', 'absent'].includes(r.attendance_status))
                    .map((r) => ({ student_id: r.student_id, attendance_status: r.attendance_status }));
                await apiFetch(`/api/events/${state.selectedEventId}/attendance`, {
                    method: 'POST',
                    body: JSON.stringify({ records: payload })
                });
                toast('Attendance & Activity Points saved to PostgreSQL!', 'success');
                await refresh();
            } catch (err) {
                toast(err.message, 'error');
            }
        });

        document.getElementById('show-event-qr-btn')?.addEventListener('click', async () => {
            try {
                const qrData = await apiFetch(`/api/events/${state.selectedEventId}/qr`);
                openModal(`
                    <button class="modal-close" id="qr-board-close">×</button>
                    <h2 style="margin-bottom:4px;">📷 Event QR Attendance Control</h2>
                    <p style="font-size:0.86rem;color:var(--text-muted);margin-bottom:14px;">${qrData.title} • <strong>${qrData.activity_points} AP</strong></p>
                    <div class="grid-2" style="align-items:start;">
                        <div style="text-align:center;background:#f8f9fd;padding:16px;border-radius:14px;border:1px solid var(--border);">
                            <img id="board-qr-img" src="${qrData.qr_image_data_url}" alt="Event QR Code" style="width:190px;height:190px;border-radius:10px;border:1px solid var(--border);" />
                            <div style="margin-top:10px;font-size:0.8rem;word-break:break-all;">
                                <strong>QR Token:</strong> <code id="board-qr-token">${qrData.qr_token}</code>
                            </div>
                            <div style="margin-top:8px;">
                                <span id="board-qr-status-badge" class="badge ${qrData.qr_active ? 'badge-green' : 'badge-red'}">
                                    ${qrData.qr_active ? 'QR Check-in ACTIVE' : 'QR Check-in CLOSED'}
                                </span>
                            </div>
                            <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap;">
                                <button class="btn btn-outline btn-sm" id="toggle-qr-active-btn">${qrData.qr_active ? 'Close QR' : 'Activate QR'}</button>
                                <button class="btn btn-ghost btn-sm" id="regen-qr-btn">Regenerate Token</button>
                            </div>
                        </div>
                        <div class="card" style="box-shadow:none;">
                            <h4 style="margin-bottom:8px;">Verify Registered Student Pass</h4>
                            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px;">
                                Scan/paste a student's Registration QR Pass token or enter a registered USN to verify QR attendance.
                            </p>
                            <form id="board-qr-verify-form">
                                <div class="form-group">
                                    <label>Student QR Pass Token</label>
                                    <input class="input-control" name="pass_token" placeholder="Paste student pass token (optional)" />
                                </div>
                                <div class="form-group">
                                    <label>Or Registered Student USN</label>
                                    <input class="input-control" name="usn" placeholder="e.g., 1RV23CS001" />
                                </div>
                                <button type="submit" class="btn btn-primary btn-block btn-sm">✓ Verify QR Attendance</button>
                            </form>
                        </div>
                    </div>
                `);

                document.getElementById('qr-board-close')?.addEventListener('click', closeModal);

                let currentActive = qrData.qr_active;
                document.getElementById('toggle-qr-active-btn')?.addEventListener('click', async () => {
                    const updated = await apiFetch(`/api/events/${state.selectedEventId}/qr/toggle`, {
                        method: 'POST',
                        body: JSON.stringify({ qr_active: !currentActive })
                    });
                    currentActive = updated.qr_active;
                    toast(`QR Check-in ${currentActive ? 'activated' : 'closed'}.`, 'success');
                    closeModal();
                    document.getElementById('show-event-qr-btn')?.click();
                });

                document.getElementById('regen-qr-btn')?.addEventListener('click', async () => {
                    await apiFetch(`/api/events/${state.selectedEventId}/qr/toggle`, {
                        method: 'POST',
                        body: JSON.stringify({ regenerate: true, qr_active: true })
                    });
                    toast('New Event QR token generated!', 'success');
                    closeModal();
                    document.getElementById('show-event-qr-btn')?.click();
                });

                document.getElementById('board-qr-verify-form')?.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.target);
                    try {
                        const res = await apiFetch(`/api/events/${state.selectedEventId}/attendance/qr-verify`, {
                            method: 'POST',
                            body: JSON.stringify({
                                pass_token: fd.get('pass_token'),
                                usn: fd.get('usn')
                            })
                        });
                        toast(`QR Verified: ${res.student_name} (${res.usn}) +${res.points_awarded} AP`, 'success');
                        closeModal();
                        await refresh();
                    } catch (err) {
                        toast(err.message, 'error');
                    }
                });
            } catch (err) {
                toast(err.message, 'error');
            }
        });

        document.getElementById('download-att-csv-btn')?.addEventListener('click', () => {
            const evTitle = state.attendanceEvent?.title || 'Event';
            const lines = ['USN,Name,Email,Department,Status,Points'];
            state.attendanceRows.forEach((r) => {
                lines.push(`"${r.usn}","${r.name}","${r.email}","${r.department}","${r.attendance_status}",${r.attendance_status === 'present' ? state.attendanceEvent.activity_points : 0}`);
            });
            const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${evTitle.replace(/\s+/g, '_')}_Attendance.csv`;
            a.click();
            toast('Attendance sheet CSV downloaded!', 'success');
        });

        root.querySelectorAll('[data-open-att]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                state.selectedEventId = Number(btn.dataset.openAtt);
                state.tab = 'attendance';
                await refresh();
            });
        });

        // Events upload & status toggle
        document.getElementById('new-event-type')?.addEventListener('change', (e) => {
            state.newEventType = e.target.value;
            render();
        });

        document.getElementById('upload-event-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const ngoIds = fd.getAll('ngo_ids').map(Number);
            const eventType = fd.get('event_type');
            const payload = {
                title: fd.get('title'),
                event_type: eventType,
                short_tagline: fd.get('short_tagline'),
                description: fd.get('description'),
                event_date: fd.get('event_date'),
                start_time: fd.get('start_time'),
                end_time: fd.get('end_time'),
                venue: fd.get('venue'),
                poc_name: fd.get('poc_name'),
                poc_phone: fd.get('poc_phone'),
                activity_points: Number(fd.get('activity_points')),
                status: fd.get('status'),
                ngo_ids: ngoIds
            };
            if (eventType === 'trek') {
                payload.trek = {
                    hill_name: fd.get('hill_name') || fd.get('title'),
                    elevation_m: Number(fd.get('elevation_m') || 1200),
                    trek_distance_km: Number(fd.get('trek_distance_km') || 6),
                    difficulty: fd.get('difficulty') || 'Moderate',
                    pickup_point: 'RVCE Main Gate',
                    departure_time: fd.get('start_time')
                };
            } else if (eventType === 'walkathon') {
                payload.walkathon = {
                    distance_km: Number(fd.get('distance_km') || 5),
                    reporting_time: fd.get('reporting_time') || fd.get('start_time'),
                    route_description: fd.get('route_description') || fd.get('venue')
                };
            }
            try {
                await apiFetch('/api/events', { method: 'POST', body: JSON.stringify(payload) });
                toast('New event uploaded and linked with selected organisations!', 'success');
                await refresh();
            } catch (err) {
                toast(err.message, 'error');
            }
        });

        root.querySelectorAll('[data-edit-ev]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const ev = state.events.find((x) => x.event_id === Number(btn.dataset.editEv));
                if (!ev) return;
                const linkedIds = new Set((ev.ngos || []).map((n) => n.org_id || n.ngo_id));
                openModal(`
                    <button class="modal-close" id="edit-ev-close">×</button>
                    <h2 style="margin-bottom:14px;">✏️ Edit Event</h2>
                    <form id="edit-event-form">
                        <div class="form-group"><label>Title</label><input class="input-control" name="title" value="${ev.title}" required /></div>
                        <div class="form-group"><label>Tagline</label><input class="input-control" name="short_tagline" value="${ev.short_tagline}" required /></div>
                        <div class="form-group"><label>Description</label><textarea class="input-control" name="description" rows="3" required>${ev.description}</textarea></div>
                        <div class="grid-2">
                            <div class="form-group"><label>Date</label><input class="input-control" type="date" name="event_date" value="${ev.event_date}" required /></div>
                            <div class="form-group"><label>Activity Points</label><input class="input-control" type="number" name="activity_points" value="${ev.activity_points}" required /></div>
                            <div class="form-group"><label>Start Time</label><input class="input-control" name="start_time" value="${ev.start_time}" required /></div>
                            <div class="form-group"><label>End Time</label><input class="input-control" name="end_time" value="${ev.end_time}" required /></div>
                        </div>
                        <div class="form-group"><label>Venue</label><input class="input-control" name="venue" value="${ev.venue}" required /></div>
                        <div class="grid-2">
                            <div class="form-group"><label>POC Name</label><input class="input-control" name="poc_name" value="${ev.poc_name || ''}" required /></div>
                            <div class="form-group"><label>POC Phone</label><input class="input-control" name="poc_phone" value="${ev.poc_phone || ''}" required /></div>
                        </div>
                        <div class="form-group">
                            <label>Associated Organisations</label>
                            <div style="display:grid;gap:6px;max-height:120px;overflow-y:auto;border:1px solid var(--border);padding:10px;border-radius:10px;">
                                ${state.ngos.map((n) => `
                                    <label style="display:flex;align-items:center;gap:8px;font-weight:500;margin:0;font-size:0.84rem;">
                                        <input type="checkbox" name="org_ids" value="${n.org_id || n.ngo_id}" ${linkedIds.has(n.org_id || n.ngo_id) ? 'checked' : ''} />
                                        <span>${n.name} (${n.org_type || 'NGO'})</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        <button class="btn btn-primary btn-block" type="submit">Save Changes</button>
                    </form>
                `);
                document.getElementById('edit-ev-close')?.addEventListener('click', closeModal);
                document.getElementById('edit-event-form')?.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.target);
                    try {
                        await apiFetch(`/api/events/${ev.event_id}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                                title: fd.get('title'),
                                short_tagline: fd.get('short_tagline'),
                                description: fd.get('description'),
                                event_date: fd.get('event_date'),
                                start_time: fd.get('start_time'),
                                end_time: fd.get('end_time'),
                                venue: fd.get('venue'),
                                poc_name: fd.get('poc_name'),
                                poc_phone: fd.get('poc_phone'),
                                activity_points: Number(fd.get('activity_points')),
                                org_ids: fd.getAll('org_ids').map(Number)
                            })
                        });
                        toast('Event updated!', 'success');
                        closeModal();
                        await refresh();
                    } catch (err) {
                        toast(err.message, 'error');
                    }
                });
            });
        });

        root.querySelectorAll('[data-del-ev]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                try {
                    await apiFetch(`/api/events/${btn.dataset.delEv}`, { method: 'DELETE' });
                    toast('Event deleted.');
                    await refresh();
                } catch (err) {
                    toast(err.message, 'error');
                }
            });
        });

        root.querySelectorAll('[data-toggle-ev-status]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const [id, nextStatus] = btn.dataset.toggleEvStatus.split(':');
                await apiFetch(`/api/events/${id}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
                toast(`Event marked as ${nextStatus}.`, 'success');
                await refresh();
            });
        });

        // Blood Camp handlers
        root.querySelectorAll('[data-bsub]').forEach((btn) => {
            btn.addEventListener('click', () => {
                state.bloodSubTab = btn.dataset.bsub;
                render();
            });
        });

        document.getElementById('add-donor-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const eventId = fd.get('event_id');
            await apiFetch(`/api/events/${eventId}/blood-donation`, {
                method: 'POST',
                body: JSON.stringify({
                    student_id: Number(fd.get('student_id')),
                    blood_group: fd.get('blood_group'),
                    units_donated: Number(fd.get('units_donated')),
                    hospital_id: Number(fd.get('hospital_id'))
                })
            });
            toast('Blood donor recorded & +30 AP awarded via SQL trigger!', 'success');
            await refresh();
        });

        document.getElementById('urgency-req-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            await apiFetch('/api/blood/urgency-request', {
                method: 'POST',
                body: JSON.stringify({
                    hospital_id: Number(fd.get('hospital_id')),
                    event_id: Number(fd.get('event_id')),
                    blood_group: fd.get('blood_group'),
                    units_requested: Number(fd.get('units_requested')),
                    urgency_level: fd.get('urgency_level'),
                    notes: fd.get('notes')
                })
            });
            toast('Urgent hospital blood request logged!', 'success');
            await refresh();
        });

        root.querySelectorAll('[data-dispatch-req]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                await apiFetch(`/api/blood/urgency-request/${btn.dataset.dispatchReq}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status: 'dispatched' })
                });
                toast('Blood units dispatched to hospital!', 'success');
                await refresh();
            });
        });

        // Specialized Drives handlers
        root.querySelectorAll('[data-dsub]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                state.driveSubTab = btn.dataset.dsub;
                await refresh();
            });
        });

        document.getElementById('board-pustak-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            await apiFetch(`/api/events/${state.driveDetail.event.event_id}/pustak`, {
                method: 'POST',
                body: JSON.stringify({
                    student_id: Number(fd.get('student_id')),
                    book_category: fd.get('book_category'),
                    quantity: Number(fd.get('quantity')),
                    recipient_ngo_id: Number(fd.get('recipient_ngo_id')),
                    target_school_name: fd.get('target_school_name')
                })
            });
            toast('Book donation recorded & AP awarded!', 'success');
            await refresh();
        });

        document.getElementById('board-fistfull-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            await apiFetch(`/api/events/${state.driveDetail.event.event_id}/fistfull`, {
                method: 'POST',
                body: JSON.stringify({
                    student_id: Number(fd.get('student_id')),
                    item_type: fd.get('item_type'),
                    ngo_id: Number(fd.get('ngo_id'))
                })
            });
            toast('Fistfull donation verified & +10 AP awarded!', 'success');
            await refresh();
        });

        // NGO Directory handlers
        document.getElementById('add-ngo-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            await apiFetch('/api/ngos', {
                method: 'POST',
                body: JSON.stringify(Object.fromEntries(fd.entries()))
            });
            toast('NGO added to general directory!', 'success');
            await refresh();
        });

        root.querySelectorAll('[data-del-ngo]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                await apiFetch(`/api/ngos/${btn.dataset.delNgo}`, { method: 'DELETE' });
                toast('NGO removed from directory.');
                await refresh();
            });
        });
    }

    return {
        start: refresh
    };
}
