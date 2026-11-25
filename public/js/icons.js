export function rotaractLogoSvg(size = 42) {
    return `
    <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="rotGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#e11d68"/>
                <stop offset="100%" stop-color="#9f1239"/>
            </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="url(#rotGrad)"/>
        <circle cx="32" cy="32" r="18" stroke="#fff" stroke-width="3" stroke-dasharray="5 3"/>
        <circle cx="32" cy="32" r="10" stroke="#fde047" stroke-width="2.5"/>
        <circle cx="32" cy="32" r="3.5" fill="#fff"/>
        <path d="M32 14V22M32 42V50M14 32H22M42 32H50" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`;
}

export function campusIllustrationSvg() {
    return `
    <svg viewBox="0 0 460 190" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">
        <rect width="460" height="190" fill="transparent"/>
        <path d="M0 165 Q120 135 230 155 T460 148 L460 190 L0 190 Z" fill="#1b1f4b" opacity="0.12"/>
        <rect x="46" y="74" width="368" height="92" rx="8" fill="#ffffff" stroke="#d8dbe8" stroke-width="2"/>
        <rect x="170" y="48" width="120" height="118" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
        <polygon points="164,48 230,22 296,48" fill="#c9185b"/>
        <rect x="210" y="108" width="40" height="58" rx="4" fill="#1b1f4b"/>
        <circle cx="230" cy="74" r="12" fill="#fce7f3" stroke="#c9185b" stroke-width="2.5"/>
        <text x="230" y="78" text-anchor="middle" font-size="9" font-weight="bold" fill="#c9185b">RVCE</text>
        ${[64, 96, 128, 308, 340, 372].map(x => `
            <rect x="${x}" y="90" width="20" height="22" rx="3" fill="#e2e8f0"/>
            <rect x="${x}" y="122" width="20" height="22" rx="3" fill="#e2e8f0"/>
        `).join('')}
        <circle cx="32" cy="148" r="22" fill="#10b981" opacity="0.85"/>
        <circle cx="428" cy="146" r="24" fill="#059669" opacity="0.85"/>
        <rect x="0" y="164" width="460" height="26" fill="#1b1f4b"/>
        <text x="230" y="181" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff" letter-spacing="1.2">R. V. COLLEGE OF ENGINEERING • BENGALURU</text>
    </svg>`;
}

export function eventBannerSvg(eventType) {
    const configs = {
        blood_donation: {
            bg1: '#be123c', bg2: '#fb7185', label: 'BLOOD DONATION',
            icon: `<path d="M50 18 C50 18 32 42 32 54 A18 18 0 0 0 68 54 C68 42 50 18 50 18 Z" fill="#fff" opacity="0.95"/>
                   <path d="M44 54 H56 M50 48 V60" stroke="#be123c" stroke-width="4" stroke-linecap="round"/>`
        },
        walkathon: {
            bg1: '#ea580c', bg2: '#fbbf24', label: 'WALKATHON',
            icon: `<circle cx="52" cy="26" r="7" fill="#fff"/>
                   <path d="M40 66 L48 48 L58 55 L55 70 M48 48 L43 37 L56 35 L64 43" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`
        },
        project_pustak: {
            bg1: '#0284c7', bg2: '#38bdf8', label: 'PROJECT PUSTAK',
            icon: `<path d="M26 28 Q38 23 50 28 V66 Q38 61 26 66 Z" fill="#fff" opacity="0.95"/>
                   <path d="M74 28 Q62 23 50 28 V66 Q62 61 74 66 Z" fill="#e0f2fe"/>`
        },
        fistfull: {
            bg1: '#059669', bg2: '#34d399', label: 'FISTFULL • 10 AP',
            icon: `<path d="M28 46 Q50 76 72 46 Z" fill="#fff"/>
                   <circle cx="42" cy="36" r="5" fill="#fde047"/>
                   <circle cx="52" cy="32" r="5" fill="#fef08a"/>
                   <circle cx="60" cy="38" r="5" fill="#fde047"/>`
        },
        trek: {
            bg1: '#4338ca', bg2: '#818cf8', label: 'HILL TREK',
            icon: `<polygon points="18,68 44,24 64,68" fill="#fff" opacity="0.95"/>
                   <polygon points="44,68 64,34 84,68" fill="#e0e7ff" opacity="0.9"/>
                   <circle cx="72" cy="24" r="7" fill="#fde047"/>`
        },
        general: {
            bg1: '#c9185b', bg2: '#1b1f4b', label: 'ROTARACT EVENT',
            icon: `<polygon points="50,18 58,38 78,38 62,50 68,70 50,58 32,70 38,50 22,38 42,38" fill="#fde047"/>`
        }
    };
    const c = configs[eventType] || configs.general;
    return `
    <svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block;" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="g_${eventType}" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="${c.bg1}"/>
                <stop offset="100%" stop-color="${c.bg2}"/>
            </linearGradient>
        </defs>
        <rect width="320" height="150" fill="url(#g_${eventType})"/>
        <circle cx="285" cy="28" r="52" fill="#fff" opacity="0.1"/>
        <circle cx="35" cy="135" r="46" fill="#fff" opacity="0.08"/>
        <g transform="translate(110, 26)">${c.icon}</g>
        <text x="16" y="136" fill="#fff" opacity="0.88" font-size="11" font-weight="800" letter-spacing="1.2">${c.label}</text>
    </svg>`;
}

export function starSvg(size = 28) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
}

export function deanSignatureSvg() {
    return `
    <svg width="145" height="44" viewBox="0 0 180 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 36 C26 12, 34 10, 32 34 C30 42, 46 18, 56 26 C64 32, 62 38, 76 24 C86 14, 96 36, 112 28 C126 21, 138 30, 166 22"
              stroke="#1b1f4b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M22 42 Q90 36 158 39" stroke="#c9185b" stroke-width="1.3" stroke-linecap="round" opacity="0.7"/>
    </svg>`;
}
