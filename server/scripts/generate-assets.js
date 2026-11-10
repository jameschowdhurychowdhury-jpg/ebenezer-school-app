'use strict';
/**
 * Generates all website icon buttons in storage/icons/ and illustrated profile
 * pictures in storage/All students pictures/<Class>/ and storage/teachers picture/.
 */
const fs = require('fs');
const path = require('path');
const { paths, CLASSES } = require('../config');

const ICONS = {
  'fees.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs>
      <linearGradient id="bag" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#2dd4bf"/><stop offset="100%" stop-color="#0d9488"/></linearGradient>
      <linearGradient id="coin" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fde047"/><stop offset="100%" stop-color="#f59e0b"/></linearGradient>
    </defs>
    <path d="M38 18c2 4 6 6 10 6s8-2 10-6l6 8-8 6H40l-8-6z" fill="#14b8a6"/>
    <path d="M28 58c0-16 10-26 20-26s20 10 20 26c0 14-8 22-20 22S28 72 28 58z" fill="url(#bag)"/>
    <text x="48" y="64" text-anchor="middle" font-family="Poppins,sans-serif" font-weight="700" font-size="24" fill="#fde047">$</text>
    <rect x="14" y="54" width="18" height="6" rx="2" fill="url(#coin)"/><rect x="14" y="62" width="18" height="6" rx="2" fill="url(#coin)"/><rect x="14" y="70" width="18" height="6" rx="2" fill="url(#coin)"/>
    <rect x="33" y="66" width="18" height="5" rx="2" fill="url(#coin)"/><rect x="33" y="72" width="18" height="5" rx="2" fill="url(#coin)"/>
    <circle cx="62" cy="72" r="9" fill="url(#coin)" stroke="#d97706" stroke-width="1.5"/>
    <text x="62" y="76" text-anchor="middle" font-family="Poppins,sans-serif" font-weight="700" font-size="11" fill="#92400e">$</text>
  </svg>`,

  'salary.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs>
      <linearGradient id="sbag" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#2dd4bf"/><stop offset="100%" stop-color="#0d9488"/></linearGradient>
      <linearGradient id="scoin" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fde047"/><stop offset="100%" stop-color="#f59e0b"/></linearGradient>
    </defs>
    <path d="M38 18c2 4 6 6 10 6s8-2 10-6l6 8-8 6H40l-8-6z" fill="#14b8a6"/>
    <path d="M28 58c0-16 10-26 20-26s20 10 20 26c0 14-8 22-20 22S28 72 28 58z" fill="url(#sbag)"/>
    <text x="48" y="64" text-anchor="middle" font-family="Poppins,sans-serif" font-weight="700" font-size="24" fill="#fde047">$</text>
    <rect x="14" y="54" width="18" height="6" rx="2" fill="url(#scoin)"/><rect x="14" y="62" width="18" height="6" rx="2" fill="url(#scoin)"/><rect x="14" y="70" width="18" height="6" rx="2" fill="url(#scoin)"/>
    <circle cx="64" cy="72" r="9" fill="url(#scoin)" stroke="#d97706" stroke-width="1.5"/>
  </svg>`,

  'result.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <rect x="18" y="16" width="48" height="64" rx="6" fill="#ffffff" stroke="#111827" stroke-width="3.5"/>
    <path d="M32 12h20a4 4 0 0 1 4 4v6H28v-6a4 4 0 0 1 4-4z" fill="#111827"/>
    <circle cx="42" cy="14" r="2.5" fill="#fff"/>
    <path d="M26 34l3 3 5-5M38 35h18M26 46l3 3 5-5M38 47h16M26 58l3 3 5-5M38 59h12M26 70h22" stroke="#111827" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="64" cy="54" r="17" fill="#111827"/>
    <path d="M56 54l6 6 11-12" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,

  'upload-result.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <rect x="18" y="16" width="48" height="64" rx="6" fill="#ffffff" stroke="#111827" stroke-width="3.5"/>
    <path d="M32 12h20a4 4 0 0 1 4 4v6H28v-6a4 4 0 0 1 4-4z" fill="#111827"/>
    <circle cx="42" cy="14" r="2.5" fill="#fff"/>
    <path d="M26 34l3 3 5-5M38 35h18M26 46l3 3 5-5M38 47h16M26 58l3 3 5-5M38 59h12" stroke="#111827" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="64" cy="56" r="17" fill="#111827"/>
    <path d="M56 56l6 6 11-12" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,

  'notes.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs>
      <linearGradient id="note" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fef08a"/><stop offset="100%" stop-color="#facc15"/></linearGradient>
    </defs>
    <path d="M16 16h64v48L64 80H16z" fill="url(#note)" stroke="#eab308" stroke-width="2"/>
    <path d="M64 80V64h16z" fill="#eab308"/>
    <circle cx="48" cy="22" r="6" fill="#16a34a"/>
    <circle cx="46" cy="20" r="2" fill="#86efac"/>
  </svg>`,

  'calendar.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <g transform="rotate(-6 44 52)">
      <rect x="14" y="26" width="56" height="50" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
      <path d="M14 34a8 8 0 0 1 8-8h40a8 8 0 0 1 8 8v8H14z" fill="#2563eb"/>
      <rect x="24" y="20" width="5" height="12" rx="2.5" fill="#94a3b8"/>
      <rect x="40" y="20" width="5" height="12" rx="2.5" fill="#94a3b8"/>
      <rect x="56" y="20" width="5" height="12" rx="2.5" fill="#94a3b8"/>
      <g fill="#2563eb">
        <rect x="22" y="48" width="8" height="6" rx="1.5"/><rect x="34" y="48" width="8" height="6" rx="1.5"/><rect x="46" y="48" width="8" height="6" rx="1.5"/><rect x="58" y="48" width="6" height="6" rx="1.5"/>
        <rect x="22" y="58" width="8" height="6" rx="1.5"/><rect x="46" y="58" width="8" height="6" rx="1.5"/><rect x="58" y="58" width="6" height="6" rx="1.5"/>
        <rect x="22" y="67" width="8" height="5" rx="1.5"/><rect x="34" y="67" width="8" height="5" rx="1.5"/><rect x="46" y="67" width="8" height="5" rx="1.5"/>
      </g>
      <polygon points="38,57 40,61 44,61 41,64 42,68 38,65 34,68 35,64 32,61 36,61" fill="#f59e0b"/>
    </g>
    <path d="M68 18c8 0 14 6 14 14v8l4 6H50l4-6v-8c0-8 6-14 14-14z" fill="#f59e0b" stroke="#b45309" stroke-width="1.5"/>
    <circle cx="68" cy="49" r="4" fill="#92400e"/>
  </svg>`,

  'notices.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <rect x="12" y="28" width="66" height="46" rx="6" fill="#f5c27a" stroke="#d99b4e" stroke-width="2"/>
    <path d="M14 72l26-22M76 72L50 50" stroke="#d99b4e" stroke-width="2.5"/>
    <path d="M12 30l33 26 33-26" fill="#f7cf94" stroke="#d99b4e" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="72" cy="28" r="13" fill="#dc2626"/>
    <rect x="70" y="19" width="4" height="11" rx="2" fill="#fff"/>
    <circle cx="72" cy="35" r="2.2" fill="#fff"/>
  </svg>`,

  'publish-notices.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <rect x="12" y="28" width="66" height="46" rx="6" fill="#f5c27a" stroke="#d99b4e" stroke-width="2"/>
    <path d="M14 72l26-22M76 72L50 50" stroke="#d99b4e" stroke-width="2.5"/>
    <path d="M12 30l33 26 33-26" fill="#f7cf94" stroke="#d99b4e" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="72" cy="28" r="13" fill="#dc2626"/>
    <path d="M72 20v12M66 26h12" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
  </svg>`,

  'school-group.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs>
      <linearGradient id="chatb" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#2563eb"/></linearGradient>
    </defs>
    <rect x="20" y="30" width="52" height="38" rx="10" fill="url(#chatb)"/>
    <polygon points="38,68 46,78 52,68" fill="#2563eb"/>
    <rect x="30" y="40" width="32" height="4" rx="2" fill="#fff"/>
    <rect x="30" y="48" width="26" height="4" rx="2" fill="#dbeafe"/>
    <rect x="30" y="56" width="18" height="4" rx="2" fill="#dbeafe"/>
    <rect x="52" y="14" width="26" height="16" rx="5" fill="#fde047" stroke="#eab308" stroke-width="1.5"/>
    <circle cx="59" cy="22" r="1.8" fill="#854d0e"/><circle cx="65" cy="22" r="1.8" fill="#854d0e"/><circle cx="71" cy="22" r="1.8" fill="#854d0e"/>
  </svg>`,

  'attendance.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <rect x="26" y="18" width="50" height="62" rx="4" fill="#f8fafc" stroke="#f97316" stroke-width="3"/>
    <path d="M34 32h34M34 40h34M34 48h34M34 56h34M34 64h24" stroke="#cbd5e1" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M34 14v8M42 14v8M50 14v8M58 14v8M66 14v8" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
    <g transform="rotate(-18 24 52)">
      <rect x="18" y="24" width="9" height="44" rx="2" fill="#facc15" stroke="#ca8a04" stroke-width="1.5"/>
      <rect x="18" y="20" width="9" height="7" rx="2" fill="#ec4899"/>
      <polygon points="18,68 27,68 22.5,78" fill="#fde68a"/>
      <polygon points="21,74 24,74 22.5,78" fill="#1e293b"/>
    </g>
  </svg>`,

  'add-teacher.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <circle cx="44" cy="32" r="16" fill="#0f2557"/>
    <path d="M16 78c3-18 15-28 28-28s25 10 28 28z" fill="#0f2557"/>
    <circle cx="70" cy="64" r="15" fill="#ea580c" stroke="#fff" stroke-width="3"/>
    <path d="M70 57v14M63 64h14" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
  </svg>`,

  'add-class-teacher.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <circle cx="44" cy="32" r="16" fill="#0f2557"/>
    <path d="M16 78c3-18 15-28 28-28s25 10 28 28z" fill="#0f2557"/>
    <circle cx="70" cy="64" r="15" fill="#16a34a" stroke="#fff" stroke-width="3"/>
    <path d="M70 57v14M63 64h14" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
  </svg>`,

  'add-student.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <circle cx="44" cy="32" r="16" fill="#0f2557"/>
    <path d="M16 78c3-18 15-28 28-28s25 10 28 28z" fill="#0f2557"/>
    <circle cx="70" cy="64" r="15" fill="#2563eb" stroke="#fff" stroke-width="3"/>
    <path d="M70 57v14M63 64h14" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
  </svg>`,

  'student-data.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <circle cx="48" cy="32" r="16" fill="#0f2557"/>
    <path d="M18 80c3-18 16-28 30-28s27 10 30 28z" fill="#0f2557"/>
  </svg>`,

  'teachers-data.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <circle cx="48" cy="32" r="16" fill="#0f2557"/>
    <path d="M18 80c3-18 16-28 30-28s27 10 30 28z" fill="#0f2557"/>
  </svg>`,

  'coming-soon.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
    <circle cx="80" cy="80" r="68" fill="#fff7ed" stroke="#fed7aa" stroke-width="4"/>
    <circle cx="80" cy="80" r="46" fill="#0f2557"/>
    <path d="M80 54v28l18 10" stroke="#fbbf24" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="80" cy="80" r="5" fill="#fbbf24"/>
  </svg>`,
};

