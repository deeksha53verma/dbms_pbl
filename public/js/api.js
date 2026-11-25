const TOKEN_KEY = 'rotaract_rvce_token';

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(path, {
        credentials: 'same-origin',
        ...options,
        headers
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
}

export function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

export function getInitials(name = '') {
    return name
        .replace(/^Rtr\.\s*/i, '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join('') || 'RV';
}

export function eventTypeLabel(type) {
    const map = {
        blood_donation: 'Blood Donation Camp',
        walkathon: 'Walkathon',
        project_pustak: 'Project Pustak',
        fistfull: 'Fistfull Drive',
        trek: 'Trekking Expedition',
        general: 'Club Initiative'
    };
    return map[type] || 'Club Initiative';
}
