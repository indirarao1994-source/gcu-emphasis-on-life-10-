const fs = require('fs');
const sharp = require('sharp');

// Create the GCU Official Emblem SVG matching the uploaded user artwork
const svgLogo = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <!-- Gold Metallic Gradients -->
    <linearGradient id="goldRing" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFE985"/>
      <stop offset="30%" stop-color="#D4AF37"/>
      <stop offset="70%" stop-color="#AA7C11"/>
      <stop offset="100%" stop-color="#FFF3A8"/>
    </linearGradient>
    <linearGradient id="goldInnerBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF1A4"/>
      <stop offset="50%" stop-color="#D4AF37"/>
      <stop offset="100%" stop-color="#8A630A"/>
    </linearGradient>
    <radialGradient id="redBg" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FF3838"/>
      <stop offset="70%" stop-color="#C81010"/>
      <stop offset="100%" stop-color="#700000"/>
    </radialGradient>
    <linearGradient id="orangeG" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FF522B"/>
      <stop offset="50%" stop-color="#FF8A00"/>
      <stop offset="100%" stop-color="#FFA800"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Outer Dark Background for contrast -->
  <rect width="512" height="512" rx="256" fill="#400000" />

  <!-- Outer Gold Ring Frame -->
  <circle cx="256" cy="256" r="240" fill="url(#goldRing)" filter="url(#shadow)"/>
  <circle cx="256" cy="256" r="208" fill="#580000" />
  <circle cx="256" cy="256" r="200" fill="url(#redBg)" />

  <!-- Subtle Top Gloss Effect -->
  <path d="M 60 256 A 196 196 0 0 1 452 256 A 196 110 0 0 0 60 256 Z" fill="#FFFFFF" opacity="0.12" />

  <!-- 3 Students Figures (Simplified Cartoon Vector Silhouette) -->
  <g transform="translate(145, 30)">
    <!-- Student 1 (Left - Pink shirt) -->
    <circle cx="50" cy="45" r="14" fill="#FFCBB3"/> <!-- Face -->
    <path d="M 38 35 Q 50 25 62 35 Q 50 30 38 35 Z" fill="#222"/> <!-- Hair -->
    <path d="M 32 58 L 68 58 L 60 95 L 40 95 Z" fill="#FF6B9D"/> <!-- Top -->
    <path d="M 22 62 L 35 58" stroke="#FF6B9D" stroke-width="8" stroke-linecap="round"/>
    <path d="M 38 95 L 36 120 M 60 95 L 68 118" stroke="#333" stroke-width="7" stroke-linecap="round"/>

    <!-- Student 2 (Center - Blue shirt, White skirt, Hands up) -->
    <circle cx="110" cy="35" r="15" fill="#FFCBB3"/> <!-- Face -->
    <path d="M 96 25 Q 110 15 124 25 M 95 30 A 15 15 0 0 1 125 30" fill="#4A2511"/> <!-- Hair -->
    <path d="M 92 48 L 128 48 L 122 80 L 98 80 Z" fill="#1E88E5"/> <!-- Top -->
    <path d="M 92 50 L 75 30 M 128 50 L 145 30" stroke="#1E88E5" stroke-width="8" stroke-linecap="round"/> <!-- Arms Up -->
    <path d="M 95 80 L 125 80 L 132 102 L 88 102 Z" fill="#FFFFFF"/> <!-- Skirt -->
    <path d="M 100 102 L 98 125 M 120 102 L 124 125" stroke="#FFCBB3" stroke-width="7" stroke-linecap="round"/>

    <!-- Student 3 (Right - Yellow shirt, Blue pants) -->
    <circle cx="170" cy="48" r="14" fill="#FFCBB3"/> <!-- Face -->
    <path d="M 155 38 Q 170 30 185 38" stroke="#222" stroke-width="6"/> <!-- Headband -->
    <path d="M 152 60 L 188 60 L 182 92 L 158 92 Z" fill="#FFC107"/> <!-- Top -->
    <path d="M 188 62 L 205 48" stroke="#FFC107" stroke-width="8" stroke-linecap="round"/>
    <path d="M 158 92 L 150 125 M 182 92 L 192 122" stroke="#2979FF" stroke-width="9" stroke-linecap="round"/>
  </g>

  <!-- Central Gold Square Frame -->
  <rect x="171" y="146" width="170" height="170" fill="url(#goldInnerBorder)" rx="6" />
  <rect x="183" y="158" width="146" height="146" fill="#420608" rx="4" />

  <!-- Bold GCU Orange/Yellow 'G' Logo -->
  <path d="M 288 190 
           C 275 178, 255 174, 238 182 
           C 212 194, 204 220, 204 246 
           C 204 274, 214 298, 240 306 
           C 264 314, 288 298, 288 274 
           L 242 274 L 242 250 L 312 250 
           L 312 276 
           C 312 312, 276 332, 238 326 
           C 192 318, 172 278, 172 238 
           C 172 190, 204 150, 254 150 
           C 280 150, 306 162, 320 180 Z" 
        fill="url(#orangeG)" filter="url(#shadow)"/>

  <!-- Curved Text "Emphasis on Life" -->
  <path id="textArc" d="M 100 370 A 175 175 0 0 0 412 370" fill="none" />
  <text font-family="Georgia, serif, sans-serif" font-size="34" font-weight="900" fill="#FFE57F" letter-spacing="1">
    <textPath href="#textArc" startOffset="50%" text-anchor="middle">
      Emphasis on Life
    </textPath>
  </text>
</svg>`;

async function generateAllLogos() {
  fs.writeFileSync('public/gculogo.svg', svgLogo);
  fs.writeFileSync('public/favicon.svg', svgLogo);
  fs.writeFileSync('public/logo.svg', svgLogo);

  const buffer = Buffer.from(svgLogo);

  await sharp(buffer).resize(512, 512).toFile('public/pwa-512.png');
  await sharp(buffer).resize(192, 192).toFile('public/pwa-192.png');
  await sharp(buffer).resize(180, 180).toFile('public/apple-touch-icon.png');
  await sharp(buffer).resize(128, 128).toFile('public/favicon.png');
  await sharp(buffer).resize(256, 256).toFile('public/logo.png');
  await sharp(buffer).resize(256, 256).toFile('public/gculogo.png');
  await sharp(buffer).resize(256, 256).toFormat('webp').toFile('public/gculogo.webp');

  // Also copy to dist if dist exists
  if (fs.existsSync('dist')) {
    await sharp(buffer).resize(128, 128).toFile('dist/favicon.png');
    await sharp(buffer).resize(256, 256).toFile('dist/gculogo.png');
  }

  console.log('✅ GCU Official Emblem & Favicons successfully generated!');
}

generateAllLogos().catch(err => {
  console.error('Error generating logos:', err);
  process.exit(1);
});
