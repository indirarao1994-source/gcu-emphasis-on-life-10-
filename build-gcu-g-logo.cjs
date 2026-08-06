const fs = require('fs');
const sharp = require('sharp');

// Exact GCU 'G' Logo Tile matching the user's uploaded image:
// Maroon background with white (top) and orange (bottom) letter 'G'
const svgGLogo = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="maroonBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#730000" />
      <stop offset="50%" stop-color="#540000" />
      <stop offset="100%" stop-color="#3D0000" />
    </linearGradient>
    
    <linearGradient id="orangeBar" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF7A00" />
      <stop offset="100%" stop-color="#FF5500" />
    </linearGradient>

    <filter id="subtleShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.5" />
    </filter>
  </defs>

  <!-- Dark Maroon Square Tile -->
  <rect width="512" height="512" rx="40" fill="url(#maroonBg)" />
  <!-- Subtle border inner highlight -->
  <rect x="8" y="8" width="496" height="496" rx="32" fill="none" stroke="#A31A1A" stroke-width="4" opacity="0.6" />

  <!-- Letter G Group -->
  <g filter="url(#subtleShadow)">
    <!-- Top Arc of 'G' (White) -->
    <!-- Arc from (86, 256) up through (256, 86) to (426, 256) -->
    <path d="
      M 86 256 
      A 170 170 0 0 1 426 256 
      L 346 256 
      A 90 90 0 0 0 166 256 
      Z
    " fill="#FFFFFF" />

    <!-- Bottom Arc & Horizontal Bar of 'G' (Orange) -->
    <!-- Arc from (86, 256) down to (426, 256), then bar inwards to center (256, 256) -->
    <path d="
      M 86 256 
      L 166 256 
      A 90 90 0 0 0 346 256 
      L 346 230 
      L 256 230 
      L 256 166 
      L 426 166 
      L 426 256 
      A 170 170 0 0 1 86 256 
      Z
    " fill="url(#orangeBar)" />
  </g>
</svg>`;

async function generateAllLogos() {
  fs.writeFileSync('public/gculogo.svg', svgGLogo);
  fs.writeFileSync('public/favicon.svg', svgGLogo);
  fs.writeFileSync('public/logo.svg', svgGLogo);

  const buffer = Buffer.from(svgGLogo);

  await sharp(buffer).resize(512, 512).toFile('public/pwa-512.png');
  await sharp(buffer).resize(192, 192).toFile('public/pwa-192.png');
  await sharp(buffer).resize(180, 180).toFile('public/apple-touch-icon.png');
  await sharp(buffer).resize(128, 128).toFile('public/favicon.png');
  await sharp(buffer).resize(256, 256).toFile('public/logo.png');
  await sharp(buffer).resize(256, 256).toFile('public/gculogo.png');
  await sharp(buffer).resize(256, 256).toFormat('webp').toFile('public/gculogo.webp');

  // Copy to dist if dist exists
  if (fs.existsSync('dist')) {
    await sharp(buffer).resize(128, 128).toFile('dist/favicon.png');
    await sharp(buffer).resize(256, 256).toFile('dist/gculogo.png');
    await sharp(buffer).resize(256, 256).toFormat('webp').toFile('dist/gculogo.webp');
  }

  console.log('✅ GCU "G" Logo and Favicons generated successfully!');
}

generateAllLogos().catch(err => {
  console.error('Error generating GCU G logo:', err);
  process.exit(1);
});
