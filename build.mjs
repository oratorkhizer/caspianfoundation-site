import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const root = dirname(new URL(import.meta.url).pathname);
const out = join(root, 'public');

/* ---------------------------------------------------------------------------
   Photographs.
   The originals live in the Diabesity Expo repository, pinned to one commit so
   the pictures cannot change under us. They are fetched and re-encoded to WebP
   at display size during the build, which keeps this repository free of large
   binaries. If the fetch fails the build fails, and Vercel keeps the previous
   deployment live rather than publishing a site with broken images.
--------------------------------------------------------------------------- */
const PHOTO_BASE =
  'https://raw.githubusercontent.com/oratorkhizer/diabesityexpo-site/49538967c4b94b52062cdc152e21efae3a660617/assets/gallery/';
const PHOTOS = [
  { src: 'g1.jpg', out: 'expo-screening.webp', width: 1000, quality: 66 },
  { src: 'g2.jpg', out: 'expo-stalls.webp', width: 720, quality: 60 },
  { src: 'g3.jpg', out: 'expo-hall.webp', width: 720, quality: 60 },
  { src: 'g4.jpg', out: 'expo-talk.webp', width: 720, quality: 60 },
  { src: 'g5.jpg', out: 'expo-cpr.webp', width: 720, quality: 60 },
  { src: 'g6.jpg', out: 'expo-audience.webp', width: 1000, quality: 66 },
  { src: 'g7.jpg', out: 'expo-booklaunch.webp', width: 720, quality: 60 },
  { src: 'g8.jpg', out: 'expo-community.webp', width: 720, quality: 60 }
];

async function buildPhotos() {
  const dir = join(out, 'img');
  mkdirSync(dir, { recursive: true });
  const local = join(root, 'img');
  if (existsSync(local) && readdirSync(local).length >= PHOTOS.length) {
    cpSync(local, dir, { recursive: true });
    console.log('photos: used the copies committed in this repository');
    return;
  }
  const { default: sharp } = await import('sharp');
  for (const p of PHOTOS) {
    const r = await fetch(PHOTO_BASE + p.src);
    if (!r.ok) throw new Error('could not fetch photo ' + p.src + ': HTTP ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    await sharp(buf).resize({ width: p.width }).webp({ quality: p.quality, effort: 5 }).toFile(join(dir, p.out));
  }
  console.log('photos: fetched and re-encoded ' + PHOTOS.length + ' images');
}

/* ---------------------------------------------------------------------------
   Brand images.
   The logo is the official Caspian Healthcare Foundation artwork, taken from the
   course repository so there is one master copy. The social card and the touch
   icon are composed from it at build time, using shapes only and no text, so the
   build never depends on a font being present.
--------------------------------------------------------------------------- */
const LOGO_URL =
  'https://raw.githubusercontent.com/oratorkhizer/caspianobesity-site/main/chf-logo.png';

async function buildBrandImages() {
  const { default: sharp } = await import('sharp');
  const localLogo = join(root, 'chf-logo.png');
  let logo;
  if (existsSync(localLogo)) {
    logo = readFileSync(localLogo);
  } else {
    const r = await fetch(LOGO_URL);
    if (!r.ok) throw new Error('could not fetch the Foundation logo: HTTP ' + r.status);
    logo = Buffer.from(await r.arrayBuffer());
  }
  writeFileSync(join(out, 'chf-logo.png'), await sharp(logo).resize({ width: 349 }).png({ palette: true, quality: 90 }).toBuffer());

  // Social card: a photograph from the expo, veiled in navy, with the logo on a white card.
  const photo = join(out, 'img', 'expo-hall.webp');
  const base = existsSync(photo)
    ? sharp(photo).resize(1200, 630, { fit: 'cover', position: 'centre' })
    : sharp({ create: { width: 1200, height: 630, channels: 3, background: '#0e2643' } });
  const veil = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">' +
      '<rect width="1200" height="630" fill="#0e2643" opacity="0.82"/>' +
      '<rect x="0" y="618" width="1200" height="12" fill="#c9a227"/>' +
      '<rect x="300" y="196" width="600" height="238" rx="22" fill="#ffffff"/>' +
      '</svg>'
  );
  const cardLogo = await sharp(logo).resize({ width: 470 }).toBuffer();
  const meta = await sharp(cardLogo).metadata();
  await base
    .composite([
      { input: veil, top: 0, left: 0 },
      { input: cardLogo, top: 196 + Math.round((238 - meta.height) / 2), left: 300 + Math.round((600 - 470) / 2) }
    ])
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toFile(join(out, 'og-image.jpg'));

  // Touch icon: the logo on the navy ground.
  const iconLogo = await sharp(logo).resize({ width: 146 }).toBuffer();
  const im = await sharp(iconLogo).metadata();
  await sharp({ create: { width: 180, height: 180, channels: 3, background: '#0e2643' } })
    .composite([{ input: iconLogo, top: Math.round((180 - im.height) / 2), left: 17 }])
    .png()
    .toFile(join(out, 'apple-touch-icon.png'));
  console.log('brand images: logo, social card and touch icon composed');
}

/* --------------------------------------------------------------------------- */

const layout = readFileSync(join(root, 'layout.html'), 'utf8');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const navKeys = ['about', 'programmes', 'transparency', 'partner', 'contact'];
const files = readdirSync(join(root, 'pages')).filter((f) => f.endsWith('.html'));

for (const f of files) {
  const raw = readFileSync(join(root, 'pages', f), 'utf8');
  const m = raw.match(/^<!--meta([\s\S]*?)-->\s*/);
  if (!m) throw new Error('missing meta block in ' + f);
  const meta = JSON.parse(m[1]);
  const body = raw.slice(m[0].length);
  const slug = f.replace(/\.html$/, '');
  const canonical = slug === 'index' ? '/' : '/' + slug;
  let html = layout
    .replaceAll('{{title}}', meta.title)
    .replaceAll('{{ogtitle}}', meta.ogtitle || meta.title)
    .replaceAll('{{description}}', meta.description)
    .replaceAll('{{canonical}}', canonical)
    .replace('{{head}}', meta.head || '')
    .replace('{{foot}}', meta.foot || '')
    .replace('{{body}}', body);
  for (const k of navKeys) {
    html = html.replace('{{nav-' + k + '}}', meta.nav === k ? ' aria-current="page"' : '');
  }
  const leftover = html.match(/\{\{[a-z-]+\}\}/);
  if (leftover) throw new Error('unreplaced token in ' + f + ': ' + leftover[0]);
  if (html.includes('\u2014')) throw new Error('em dash found in ' + f);
  writeFileSync(join(out, f), html);
}

for (const asset of ['assets', 'favicon.svg', 'site.webmanifest', 'robots.txt', 'sitemap.xml', 'llms.txt']) {
  cpSync(join(root, asset), join(out, asset), { recursive: true });
}

// The approval orders are optional: drop the PDFs into docs/ and they are published
// and the download block on the transparency page reveals itself.
if (existsSync(join(root, 'docs'))) {
  cpSync(join(root, 'docs'), join(out, 'docs'), { recursive: true });
  console.log('docs: published ' + readdirSync(join(root, 'docs')).length + ' file(s)');
}

await buildPhotos();
await buildBrandImages();
console.log('built ' + files.length + ' pages');