function makeAvatarSvg(initials, bg, ring = '#f59e0b') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <rect width="120" height="120" rx="60" fill="${bg}"/>
    <circle cx="60" cy="44" r="20" fill="#ffffff" opacity="0.92"/>
    <path d="M22 108c5-22 20-34 38-34s33 12 38 34z" fill="#ffffff" opacity="0.92"/>
    <circle cx="60" cy="60" r="56" fill="none" stroke="${ring}" stroke-width="4"/>
    <rect x="34" y="82" width="52" height="22" rx="11" fill="${ring}"/>
    <text x="60" y="97" text-anchor="middle" font-family="Poppins,sans-serif" font-weight="700" font-size="13" fill="#0f2557">${initials}</text>
  </svg>`;
}

function generateAssets() {
  fs.mkdirSync(paths.icons, { recursive: true });
  for (const [name, svg] of Object.entries(ICONS)) {
    fs.writeFileSync(path.join(paths.icons, name), svg);
  }

  // Student photos inside storage/All students pictures/<Class>/<AdmissionNo>.svg
  const studentPics = [
    ['KG 1', '101', 'AD', '#1e3a8a'],
    ['KG 1', '102', 'RD', '#0f766e'],
    ['Class 5', '123', 'AS', '#1d4ed8'],
    ['Class 5', '546', 'RT', '#7c2d12'],
    ['Class 10', '879', 'PC', '#4338ca'],
    ['Class 10', '880', 'AR', '#065f46'],
    ['Class 12', '1201', 'SM', '#9d174d'],
    ['Class 12', '1202', 'KJ', '#1e40af'],
  ];
  for (const cls of CLASSES) {
    fs.mkdirSync(path.join(paths.studentPhotos, cls), { recursive: true });
  }
  for (const [cls, adm, init, bg] of studentPics) {
    fs.writeFileSync(path.join(paths.studentPhotos, cls, `${adm}.svg`), makeAvatarSvg(init, bg));
  }

  // Teacher & staff photos inside storage/teachers picture/<RegNo|role>.svg
  fs.mkdirSync(paths.teacherPhotos, { recursive: true });
  const teacherPics = [
    ['1', 'BD', '#0f2557'],
    ['2', 'MP', '#1e3a8a'],
    ['3', 'RS', '#0f766e'],
    ['4', 'SR', '#3730a3'],
    ['principal', 'EH', '#7c2d12'],
    ['administrative', 'JK', '#1f2937'],
  ];
  for (const [id, init, bg] of teacherPics) {
    fs.writeFileSync(path.join(paths.teacherPhotos, `${id}.svg`), makeAvatarSvg(init, bg));
  }
}

if (require.main === module) {
  generateAssets();
  console.log('✔ Generated all icons and profile pictures.');
}

module.exports = { generateAssets, makeAvatarSvg };
