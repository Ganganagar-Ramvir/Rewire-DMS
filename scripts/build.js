// Build step (runs on Vercel before deploy, or locally with `npm run build`).
// Replaces the Apps Script templating (<?!= include('X'); ?>, appUrl, getIcon192DataUri())
// in src/html/App.html and writes the finished single page to public/index.html.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src', 'html');
const OUT = path.join(__dirname, '..', 'public');
const missing = [];

function read(name) {
  const p = path.join(SRC, name + '.html');
  if (!fs.existsSync(p)) { missing.push(name + '.html'); return `<!-- ${name}.html is missing from src/html — add it and rebuild -->`; }
  return fs.readFileSync(p, 'utf8');
}

let html = read('App');
html = html.replace(/<\?!=\s*include\('([^']+)'\);?\s*\?>/g, (_, n) => read(n));
html = html
  .replace(/<\?!?=\s*appUrl\s*\?>/g, '/')
  .replace(/<\?!?=\s*getIcon192DataUri\(\)\s*\?>/g, '/icon.svg');

// load the Apps Script compatibility shim first, so google.script.run keeps working unchanged
html = html.replace(/<meta charset="UTF-8"\s*\/?>/i, m => m + '\n<script src="/gas-shim.js"></script>');

const left = html.match(/<\?[=!]?[^>]*\?>/g);
if (left) { console.warn('WARNING: unresolved Apps Script template tags:', Array.from(new Set(left))); }

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);

// login page: inject the same Supabase URL / anon key the app uses (read from JS-Core.html)
const core = read('JS-Core');
const url = (core.match(/SUPABASE_URL\s*=\s*'([^']+)'/) || [])[1] || '';
const anon = (core.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/) || [])[1] || '';
const domain = (core.match(/LOGIN_EMAIL_DOMAIN\s*=\s*'([^']+)'/) || [])[1] || '@rewiredms.app';
let login = fs.readFileSync(path.join(__dirname, '..', 'src', 'login.html'), 'utf8');
login = login.replace('{{SUPABASE_URL}}', url).replace('{{SUPABASE_ANON_KEY}}', anon).replace('{{LOGIN_EMAIL_DOMAIN}}', domain);
fs.writeFileSync(path.join(OUT, 'login.html'), login);

console.log(`Built public/index.html (${Math.round(html.length / 1024)} KB), public/login.html`);
if (missing.length) console.warn('NOTE — files not found in src/html (add them): ' + Array.from(new Set(missing)).join(', '));
