const fs = require('fs');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#6B0404"/>
  <rect width="98" height="98" x="1" y="1" rx="21" fill="none" stroke="#A01515" stroke-width="2"/>
  <defs>
    <clipPath id="top"><rect x="0" y="0" width="100" height="49"/></clipPath>
    <clipPath id="bot"><rect x="0" y="49" width="100" height="51"/></clipPath>
  </defs>
  <path d="M 82 32 C 76 18 63 12 48 12 C 25 12 10 28 10 50 C 10 72 25 88 48 88 C 72 88 85 70 85 50 L 48 50 L 48 66 L 68 66 C 66 74 58 76 48 76 C 33 76 25 65 25 50 C 25 35 33 24 48 24 C 58 24 67 29 72 36 Z" fill="#FFFFFF" clip-path="url(#top)"/>
  <path d="M 82 32 C 76 18 63 12 48 12 C 25 12 10 28 10 50 C 10 72 25 88 48 88 C 72 88 85 70 85 50 L 48 50 L 48 66 L 68 66 C 66 74 58 76 48 76 C 33 76 25 65 25 50 C 25 35 33 24 48 24 C 58 24 67 29 72 36 Z" fill="#FF8500" clip-path="url(#bot)"/>
</svg>`;

fs.writeFileSync('public/favicon.svg', svg);
fs.writeFileSync('public/logo.svg', svg);
console.log('SVG favicons generated successfully.');
