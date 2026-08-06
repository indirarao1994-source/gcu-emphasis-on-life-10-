const fs = require('fs');
const sharp = require('sharp');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#EAEAEA" />
  <rect x="7" y="7" width="86" height="86" fill="#6A0303" />
  <defs>
    <clipPath id="top-half">
      <rect x="0" y="0" width="100" height="50"/>
    </clipPath>
    <clipPath id="bot-half">
      <rect x="0" y="50" width="100" height="50"/>
    </clipPath>
  </defs>
  <path d="M 78 35 C 72 21 60 17 48 17 C 28 17 16 31 16 50 C 16 69 28 83 48 83 C 69 83 79 68 79 50 L 48 50 L 48 64 L 65 64 C 63 72 56 74 48 74 C 34 74 27 63 27 50 C 27 37 34 26 48 26 C 57 26 64 30 68 37 Z" fill="#FFFFFF" clip-path="url(#top-half)" />
  <path d="M 78 35 C 72 21 60 17 48 17 C 28 17 16 31 16 50 C 16 69 28 83 48 83 C 69 83 79 68 79 50 L 48 50 L 48 64 L 65 64 C 63 72 56 74 48 74 C 34 74 27 63 27 50 C 27 37 34 26 48 26 C 57 26 64 30 68 37 Z" fill="#FF8500" clip-path="url(#bot-half)" />
</svg>`;

async function main() {
  fs.writeFileSync('public/favicon.svg', svg);
  fs.writeFileSync('public/logo.svg', svg);

  const buffer = Buffer.from(svg);

  await sharp(buffer).resize(512, 512).toFile('public/pwa-512.png');
  await sharp(buffer).resize(192, 192).toFile('public/pwa-192.png');
  await sharp(buffer).resize(180, 180).toFile('public/apple-touch-icon.png');
  await sharp(buffer).resize(128, 128).toFile('public/favicon.png');
  await sharp(buffer).resize(256, 256).toFile('public/logo.png');
  await sharp(buffer).resize(256, 256).toFile('public/gculogo.png');
  await sharp(buffer).resize(256, 256).toFormat('webp').toFile('public/gculogo.webp');

  console.log('All icons generated successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
