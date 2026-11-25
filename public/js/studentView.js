import { apiFetch, formatDate, getInitials, eventTypeLabel } from './api.js';
import { rotaractLogoSvg, eventBannerSvg, starSvg, deanSignatureSvg } from './icons.js';
import { downloadOfficialCertificatePdf } from './pdf.js';

export function createStudentController({ user, onLogout, toast, openModal, closeModal }) {
    const state = {
        tab: 'home', // home | events | activity | ngos | team
        eventFilter: 'all', // all | upcoming | past
        eventSearch: '',
        ngoSearch: '',
        ngoCategory: 'All',
        events: [],
        boardMembers: [],
        ngos: [],
        activityData: null
    };

    async function loadAllData() {
        const [evRes, bmRes, ngoRes, apRes] = await Promise.all([
            apiFetch('/api/events'),
            apiFetch('/api/board-members'),
            apiFetch('/api/ngos'),
            apiFetch('/api/student/activity-points')
        ]);
        state.events = evRes.events || [];
        state.boardMembers = bmRes.members || [];
        state.ngos = ngoRes.ngos || [];
        state.activityData = apRes;
    }

    function renderNavbar() {
        const links = [
            { id: 'home', label: 'Home' },
            { id: 'events', label: 'Events' },
            { id: 'activity', label: 'Activity Points' },
            { id: 'ngos', label: 'NGOs' },
            { id: 'team', label: 'Our Team' }
        ];
        return `
        <header class="top-nav">
            <div class="nav-brand" data-nav="home">
                ${rotaractLogoSvg(38)}
                <div class="nav-brand-text">
                    Rotaract Club
                    <small>OF RVCE</small>
                </div>
            </div>
            <nav class="nav-links">
                ${links.map((l) => `
                    <button class="nav-link ${state.tab === l.id ? 'active' : ''}" data-nav="${l.id}">
                        ${l.label}
                    </button>
                `).join('')}
            </nav>
            <div class="user-menu">
                <span class="badge badge-pink">${user.usn}</span>
                <div class="avatar-circle" title="${user.name}">${getInitials(user.name)}</div>
                <button class="btn btn-ghost btn-sm" id="logout-btn">Logout</button>
            </div>
        </header>`;
    }

    function renderEventCard(ev) {
        const reg = ev.my_registration;
        const isRegistered = Boolean(reg);
        const isPresent = reg?.attendance_status === 'present';

        let actionHtml = '';
        if (ev.status === 'upcoming') {
            if (isPresent) {
                actionHtml = `<span class="badge badge-green">Attended (+${reg.points_awarded} AP)</span>`;
            } else if (isRegistered) {
                actionHtml = `<button class="btn btn-outline btn-sm" data-cancel-reg="${ev.event_id}">Registered ✓</button>`;
            } else {
                actionHtml = `<button class="btn btn-primary btn-sm" data-register="${ev.event_id}">Register Now</button>`;
            }
        } else {
            actionHtml = isPresent
                ? `<span class="badge badge-green">Earned +${reg.points_awarded} AP</span>`
                : `<span class="badge badge-navy">Completed</span>`;
        }

        return `
        <article class="event-card">
            <div class="event-card-media">
                ${eventBannerSvg(ev.event_type)}
                <span class="status-badge-float ${ev.status === 'upcoming' ? 'status-upcoming' : 'status-past'}">
                    ${ev.status === 'upcoming' ? 'Upcoming' : 'Past Event'}
                </span>
                <span class="ap-badge-float">${ev.activity_points} AP</span>
            </div>
            <div class="event-card-body">
                <h3>${ev.title}</h3>
                <p class="event-tagline">${ev.short_tagline}</p>
                <div class="meta-list">
                    <div class="meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                        <span>${formatDate(ev.event_date)} • ${ev.start_time}</span>
                    </div>
                    <div class="meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span>${ev.venue}</span>
                    </div>
                </div>
                ${ev.ngos?.length ? `
                    <div class="ngo-chip-row">
                        ${ev.ngos.map((n) => `<span class="ngo-chip">🤝 ${n.name}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="event-card-footer">
                    <button class="btn btn-ghost btn-sm" data-view-event="${ev.event_id}">View Details →</button>
                    <div style="margin-left:auto;">${actionHtml}</div>
                </div>
            </div>
        </article>`;
    }

    function renderHome() {
        const totalAp = state.activityData?.summary?.total_activity_points ?? 0;
        const upcoming = state.events.filter((e) => e.status === 'upcoming');
        const allPreview = state.events.slice(0, 3);

        return `
        <section class="hero-banner">
            <div>
                <h1>Welcome, ${user.name.split(' ')[0]}!</h1>
                <p>Together We Serve. Together We Grow. — Rotaract Club of RVCE</p>
                <div class="hero-meta-pills">
                    <span class="hero-pill">${user.usn}</span>
                    <span class="hero-pill">${user.email}</span>
                    <span class="hero-pill">${user.department} • Sem ${user.semester}</span>
                </div>
            </div>
            <div class="ap-hero-card">
                <div class="ap-hero-label">Total Activity Points</div>
                <div class="ap-hero-value">
                    ${starSvg(34)}
                    <span>${totalAp}</span>
                </div>
                <button class="btn btn-outline btn-sm" style="margin-top:10px;" data-nav="activity">
                    Official PDF &amp; Ledger
                </button>
            </div>
        </section>

        <div class="section-header">
            <div>
                <h2>Our Board Members</h2>
                <p class="section-subtitle">Rotaract Club of RVCE Board 2026-27 (District 3191)</p>
            </div>
            <button class="btn btn-ghost btn-sm" data-nav="team">View All ${state.boardMembers.length} Members →</button>
        </div>
        <div class="board-strip">
            ${[0, 1, 3, 2, 10].map((idx) => state.boardMembers[idx]).filter(Boolean).map((bm) => `
                <div class="board-member-mini">
                    <div class="board-avatar">
                        ${bm.photo_url
                            ? `<img src="${bm.photo_url}" alt="${bm.name}" class="board-avatar-img" />`
                            : getInitials(bm.name)
                        }
                    </div>
                    <h4>${bm.name}</h4>
                    <span class="board-designation">${bm.designation}</span>
                </div>
            `).join('')}
        </div>

        <div class="section-header">
            <div>
                <h2>Upcoming Events</h2>
                <p class="section-subtitle">Register now to participate, support partner organisations, and earn Activity Points</p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm" id="open-qr-checkin-btn">📷 Scan Event QR</button>
                <button class="btn btn-ghost btn-sm" data-nav="events">View All →</button>
            </div>
        </div>
        <div class="upcoming-featured-list">
            ${upcoming.map((ev) => {
                const isReg = Boolean(ev.my_registration);
                const isPresent = ev.my_registration?.attendance_status === 'present';
                return `
                <div class="upcoming-banner-card">
                    <div class="event-thumb">${eventBannerSvg(ev.event_type)}</div>
                    <div>
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
                            <span class="badge badge-pink">${eventTypeLabel(ev.event_type)}</span>
                            ${ev.ngos?.map((n) => `<span class="ngo-chip">🤝 ${n.name} (${n.phone})</span>`).join('') || ''}
                        </div>
                        <h3 style="font-size:1.22rem;color:var(--navy);margin-bottom:4px;">${ev.title}</h3>
                        <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:10px;">${ev.description}</p>
                        <div style="display:flex;flex-wrap:wrap;gap:14px;font-size:0.84rem;color:var(--navy);font-weight:600;">
                            <span>📅 ${formatDate(ev.event_date)}</span>
                            <span>⏰ ${ev.start_time} – ${ev.end_time}</span>
                            <span>📍 ${ev.venue}</span>
                        </div>
                        <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
                            ${isPresent
                                ? `<span class="badge badge-green">Attended (+${ev.my_registration.points_awarded} AP)</span>`
                                : isReg
                                    ? `<button class="btn btn-outline btn-sm" data-cancel-reg="${ev.event_id}">Registered ✓ (Cancel)</button>`
                                    : `<button class="btn btn-primary btn-sm" data-register="${ev.event_id}">Register Now</button>`
                            }
                            <button class="btn btn-ghost btn-sm" data-view-event="${ev.event_id}">Event Details &amp; NGOs →</button>
                        </div>
                    </div>
                    <div class="ap-side-box">
                        <small>Activity Points</small>
                        <strong>${ev.activity_points}</strong>
                        <small style="margin-top:6px;color:var(--navy);">${ev.registered_count} Registered</small>
                    </div>
                </div>`;
            }).join('')}
        </div>

        <div class="section-header">
            <div>
                <h2>All Events Snapshot</h2>
                <p class="section-subtitle">Explore ongoing and past Rotaract initiatives</p>
            </div>
            <button class="btn btn-outline btn-sm" data-nav="events">Explore All Events (${state.events.length})</button>
        </div>
        <div class="events-grid">
            ${allPreview.map(renderEventCard).join('')}
        </div>`;
    }

    function renderEventsPage() {
        const filtered = state.events.filter((ev) => {
            if (state.eventFilter !== 'all' && ev.status !== state.eventFilter) return false;
            if (state.eventSearch.trim()) {
                const q = state.eventSearch.toLowerCase();
                return ev.title.toLowerCase().includes(q) || ev.description.toLowerCase().includes(q) || ev.venue.toLowerCase().includes(q);
            }
            return true;
        });

        return `
        <div class="section-header" style="margin-top:0;">
            <div>
                <h1 style="font-size:1.7rem;">All Rotaract Events</h1>
                <p class="section-subtitle">Browse upcoming drives, register for events, and view associated NGOs, schools &amp; hospitals</p>
            </div>
            <button class="btn btn-primary btn-sm" id="open-qr-checkin-btn-2">📷 Scan Event QR</button>
        </div>
        <div class="filter-bar">
            <div class="filter-tabs">
                ${['all', 'upcoming', 'past'].map((f) => `
                    <button class="filter-tab ${state.eventFilter === f ? 'active' : ''}" data-ev-filter="${f}">
                        ${f === 'all' ? 'All Events' : f === 'upcoming' ? 'Upcoming' : 'Past Events'}
                    </button>
                `).join('')}
            </div>
            <div class="input-wrap" style="min-width:270px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input type="text" id="event-search-input" class="input-control" placeholder="Search events or venues..." value="${state.eventSearch}" />
            </div>
        </div>
        ${filtered.length === 0
            ? `<div class="card" style="text-align:center;padding:40px;color:var(--text-muted);">No matching events found.</div>`
            : `<div class="events-grid">${filtered.map(renderEventCard).join('')}</div>`
        }`;
    }

    function renderActivityPage() {
        const ap = state.activityData;
        const total = ap?.summary?.total_activity_points ?? 0;
        const records = ap?.records || [];
        const earnedRecords = records.filter((r) => r.attendance_status === 'present');

        return `
        <div class="section-header" style="margin-top:0;">
            <div>
                <h1 style="font-size:1.7rem;">Activity Points &amp; Official Certificate</h1>
                <p class="section-subtitle">Track accumulated points and download your official Dean-signed RVCE Rotaract PDF</p>
            </div>
            <button class="btn btn-primary" id="download-cert-pdf-btn">
                📄 Download Official PDF Certificate
            </button>
        </div>

        <div class="ap-grid">
            <div>
                <div class="card" style="text-align:center;margin-bottom:18px;background:linear-gradient(135deg,#fff,#fdf2f7);">
                    <div style="font-size:0.9rem;font-weight:700;color:var(--text-muted);">Accumulated Activity Points Till Now</div>
                    <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin:10px 0;">
                        ${starSvg(44)}
                        <span style="font-size:3rem;font-weight:800;color:var(--navy);">${total}</span>
                    </div>
                    <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
                        <span class="badge badge-green">${ap?.summary?.events_attended || 0} Events Verified</span>
                        <span class="badge badge-navy">${ap?.summary?.events_registered || 0} Total Registrations</span>
                    </div>
                </div>

                <div class="card">
                    <h3 style="margin-bottom:12px;">Activity Points Ledger</h3>
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Event</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                    <th>Points</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${records.length === 0 ? `
                                    <tr><td colspan="4" style="text-align:center;color:var(--text-muted);">No event registrations yet.</td></tr>
                                ` : records.map((r) => `
                                    <tr>
                                        <td><strong>${r.title}</strong></td>
                                        <td>${formatDate(r.event_date)}</td>
                                        <td>
                                            ${r.attendance_status === 'present'
                                                ? `<span class="badge badge-green">Present ${r.verification_method ? `(${r.verification_method.toUpperCase()})` : ''}</span>`
                                                : r.attendance_status === 'absent'
                                                    ? `<span class="badge badge-red">Absent</span>`
                                                    : `<span class="badge badge-gold">Registered</span>`
                                            }
                                        </td>
                                        <td><strong style="color:var(--magenta);">+${r.points_awarded} AP</strong></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="certificate-frame">
                <div style="display:flex;align-items:center;justify-content:center;gap:10px;">
                    ${rotaractLogoSvg(36)}
                    <div style="text-align:left;">
                        <strong style="color:var(--magenta);font-size:1rem;">Rotaract Club of RVCE</strong>
                        <div style="font-size:0.75rem;color:var(--text-muted);">R. V. College of Engineering, Bengaluru</div>
                    </div>
                </div>
                <h2 class="cert-title">Certificate of Activity Points</h2>
                <p style="font-size:0.86rem;color:var(--text-muted);">This is to officially certify that</p>
                <div class="cert-student-name">${user.name}</div>
                <p style="font-size:0.84rem;color:var(--navy);font-weight:600;">
                    USN: ${user.usn} • ${user.email}
                </p>
                <p style="font-size:0.9rem;color:var(--text-muted);margin:12px auto;max-width:440px;">
                    has actively participated in community service initiatives under the Rotaract Club of RVCE and accumulated
                    <strong style="color:var(--magenta);font-size:1.08rem;"> ${total} Activity Points </strong>
                    across ${earnedRecords.length} verified event(s).
                </p>
                <div style="background:#fff;border:1px solid #eadfb8;border-radius:8px;padding:10px;text-align:left;font-size:0.8rem;margin:10px 0;">
                    <strong>Verified Events Included:</strong>
                    <div style="margin-top:4px;color:var(--text-muted);">
                        ${earnedRecords.length ? earnedRecords.map((r) => `• ${r.title} (+${r.points_awarded} AP)`).join('<br>') : 'No verified events yet.'}
                    </div>
                </div>
                <div class="cert-signatures">
                    <div class="sig-block">
                        ${deanSignatureSvg()}
                        <div class="sig-line">
                            Signature of Dean, RVCE<br>
                            <span style="font-weight:500;color:var(--text-muted);">${ap?.signatories?.dean || ''}</span>
                        </div>
                    </div>
                    <div class="sig-block">
                        <div style="height:44px;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-style:italic;color:var(--magenta);font-size:1.05rem;">
                            ${ap?.signatories?.president?.split('(')[0] || 'Rtr. Pavana'}
                        </div>
                        <div class="sig-line">
                            Rotaract President<br>
                            <span style="font-weight:500;color:var(--text-muted);">RVCE Chapter (2026-27)</span>
                        </div>
                    </div>
                </div>
                <button class="btn btn-primary btn-sm" style="margin-top:18px;" id="download-cert-pdf-btn-2">
                    ⬇ Download Official PDF
                </button>
            </div>
        </div>`;
    }

    function renderNgosPage() {
        const categories = ['All', 'Healthcare', 'Education', 'Food & Hunger', 'Community', 'Environment'];
        const filtered = state.ngos.filter((n) => {
            if (state.ngoCategory !== 'All' && n.category !== state.ngoCategory) return false;
            if (state.ngoSearch.trim()) {
                const q = state.ngoSearch.toLowerCase();
                return n.name.toLowerCase().includes(q) || n.phone.toLowerCase().includes(q) || n.contact_person.toLowerCase().includes(q);
            }
            return true;
        });

        return `
        <div class="section-header" style="margin-top:0;">
            <div>
                <h1 style="font-size:1.7rem;">Organisations &amp; NGOs Directory</h1>
                <p class="section-subtitle">Partner NGOs, Schools, Hospitals, and Blood Banks with contact phone numbers</p>
            </div>
        </div>
        <div class="filter-bar">
            <div class="filter-tabs">
                ${categories.map((c) => `
                    <button class="filter-tab ${state.ngoCategory === c ? 'active' : ''}" data-ngo-cat="${c}">${c}</button>
                `).join('')}
            </div>
            <div class="input-wrap" style="min-width:260px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input type="text" id="ngo-search-input" class="input-control" placeholder="Search organisation or phone..." value="${state.ngoSearch}" />
            </div>
        </div>
        <div class="ngo-list">
            ${filtered.map((n) => `
                <div class="ngo-row-card">
                    <div style="display:flex;align-items:center;gap:16px;">
                        <div class="ngo-logo-badge">${getInitials(n.name)}</div>
                        <div>
                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                <h3 style="font-size:1.06rem;">${n.name}</h3>
                                <span class="badge badge-navy">${n.org_type || 'NGO'}</span>
                                <span class="badge badge-pink">${n.category}</span>
                            </div>
                            <p style="font-size:0.86rem;color:var(--text-muted);margin:3px 0 6px;">${n.description || n.address}</p>
                            <div style="display:flex;flex-wrap:wrap;gap:14px;font-size:0.84rem;font-weight:600;color:var(--navy);">
                                <span>📞 ${n.phone}</span>
                                <span>👤 ${n.contact_person}</span>
                                <span>📍 ${n.address}</span>
                            </div>
                            ${n.connected_events?.length ? `
                                <div class="ngo-chip-row" style="margin-top:8px;margin-bottom:0;">
                                    ${n.connected_events.map((ce) => `<span class="ngo-chip">Linked Event: ${ce.title}</span>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <a class="btn btn-outline btn-sm" href="tel:${n.phone.replace(/\s+/g, '')}">Call ${n.phone}</a>
                </div>
            `).join('')}
        </div>`;
    }

    function renderTeamPage() {
        const portfolios = [];
        const byPortfolio = new Map();
        for (const bm of state.boardMembers) {
            const p = bm.portfolio || 'Executive Board';
            if (!byPortfolio.has(p)) {
                byPortfolio.set(p, []);
                portfolios.push(p);
            }
            byPortfolio.get(p).push(bm);
        }

        return `
        <div class="section-header" style="margin-top:0;">
            <div>
                <h1 style="font-size:1.7rem;">Board of Rotaract Club of RVCE (2026-27)</h1>
                <p class="section-subtitle">Rotary International District 3191 • All ${state.boardMembers.length} Office Bearers &amp; Directors</p>
            </div>
        </div>
        ${portfolios.map((p) => {
            const list = byPortfolio.get(p);
            return `
            <div class="team-portfolio-title">
                <span>${p}</span>
                <span class="badge badge-pink">${list.length} ${list.length === 1 ? 'Member' : 'Members'}</span>
            </div>
            <div class="team-grid-4">
                ${list.map((bm) => `
                    <div class="card" style="text-align:center;padding:18px 14px;">
                        <div class="board-avatar" style="width:86px;height:86px;font-size:1.35rem;">
                            ${bm.photo_url
                                ? `<img src="${bm.photo_url}" alt="${bm.name}" class="board-avatar-img" />`
                                : getInitials(bm.name)
                            }
                        </div>
                        <h3 style="margin-top:6px;font-size:1.02rem;">${bm.name}</h3>
                        <span class="board-designation" style="margin:6px 0 10px;">${bm.designation}</span>
                        <div style="text-align:left;background:#f8f9fd;padding:10px 12px;border-radius:10px;font-size:0.79rem;color:var(--text-muted);display:grid;gap:3px;">
                            <div><strong style="color:var(--navy);">College ID:</strong> ${bm.college_id}</div>
                            <div><strong style="color:var(--navy);">Rotary No:</strong> ${bm.rotary_number}</div>
                            <div><strong style="color:var(--navy);">Dept:</strong> ${bm.department}</div>
                            <div><strong style="color:var(--navy);">Email:</strong> ${bm.email}</div>
                        </div>
                    </div>
                `).join('')}
            </div>`;
        }).join('')}`;
    }

    async function showEventDetailModal(eventId) {
        const data = await apiFetch(`/api/events/${eventId}`);
        const { event: ev, blood_donors, urgency_requests, hospitals, pustak_donations, fistfull_donations } = data;
        const isReg = Boolean(ev.my_registration);
        const isPresent = ev.my_registration?.attendance_status === 'present';

        let specialSection = '';
        if (ev.event_type === 'blood_donation') {
            const totalUnits = blood_donors.reduce((s, d) => s + d.units_donated, 0);
            specialSection = `
            <div class="card" style="background:#fff5f7;border-color:#fecdd3;margin-top:16px;">
                <h4 style="color:#be123c;margin-bottom:8px;">🩸 Blood Donation &amp; Hospital Urgency Access</h4>
                <p style="font-size:0.88rem;color:var(--text-muted);margin-bottom:10px;">
                    <strong>${totalUnits} Units</strong> recorded in this camp. Units are directly mapped to partner hospital blood banks for urgent surgical/trauma access.
                </p>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    ${hospitals.map((h) => `
                        <div style="background:#fff;padding:10px 12px;border-radius:10px;border:1px solid #fecdd3;font-size:0.82rem;">
                            <strong>🏥 ${h.name}</strong><br>
                            <span>Emergency: <strong>${h.emergency_phone}</strong></span><br>
                            <span style="color:var(--text-muted);">Contact: ${h.urgency_contact_person}</span>
                        </div>
                    `).join('')}
                </div>
                ${urgency_requests.length ? `
                    <div style="margin-top:10px;font-size:0.82rem;">
                        <strong>Active Hospital Urgency Links:</strong>
                        ${urgency_requests.map((u) => `<span class="badge badge-red" style="margin-left:6px;">${u.hospital_name}: ${u.units_requested}x ${u.blood_group} (${u.status})</span>`).join('')}
                    </div>
                ` : ''}
            </div>`;
        } else if (ev.event_type === 'walkathon' && ev.special) {
            specialSection = `
            <div class="card" style="background:#fffbeb;border-color:#fde68a;margin-top:16px;">
                <h4 style="color:#b45309;margin-bottom:8px;">🏃 Walkathon Route &amp; Details</h4>
                <div class="grid-2" style="font-size:0.86rem;">
                    <div><strong>Distance:</strong> ${ev.special.distance_km} km</div>
                    <div><strong>Reporting Time:</strong> ${ev.special.reporting_time}</div>
                    <div><strong>Start Point:</strong> ${ev.special.start_point}</div>
                    <div><strong>End Point:</strong> ${ev.special.end_point}</div>
                </div>
                <p style="font-size:0.86rem;margin-top:8px;"><strong>Route:</strong> ${ev.special.route_description}</p>
            </div>`;
        } else if (ev.event_type === 'trek' && ev.special) {
            specialSection = `
            <div class="card" style="background:#eef2ff;border-color:#c7d2fe;margin-top:16px;">
                <h4 style="color:#3730a3;margin-bottom:8px;">⛰️ Trekking Expedition Details</h4>
                <div class="grid-2" style="font-size:0.86rem;">
                    <div><strong>Hill / Peak:</strong> ${ev.special.hill_name}</div>
                    <div><strong>Location:</strong> ${ev.special.location_area}</div>
                    <div><strong>Elevation:</strong> ${ev.special.elevation_m} m</div>
                    <div><strong>Trail Distance:</strong> ${ev.special.trek_distance_km} km (${ev.special.difficulty})</div>
                    <div><strong>Bus Pickup:</strong> ${ev.special.pickup_point}</div>
                    <div><strong>Departure:</strong> ${ev.special.departure_time}</div>
                </div>
                <p style="font-size:0.85rem;margin-top:8px;"><strong>Checklist:</strong> ${ev.special.checklist}</p>
            </div>`;
        } else if (ev.event_type === 'project_pustak') {
            specialSection = `
            <div class="card" style="background:#f0f9ff;border-color:#bae6fd;margin-top:16px;">
                <h4 style="color:#0369a1;margin-bottom:8px;">📚 Project Pustak — Donate Books to Partner Schools</h4>
                <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:10px;">
                    Books collected: <strong>${pustak_donations.reduce((s, d) => s + d.quantity, 0)}</strong> across ${pustak_donations.length} student contributions.
                </p>
                <form id="student-pustak-form" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <select class="input-control" name="book_category">
                        <option value="Textbooks">Textbooks</option>
                        <option value="Storybooks">Storybooks</option>
                        <option value="Reference Books">Reference Books</option>
                        <option value="Notebooks & Stationery">Notebooks &amp; Stationery</option>
                    </select>
                    <input class="input-control" type="number" name="quantity" min="1" value="5" placeholder="No. of books" required />
                    <select class="input-control" name="recipient_ngo_id">
                        ${state.ngos.map((n) => `<option value="${n.ngo_id}">${n.name}</option>`).join('')}
                    </select>
                    <input class="input-control" type="text" name="target_school_name" value="Govt. High School, Kengeri" placeholder="Target School Name" required />
                    <button class="btn btn-primary btn-sm" type="submit" style="grid-column:1 / -1;">Donate Books &amp; Earn ${ev.activity_points} AP</button>
                </form>
            </div>`;
        } else if (ev.event_type === 'fistfull') {
            specialSection = `
            <div class="card" style="background:#ecfdf5;border-color:#a7f3d0;margin-top:16px;">
                <h4 style="color:#047857;margin-bottom:8px;">🌾 Fistfull — Donate 5 kg Rice OR 2 kg Toor Dal (10 AP)</h4>
                <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:10px;">
                    Total collected: <strong>${fistfull_donations.reduce((s, d) => s + d.quantity_kg, 0)} kg</strong> • Each verified grain contribution earns <strong>10 Activity Points</strong>.
                </p>
                <form id="student-fistfull-form" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <select class="input-control" name="item_type" required>
                        <option value="rice_5kg">5 kg Rice (10 Activity Points)</option>
                        <option value="toor_dal_2kg">2 kg Toor Dal (10 Activity Points)</option>
                    </select>
                    <select class="input-control" name="ngo_id" required>
                        ${(ev.ngos?.length ? ev.ngos : state.ngos).map((n) => `<option value="${n.ngo_id}">${n.name} (${n.phone})</option>`).join('')}
                    </select>
                    <button class="btn btn-success btn-sm" type="submit" style="grid-column:1 / -1;">Confirm Donation &amp; Claim 10 AP</button>
                </form>
            </div>`;
        }

        openModal(`
            <button class="modal-close" id="close-modal-btn">×</button>
            <div style="border-radius:14px;overflow:hidden;height:165px;margin-bottom:16px;">
                ${eventBannerSvg(ev.event_type)}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;">
                <div>
                    <span class="badge badge-pink">${eventTypeLabel(ev.event_type)}</span>
                    <h2 style="font-size:1.55rem;margin-top:6px;">${ev.title}</h2>
                </div>
                <div class="ap-side-box" style="padding:10px 20px;height:auto;">
                    <small>Activity Points</small>
                    <strong>${ev.activity_points}</strong>
                </div>
            </div>
            <p style="color:var(--text-muted);margin:10px 0 14px;">${ev.description}</p>
            <div class="grid-2" style="background:#f8f9fd;padding:12px 14px;border-radius:12px;font-size:0.88rem;margin-bottom:14px;">
                <div><strong>📅 Date:</strong> ${formatDate(ev.event_date)}</div>
                <div><strong>⏰ Time:</strong> ${ev.start_time} – ${ev.end_time}</div>
                <div><strong>📍 Venue:</strong> ${ev.venue}</div>
                <div><strong>👥 Registered:</strong> ${ev.registered_count} students</div>
                <div><strong>👤 Event POC:</strong> ${ev.poc_name || 'Board Member'}</div>
                <div><strong>📞 POC Phone:</strong> ${ev.poc_phone || 'N/A'}</div>
            </div>

            <div>
                <h4 style="margin-bottom:8px;">Associated Organisations (${ev.ngos?.length || 0})</h4>
                ${ev.ngos?.length ? ev.ngos.map((n) => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;">
                        <div>
                            <strong>${n.name}</strong>
                            <span class="badge badge-pink" style="margin-left:4px;">${n.org_type || 'NGO'}</span>
                            <span class="badge badge-navy">${n.partnership_role}</span>
                            <div style="font-size:0.82rem;color:var(--text-muted);">Contact: ${n.contact_person} • 📞 ${n.phone}</div>
                        </div>
                        <a class="btn btn-outline btn-sm" href="tel:${n.phone.replace(/\s+/g, '')}">Call</a>
                    </div>
                `).join('') : `<p style="font-size:0.86rem;color:var(--text-muted);">Club-managed initiative (no external organisation linked).</p>`}
            </div>

            ${specialSection}

            <div id="my-pass-qr-box" style="display:none;margin-top:14px;text-align:center;padding:14px;border:1.5px dashed #f0bfd2;border-radius:12px;background:#fff9fc;"></div>

            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;flex-wrap:wrap;">
                ${isReg && ev.status === 'upcoming' && !isPresent ? `
                    <button class="btn btn-navy btn-sm" id="show-my-pass-qr-btn">🎫 My QR Pass</button>
                    <button class="btn btn-outline btn-sm" id="modal-scan-qr-btn">📷 Scan Event QR</button>
                ` : ''}
                ${ev.status === 'upcoming' && !isPresent
                    ? (isReg
                        ? `<button class="btn btn-outline" data-modal-cancel="${ev.event_id}">Cancel Registration</button>`
                        : `<button class="btn btn-primary" data-modal-reg="${ev.event_id}">Register for Event</button>`)
                    : ''
                }
                <button class="btn btn-ghost" id="close-modal-btn-2">Close</button>
            </div>
        `);

        document.getElementById('close-modal-btn')?.addEventListener('click', closeModal);
        document.getElementById('close-modal-btn-2')?.addEventListener('click', closeModal);

        document.querySelector('[data-modal-reg]')?.addEventListener('click', async () => {
            await apiFetch(`/api/events/${ev.event_id}/register`, { method: 'POST' });
            toast('Successfully registered for ' + ev.title, 'success');
            closeModal();
            await refresh();
        });

        document.querySelector('[data-modal-cancel]')?.addEventListener('click', async () => {
            await apiFetch(`/api/events/${ev.event_id}/register`, { method: 'DELETE' });
            toast('Registration cancelled.');
            closeModal();
            await refresh();
        });

        document.getElementById('show-my-pass-qr-btn')?.addEventListener('click', async () => {
            try {
                const pass = await apiFetch(`/api/events/${ev.event_id}/my-pass-qr`);
                const box = document.getElementById('my-pass-qr-box');
                box.style.display = 'block';
                box.innerHTML = `
                    <strong style="color:var(--navy);">Your Registration QR Pass</strong>
                    <div style="margin:10px auto;"><img src="${pass.qr_image_data_url}" alt="Registration QR Pass" style="width:170px;height:170px;border-radius:8px;" /></div>
                    <div style="font-size:0.78rem;color:var(--text-muted);word-break:break-all;">Pass Token: <code>${pass.pass_token}</code></div>
                `;
            } catch (err) {
                toast(err.message, 'error');
            }
        });

        document.getElementById('modal-scan-qr-btn')?.addEventListener('click', () => {
            showQrCheckinModal();
        });

        document.getElementById('student-fistfull-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            try {
                const res = await apiFetch(`/api/events/${ev.event_id}/fistfull`, {
                    method: 'POST',
                    body: JSON.stringify({ item_type: fd.get('item_type'), ngo_id: Number(fd.get('ngo_id')) })
                });
                toast(
                    res.verified
                        ? `Fistfull verified! +${res.points_earned} Activity Points added.`
                        : 'Fistfull grain pledge recorded! A Board Member will verify your attendance to award 10 AP.',
                    'success'
                );
                closeModal();
                await refresh();
            } catch (err) {
                toast(err.message, 'error');
            }
        });

        document.getElementById('student-pustak-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            try {
                await apiFetch(`/api/events/${ev.event_id}/pustak`, {
                    method: 'POST',
                    body: JSON.stringify({
                        book_category: fd.get('book_category'),
                        quantity: Number(fd.get('quantity')),
                        recipient_ngo_id: Number(fd.get('recipient_ngo_id')),
                        target_school_name: fd.get('target_school_name')
                    })
                });
                toast('Book donation recorded for Project Pustak!', 'success');
                closeModal();
                await refresh();
            } catch (err) {
                toast(err.message, 'error');
            }
        });
    }

    function showQrCheckinModal() {
        let stream = null;
        let stopRequested = false;

        const cleanupCamera = () => {
            stopRequested = true;
            if (stream) {
                stream.getTracks().forEach((t) => t.stop());
                stream = null;
            }
        };

        openModal(`
            <button class="modal-close" id="qr-modal-close">×</button>
            <h2 style="margin-bottom:6px;">📷 Scan Event QR for Attendance</h2>
            <p style="font-size:0.88rem;color:var(--text-muted);margin-bottom:16px;">
                Scan the Event QR code shown by an authorised Board Member (or enter the QR token). Your registration and attendance are verified securely on the Flask backend.
            </p>
            <div style="background:#f8f9fd;border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:14px;text-align:center;">
                <video id="qr-video-preview" autoplay playsinline style="width:100%;max-height:220px;border-radius:10px;display:none;background:#000;"></video>
                <button type="button" class="btn btn-navy btn-sm" id="start-camera-qr-btn">🎥 Start Camera QR Scanner</button>
                <div id="camera-qr-status" style="font-size:0.8rem;color:var(--text-muted);margin-top:6px;"></div>
            </div>
            <form id="qr-checkin-form">
                <div class="form-group">
                    <label>Event QR Token</label>
                    <input class="input-control" id="qr-token-input" name="qr_token" placeholder="Paste or scan QR token (e.g., QR-RVCE-...)" required />
                </div>
                <button type="submit" class="btn btn-primary btn-block">Verify Attendance via QR</button>
            </form>
        `);

        const closeAll = () => {
            cleanupCamera();
            closeModal();
        };
        document.getElementById('qr-modal-close')?.addEventListener('click', closeAll);

        document.getElementById('start-camera-qr-btn')?.addEventListener('click', async () => {
            const statusEl = document.getElementById('camera-qr-status');
            const videoEl = document.getElementById('qr-video-preview');
            if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
                statusEl.textContent = 'Camera BarcodeDetector is unavailable in this browser; please enter the Event QR Token below.';
                return;
            }
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                videoEl.srcObject = stream;
                videoEl.style.display = 'block';
                statusEl.textContent = 'Point camera at the Event QR code...';
                const detector = new window.BarcodeDetector({ formats: ['qr_code'] });

                const scanTick = async () => {
                    if (stopRequested) return;
                    try {
                        const codes = await detector.detect(videoEl);
                        if (codes.length && codes[0].rawValue) {
                            document.getElementById('qr-token-input').value = codes[0].rawValue;
                            statusEl.textContent = 'QR code detected! Submitting...';
                            cleanupCamera();
                            document.getElementById('qr-checkin-form')?.requestSubmit();
                            return;
                        }
                    } catch {}
                    requestAnimationFrame(scanTick);
                };
                requestAnimationFrame(scanTick);
            } catch (err) {
                statusEl.textContent = 'Camera access denied or unavailable. Please enter the QR token below.';
            }
        });

        document.getElementById('qr-checkin-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tokenVal = document.getElementById('qr-token-input').value.trim();
            try {
                const res = await apiFetch('/api/attendance/qr-checkin', {
                    method: 'POST',
                    body: JSON.stringify({ qr_token: tokenVal })
                });
                cleanupCamera();
                toast(`QR Attendance verified for ${res.event_title}! +${res.points_awarded} AP awarded.`, 'success');
                closeModal();
                await refresh();
            } catch (err) {
                toast(err.message, 'error');
            }
        });
    }

    async function refresh() {
        await loadAllData();
        render();
    }

    function render() {
        const root = document.getElementById('app');
        let body = '';
        if (state.tab === 'home') body = renderHome();
        else if (state.tab === 'events') body = renderEventsPage();
        else if (state.tab === 'activity') body = renderActivityPage();
        else if (state.tab === 'ngos') body = renderNgosPage();
        else if (state.tab === 'team') body = renderTeamPage();

        root.innerHTML = `
            ${renderNavbar()}
            <main class="page-container">${body}</main>
        `;

        // Bind navigation
        root.querySelectorAll('[data-nav]').forEach((el) => {
            el.addEventListener('click', () => {
                state.tab = el.dataset.nav;
                render();
            });
        });

        document.getElementById('logout-btn')?.addEventListener('click', onLogout);

        // Bind event registration
        root.querySelectorAll('[data-register]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                try {
                    await apiFetch(`/api/events/${btn.dataset.register}/register`, { method: 'POST' });
                    toast('Registered successfully!', 'success');
                    await refresh();
                } catch (err) {
                    toast(err.message, 'error');
                }
            });
        });

        root.querySelectorAll('[data-cancel-reg]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                try {
                    await apiFetch(`/api/events/${btn.dataset.cancelReg}/register`, { method: 'DELETE' });
                    toast('Registration cancelled.');
                    await refresh();
                } catch (err) {
                    toast(err.message, 'error');
                }
            });
        });

        root.querySelectorAll('[data-view-event]').forEach((btn) => {
            btn.addEventListener('click', () => showEventDetailModal(btn.dataset.viewEvent));
        });

        root.querySelectorAll('[data-ev-filter]').forEach((btn) => {
            btn.addEventListener('click', () => {
                state.eventFilter = btn.dataset.evFilter;
                render();
            });
        });

        document.getElementById('event-search-input')?.addEventListener('input', (e) => {
            state.eventSearch = e.target.value;
            render();
            const inp = document.getElementById('event-search-input');
            if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
        });

        root.querySelectorAll('[data-ngo-cat]').forEach((btn) => {
            btn.addEventListener('click', () => {
                state.ngoCategory = btn.dataset.ngoCat;
                render();
            });
        });

        document.getElementById('ngo-search-input')?.addEventListener('input', (e) => {
            state.ngoSearch = e.target.value;
            render();
            const inp = document.getElementById('ngo-search-input');
            if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
        });

        const pdfHandler = () => {
            downloadOfficialCertificatePdf(state.activityData);
            toast('Official Activity Points PDF downloaded!', 'success');
        };
        document.getElementById('download-cert-pdf-btn')?.addEventListener('click', pdfHandler);
        document.getElementById('download-cert-pdf-btn-2')?.addEventListener('click', pdfHandler);
        document.getElementById('open-qr-checkin-btn')?.addEventListener('click', showQrCheckinModal);
        document.getElementById('open-qr-checkin-btn-2')?.addEventListener('click', showQrCheckinModal);
    }

    return {
        start: refresh
    };
}
