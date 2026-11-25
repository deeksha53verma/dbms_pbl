/**
 * Pure-JS PDF 1.4 Generator for Official RVCE Rotaract Activity Points Certificate.
 * Produces a genuine downloadable A4 Landscape PDF with Dean's vector signature
 * and verified event breakdown without requiring any external libraries.
 */

function pdfEscape(str) {
    return String(str || '')
        .replace(/[^\x20-\x7E]/g, ' ')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}

export function downloadOfficialCertificatePdf(data) {
    const { summary, records, signatories } = data;
    const studentName = summary?.name || 'RVCE Student';
    const usn = summary?.usn || '1RV23CS000';
    const email = summary?.email || 'student@rvce.edu.in';
    const dept = `${summary?.department || 'Engineering'} (Sem ${summary?.semester || '-'})`;
    const totalPoints = Number(summary?.total_activity_points || 0);
    const earnedRows = (records || []).filter((r) => r.attendance_status === 'present' && r.points_awarded > 0);
    const issueDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const certId = `RVCE-ROTARACT-${usn}-${new Date().getFullYear()}`;

    // A4 Landscape: 842 x 595 pt
    const W = 842;
    const H = 595;
    const ops = [];

    // Outer cream background
    ops.push('0.996 0.992 0.976 rg');
    ops.push(`0 0 ${W} ${H} re f`);

    // Gold outer border & inner navy border
    ops.push('0.83 0.68 0.21 RG 6 w');
    ops.push(`24 24 ${W - 48} ${H - 48} re S`);
    ops.push('0.106 0.122 0.294 RG 1.5 w');
    ops.push(`34 34 ${W - 68} ${H - 68} re S`);

    // Top magenta header ribbon
    ops.push('0.788 0.094 0.357 rg');
    ops.push(`34 ${H - 108} ${W - 68} 74 re f`);

    // Header text
    ops.push('BT /F2 22 Tf 1 1 1 rg 58 525 Td (ROTARACT CLUB OF RVCE) Tj ET');
    ops.push('BT /F1 11 Tf 1 0.92 0.95 rg 58 504 Td (R. V. College of Engineering, Bengaluru  |  Rotary International District 3191) Tj ET');
    ops.push(`BT /F2 10 Tf 1 1 1 rg 625 516 Td (CERT ID: ${pdfEscape(certId)}) Tj ET`);

    // Certificate Title
    ops.push('BT /F2 26 Tf 0.106 0.122 0.294 rg 205 446 Td (OFFICIAL CERTIFICATE OF ACTIVITY POINTS) Tj ET');
    ops.push('BT /F1 12 Tf 0.39 0.42 0.53 rg 278 424 Td (This is to officially certify that the RVCE student) Tj ET');

    // Student Name & USN
    ops.push(`BT /F2 24 Tf 0.788 0.094 0.357 rg 255 390 Td (${pdfEscape(studentName)}) Tj ET`);
    ops.push('0.83 0.68 0.21 RG 1.2 w 210 382 m 632 382 l S');
    ops.push(`BT /F1 11 Tf 0.106 0.122 0.294 rg 165 362 Td (USN: ${pdfEscape(usn)}   |   Email: ${pdfEscape(email)}   |   ${pdfEscape(dept)}) Tj ET`);

    // Total Activity Points Highlight Box
    ops.push('0.99 0.95 0.97 rg 0.788 0.094 0.357 RG 1.5 w');
    ops.push('240 304 362 44 re B');
    ops.push(`BT /F2 16 Tf 0.106 0.122 0.294 rg 275 320 Td (TOTAL ACCUMULATED ACTIVITY POINTS: ${totalPoints} AP) Tj ET`);

    // Verified Events Table Header
    let y = 278;
    ops.push('0.94 0.95 0.98 rg 64 268 714 22 re f');
    ops.push('BT /F2 10 Tf 0.106 0.122 0.294 rg 74 275 Td (EVENT NAME) Tj ET');
    ops.push('BT /F2 10 Tf 0.106 0.122 0.294 rg 360 275 Td (EVENT DATE) Tj ET');
    ops.push('BT /F2 10 Tf 0.106 0.122 0.294 rg 495 275 Td (STATUS) Tj ET');
    ops.push('BT /F2 10 Tf 0.106 0.122 0.294 rg 675 275 Td (POINTS EARNED) Tj ET');

    y = 250;
    const rowsToPrint = earnedRows.slice(0, 6);
    if (rowsToPrint.length === 0) {
        ops.push('BT /F1 10 Tf 0.4 0.43 0.52 rg 74 248 Td (No verified event attendance recorded yet.) Tj ET');
    } else {
        for (const r of rowsToPrint) {
            ops.push(`BT /F1 10 Tf 0.12 0.14 0.28 rg 74 ${y} Td (${pdfEscape(r.title.slice(0, 44))}) Tj ET`);
            ops.push(`BT /F1 10 Tf 0.35 0.38 0.48 rg 360 ${y} Td (${pdfEscape(r.event_date)}) Tj ET`);
            ops.push(`BT /F2 10 Tf 0.02 0.59 0.41 rg 495 ${y} Td (VERIFIED PRESENT) Tj ET`);
            ops.push(`BT /F2 10 Tf 0.788 0.094 0.357 rg 692 ${y} Td (+${r.points_awarded} AP) Tj ET`);
            ops.push(`0.90 0.91 0.95 RG 0.6 w 64 ${y - 6} m 778 ${y - 6} l S`);
            y -= 22;
        }
    }

    // Footer Signature Section: Left = Dean RVCE with handwritten vector signature, Right = Rotaract President
    // Vector handwritten signature for Dean
    ops.push('0.106 0.122 0.294 RG 2 w');
    ops.push('95 92 m 108 112 118 114 116 94 c 115 86 132 108 142 100 c 150 94 152 88 166 102 c 176 112 186 92 206 96 c S');
    ops.push('0.788 0.094 0.357 RG 1 w 92 86 m 228 88 l S');

    // Signature baselines
    ops.push('0.45 0.48 0.58 RG 1 w');
    ops.push('74 78 m 274 78 l S');
    ops.push('568 78 m 768 78 l S');

    ops.push(`BT /F2 10 Tf 0.106 0.122 0.294 rg 74 63 Td (Signature of Dean, RVCE) Tj ET`);
    ops.push(`BT /F1 9 Tf 0.39 0.42 0.53 rg 74 49 Td (${pdfEscape(signatories?.dean || 'Dean & Principal, RVCE')}) Tj ET`);

    ops.push(`BT /F1 9 Tf 0.39 0.42 0.53 rg 358 63 Td (Issued on: ${pdfEscape(issueDate)}) Tj ET`);
    ops.push('BT /F1 8 Tf 0.5 0.53 0.62 rg 334 49 Td (Verified via Rotaract RVCE DBMS Portal) Tj ET');

    ops.push(`BT /F2 10 Tf 0.106 0.122 0.294 rg 568 63 Td (President, Rotaract Club of RVCE) Tj ET`);
    ops.push(`BT /F1 9 Tf 0.39 0.42 0.53 rg 568 49 Td (${pdfEscape(signatories?.president || 'Rtr. Pavana (President)')}) Tj ET`);

    const contentStream = ops.join('\n');

    // Assemble PDF objects with exact byte offsets
    const objects = [
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
        `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n`,
        '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
        '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
        `6 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (const obj of objects) {
        offsets.push(pdf.length);
        pdf += obj;
    }

    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i < offsets.length; i++) {
        pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    const blob = new Blob([pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rotaract_RVCE_Activity_Points_${usn}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
