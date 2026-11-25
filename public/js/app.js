import { apiFetch, getToken, setToken } from './api.js';
import { rotaractLogoSvg, campusIllustrationSvg } from './icons.js';
import { createStudentController } from './studentView.js';
import { createBoardController } from './boardView.js';

const state = {
    loginRole: 'student', // student | board
    studentAuthMode: 'login', // login | register
    demoAccounts: null,
    setupError: null
};

function toast(message, type = 'info') {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => el.remove(), 3400);
}

function openModal(html) {
    const modalRoot = document.getElementById('modal-root');
    modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal-dialog">${html}</div></div>`;
    modalRoot.querySelector('.modal-backdrop').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) closeModal();
    });
}

function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
}

function renderLogin() {
    const app = document.getElementById('app');
    const isStudent = state.loginRole === 'student';
    const demos = state.demoAccounts;

    app.innerHTML = `
    <div class="login-shell">
        <div class="login-card">
            <div class="login-brand-panel">
                <div>
                    <div class="brand-lockup">
                        ${rotaractLogoSvg(48)}
                        <div>
                            <h2>Rotaract</h2>
                            <span>Club Of RVCE</span>
                        </div>
                    </div>
                    <p class="brand-tagline">Create Lasting Impact</p>
                    <p class="brand-subtext">
                        Together for a Better Tomorrow — Track community drives, hospital blood units, NGO partnerships, and official RVCE Activity Points.
                    </p>
                </div>
                <div class="campus-illustration">
                    ${campusIllustrationSvg()}
                </div>
            </div>

            <div class="login-form-panel">
                <h1>${isStudent ? (state.studentAuthMode === 'register' ? 'Student Sign Up' : 'Welcome Back!') : 'Board Member Login'}</h1>
                    <p class="login-subtitle">
                    ${isStudent
                        ? 'Login using your official @rvce.edu.in college email'
                        : 'Sign in with your RVCE College ID, Rotary Number, and Password'
                    }
                </p>

                <div class="role-toggle">
                    <button type="button" class="${isStudent ? 'active' : ''}" data-role-switch="student">Student</button>
                    <button type="button" class="${!isStudent ? 'active' : ''}" data-role-switch="board">Board Member</button>
                </div>

                ${state.setupError ? `
                    <div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:10px 12px;border-radius:10px;font-size:0.83rem;margin-bottom:14px;">
                        <strong>Database Setup Needed:</strong> ${state.setupError}
                    </div>
                ` : ''}

                ${isStudent ? (state.studentAuthMode === 'login' ? `
                    <form id="student-login-form">
                        <div class="form-group">
                            <label>College Email ID (@rvce.edu.in)</label>
                            <div class="input-wrap">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                <input class="input-control" type="email" name="email" id="stu-email-input" placeholder="name@rvce.edu.in" required />
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <div class="input-wrap">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                <input class="input-control" type="password" name="password" id="stu-pass-input" placeholder="Enter password" required />
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary btn-block">Login as Student</button>
                    </form>
                    <div style="text-align:center;margin-top:12px;font-size:0.86rem;">
                        New RVCE student? <button type="button" id="toggle-stu-mode" style="color:var(--magenta);font-weight:700;">Register @rvce.edu.in account</button>
                    </div>
                ` : `
                    <form id="student-register-form">
                        <div class="grid-2">
                            <div class="form-group">
                                <label>USN</label>
                                <input class="input-control" name="usn" placeholder="1RV24CS099" required />
                            </div>
                            <div class="form-group">
                                <label>Full Name</label>
                                <input class="input-control" name="name" placeholder="Student Name" required />
                            </div>
                        </div>
                        <div class="form-group">
                            <label>RVCE Email (@rvce.edu.in)</label>
                            <div style="display:flex;gap:8px;align-items:center;">
                                <input class="input-control" type="email" name="email" id="stu-reg-email" placeholder="student@rvce.edu.in" required />
                                <button type="button" class="btn btn-outline btn-sm" id="send-otp-btn" style="flex-shrink:0;">Send OTP</button>
                            </div>
                            <div id="otp-status-msg" style="font-size:0.79rem;color:var(--text-muted);margin-top:5px;"></div>
                        </div>
                        <div class="form-group">
                            <label>Email Verification OTP (6 digits)</label>
                            <input class="input-control" name="otp" id="stu-reg-otp" maxlength="6" pattern="[0-9]{6}" placeholder="Enter 6-digit OTP sent to @rvce.edu.in" required />
                        </div>
                        <div class="grid-2">
                            <div class="form-group">
                                <label>Department</label>
                                <input class="input-control" name="department" value="Computer Science & Engg" required />
                            </div>
                            <div class="form-group">
                                <label>Semester</label>
                                <input class="input-control" type="number" name="semester" min="1" max="8" value="5" required />
                            </div>
                        </div>
                        <div class="grid-2">
                            <div class="form-group">
                                <label>Phone</label>
                                <input class="input-control" name="phone" placeholder="9876543210" required />
                            </div>
                            <div class="form-group">
                                <label>Blood Group</label>
                                <select class="input-control" name="blood_group">
                                    <option value="O+">O+</option>
                                    <option value="A+">A+</option>
                                    <option value="B+">B+</option>
                                    <option value="AB+">AB+</option>
                                    <option value="O-">O-</option>
                                    <option value="A-">A-</option>
                                    <option value="B-">B-</option>
                                    <option value="AB-">AB-</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Password (min 6 chars)</label>
                            <input class="input-control" type="password" name="password" minlength="6" required />
                        </div>
                        <button type="submit" class="btn btn-primary btn-block">Create Student Account</button>
                    </form>
                    <div style="text-align:center;margin-top:12px;font-size:0.86rem;">
                        Already registered? <button type="button" id="toggle-stu-mode" style="color:var(--magenta);font-weight:700;">Back to Login</button>
                    </div>
                `) : `
                    <form id="board-login-form">
                        <div class="form-group">
                            <label>College ID (USN / Faculty ID)</label>
                            <div class="input-wrap">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 8h2M15 12h2M7 16h10"/></svg>
                                <input class="input-control" name="college_id" id="bm-cid-input" placeholder="e.g., 1RV23CS001B" required />
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Rotary Number</label>
                            <div class="input-wrap">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                                <input class="input-control" name="rotary_number" id="bm-rot-input" placeholder="e.g., RI-3191-101" required />
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <div class="input-wrap">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                <input class="input-control" type="password" name="password" id="bm-pass-input" placeholder="Enter board password" required />
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary btn-block">Login as Board Member</button>
                    </form>
                `}

                ${demos ? `
                    <div class="demo-box">
                        <div class="demo-box-title">
                            <span>Quick Demo Fill (DBMS Lab Testing)</span>
                        </div>
                        <div class="demo-pills">
                            ${isStudent
                                ? demos.students.map((s) => `
                                    <button type="button" class="demo-pill" data-demo-student="${s.email}">
                                        ${s.name.split(' ')[0]} (${s.usn})
                                    </button>
                                `).join('')
                                : demos.board.map((b) => `
                                    <button type="button" class="demo-pill" data-demo-board="${b.college_id}|${b.rotary_number}">
                                        ${b.name} • ${b.designation}
                                    </button>
                                `).join('')
                            }
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    </div>`;

    app.querySelectorAll('[data-role-switch]').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.loginRole = btn.dataset.roleSwitch;
            state.studentAuthMode = 'login';
            renderLogin();
        });
    });

    document.getElementById('toggle-stu-mode')?.addEventListener('click', () => {
        state.studentAuthMode = state.studentAuthMode === 'login' ? 'register' : 'login';
        renderLogin();
    });

    app.querySelectorAll('[data-demo-student]').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.studentAuthMode = 'login';
            const emailInp = document.getElementById('stu-email-input');
            const passInp = document.getElementById('stu-pass-input');
            if (emailInp) emailInp.value = btn.dataset.demoStudent;
            if (passInp) passInp.focus();
        });
    });

    app.querySelectorAll('[data-demo-board]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const [cid, rno] = btn.dataset.demoBoard.split('|');
            document.getElementById('bm-cid-input').value = cid;
            document.getElementById('bm-rot-input').value = rno;
            document.getElementById('bm-pass-input')?.focus();
        });
    });

    document.getElementById('student-login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
            const res = await apiFetch('/api/auth/student-login', {
                method: 'POST',
                body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') })
            });
            setToken(res.token);
            launchPortal(res.role, res.user);
        } catch (err) {
            toast(err.message, 'error');
        }
    });

    document.getElementById('send-otp-btn')?.addEventListener('click', async () => {
        const emailInp = document.getElementById('stu-reg-email');
        const msgEl = document.getElementById('otp-status-msg');
        const email = emailInp?.value.trim();
        if (!email) {
            toast('Enter your @rvce.edu.in email first.', 'error');
            return;
        }
        try {
            const res = await apiFetch('/api/auth/send-otp', {
                method: 'POST',
                body: JSON.stringify({ email })
            });
            msgEl.style.color = 'var(--emerald)';
            msgEl.textContent = res.message;
            toast(res.delivery === 'smtp' ? 'OTP sent to your @rvce.edu.in email!' : `Lab OTP generated: ${res.dev_otp}`, 'success');
            document.getElementById('stu-reg-otp')?.focus();
        } catch (err) {
            msgEl.style.color = 'var(--rose-red)';
            msgEl.textContent = err.message;
            toast(err.message, 'error');
        }
    });

    document.getElementById('student-register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
            const res = await apiFetch('/api/auth/student-register', {
                method: 'POST',
                body: JSON.stringify(Object.fromEntries(fd.entries()))
            });
            setToken(res.token);
            toast('Student account registered!', 'success');
            launchPortal(res.role, res.user);
        } catch (err) {
            toast(err.message, 'error');
        }
    });

    document.getElementById('board-login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
            const res = await apiFetch('/api/auth/board-login', {
                method: 'POST',
                body: JSON.stringify({
                    college_id: fd.get('college_id'),
                    rotary_number: fd.get('rotary_number'),
                    password: fd.get('password')
                })
            });
            setToken(res.token);
            launchPortal(res.role, res.user);
        } catch (err) {
            toast(err.message, 'error');
        }
    });
}

async function handleLogout() {
    try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch {}
    setToken(null);
    closeModal();
    renderLogin();
}

async function launchPortal(role, user) {
    if (role === 'student') {
        const ctrl = createStudentController({ user, onLogout: handleLogout, toast, openModal, closeModal });
        await ctrl.start();
    } else {
        const ctrl = createBoardController({ user, onLogout: handleLogout, toast, openModal, closeModal });
        await ctrl.start();
    }
}

async function bootstrap() {
    try {
        state.demoAccounts = await apiFetch('/api/demo-accounts');
        state.setupError = null;
    } catch (err) {
        state.demoAccounts = null;
        state.setupError = err.message;
    }

    if (getToken()) {
        try {
            const me = await apiFetch('/api/auth/me');
            await launchPortal(me.role, me.user);
            return;
        } catch {
            setToken(null);
        }
    }
    renderLogin();
}

bootstrap();
