// Read the wordpress.org session cookie (wporg_logged_in + wporg_sec) straight
// from a browser's on-disk cookie store, so the user doesn't have to dig through
// DevTools. macOS only for now. Zero-dep: the system `sqlite3` CLI, the macOS
// `security` CLI (Keychain), Node's built-in crypto, and a small binarycookies
// parser for Safari. The cookie value is returned to the caller (which saves it
// to the owner-only cookie file) and never printed.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, copyFileSync, unlinkSync, readdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { pbkdf2Sync, createDecipheriv } from 'node:crypto';

const HOME = homedir();
const NEED = ['wporg_logged_in', 'wporg_sec'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const SUPPORTED_BROWSERS = ['chrome', 'edge', 'firefox', 'safari'];

// Returns "wporg_logged_in=…; wporg_sec=…" for the given browser, or throws a
// message safe to show the user. Never logs the value.
export function importWporgCookie(browser) {
  if (process.platform !== 'darwin') {
    throw new Error('Cookie import currently supports macOS only. Paste the cookie manually instead.');
  }
  const b = String(browser || '').toLowerCase();
  let found;
  if (b === 'firefox') found = fromFirefox();
  else if (b === 'safari') found = fromSafari();
  else if (b === 'chrome' || b === 'edge') found = fromChromium(b);
  else throw new Error(`Unknown browser "${browser}". Use one of: ${SUPPORTED_BROWSERS.join(', ')}.`);

  const have = NEED.filter((n) => found[n]);
  if (!have.length) {
    throw new Error(`No wordpress.org login cookie found in ${cap(b)}. Log in to wordpress.org in ${cap(b)} first, then try again.`);
  }
  return have.map((n) => `${n}=${found[n]}`).join('; ');
}

// --- sqlite (Chrome/Edge/Firefox stores are SQLite) -------------------------
// Copy the DB (browsers keep it locked/WAL) to a temp file, then read it with
// the system sqlite3 in read-only mode. Columns joined by US (0x1f) since cookie
// values themselves contain '|' and '%'.
function sqliteRows(db, sql) {
  const stamp = `${process.pid}-${Date.now()}`;
  const tmp = join(tmpdir(), `uwp-cookies-${stamp}.db`);
  const copied = [];
  for (const suf of ['', '-wal', '-shm']) {
    if (existsSync(db + suf)) { copyFileSync(db + suf, tmp + suf); copied.push(tmp + suf); }
  }
  try {
    const out = execFileSync('sqlite3', ['-readonly', '-separator', '\x1f', tmp, sql], { encoding: 'utf8' });
    return out.split('\n').filter(Boolean).map((line) => line.split('\x1f'));
  } catch (err) {
    if (/not found|ENOENT/i.test(err.message)) throw new Error('The `sqlite3` command is not available on this machine.');
    throw new Error('Could not read the cookie database.');
  } finally {
    for (const f of copied) { try { unlinkSync(f); } catch { /* ignore */ } }
  }
}

// --- Firefox (plaintext values) ---------------------------------------------
function fromFirefox() {
  const root = join(HOME, 'Library/Application Support/Firefox/Profiles');
  if (!existsSync(root)) throw new Error('Firefox profile folder not found.');
  const dbs = readdirSync(root)
    .map((p) => join(root, p, 'cookies.sqlite'))
    .filter((p) => existsSync(p));
  if (!dbs.length) throw new Error('No Firefox cookies database found.');
  const out = {};
  for (const db of dbs) {
    const rows = sqliteRows(db,
      "SELECT name, value FROM moz_cookies WHERE host LIKE '%wordpress.org%' AND name IN ('wporg_logged_in','wporg_sec')");
    for (const [name, value] of rows) if (name && !out[name]) out[name] = value;
  }
  return out;
}

// --- Chromium (Chrome / Edge): AES-128-CBC, key from the macOS Keychain ------
function fromChromium(which) {
  // Chrome / Edge can live under a few different install folders, and users have
  // arbitrary profile names - so scan every profile dir that holds a Cookies db.
  const roots = which === 'edge'
    ? ['Library/Application Support/Microsoft Edge']
    : ['Library/Application Support/Google/Chrome', 'Library/Application Support/Chromium'];
  const dbs = [];
  for (const rel of roots) {
    const base = join(HOME, rel);
    if (!existsSync(base)) continue;
    let entries = [];
    try { entries = readdirSync(base); } catch { /* unreadable */ }
    for (const name of entries) {
      for (const sub of ['Network/Cookies', 'Cookies']) {
        const p = join(base, name, sub);
        if (existsSync(p)) dbs.push(p);
      }
    }
  }
  if (!dbs.length) throw new Error(`${cap(which)} cookies database not found. Is ${cap(which)} installed and have you opened it at least once?`);

  const service = which === 'edge' ? 'Microsoft Edge Safe Storage' : 'Chrome Safe Storage';
  const account = which === 'edge' ? 'Microsoft Edge' : 'Chrome';
  let pw;
  try {
    pw = execFileSync('security', ['find-generic-password', '-w', '-s', service, '-a', account], { encoding: 'utf8' }).trim();
  } catch {
    throw new Error(`Could not read the ${cap(which)} encryption key from the Keychain (access denied - approve the prompt, or the key is missing).`);
  }
  const key = pbkdf2Sync(pw, 'saltysalt', 1003, 16, 'sha1');

  const out = {};
  for (const db of dbs) {
    const rows = sqliteRows(db,
      "SELECT name, hex(encrypted_value) FROM cookies WHERE host_key LIKE '%wordpress.org%' AND name IN ('wporg_logged_in','wporg_sec')");
    for (const [name, hex] of rows) {
      if (!name || out[name] || !hex) continue;
      try { out[name] = decryptChromium(Buffer.from(hex, 'hex'), key); } catch { /* skip undecryptable */ }
    }
  }
  return out;
}

function decryptChromium(buf, key) {
  const version = buf.slice(0, 3).toString('latin1');
  if (version !== 'v10' && version !== 'v11') return buf.toString('utf8'); // stored unencrypted
  const iv = Buffer.alloc(16, ' ');
  const decipher = createDecipheriv('aes-128-cbc', key, iv);
  decipher.setAutoPadding(false);
  let dec = Buffer.concat([decipher.update(buf.slice(3)), decipher.final()]);
  const pad = dec[dec.length - 1];
  if (pad > 0 && pad <= 16) dec = dec.slice(0, dec.length - pad);
  // Recent Chrome prepends a 32-byte SHA-256 of the host to the plaintext.
  // wporg values are printable ASCII, so pick whichever form is clean.
  const printable = (b) => /^[\x20-\x7e]+$/.test(b.toString('latin1'));
  if (printable(dec)) return dec.toString('utf8');
  if (dec.length > 32 && printable(dec.slice(32))) return dec.slice(32).toString('utf8');
  return dec.toString('utf8');
}

// --- Safari (Cookies.binarycookies, custom binary format) -------------------
function fromSafari() {
  const files = [
    join(HOME, 'Library/Containers/com.apple.Safari/Data/Library/Cookies/Cookies.binarycookies'),
    join(HOME, 'Library/Cookies/Cookies.binarycookies'),
  ];
  const file = files.find((p) => existsSync(p));
  if (!file) throw new Error('Safari cookies file not found.');
  let buf;
  try { buf = readFileSync(file); }
  catch { throw new Error('Cannot read the Safari cookies file - grant your terminal Full Disk Access (System Settings → Privacy).'); }
  if (buf.slice(0, 4).toString('latin1') !== 'cook') throw new Error('Unexpected Safari cookies format.');

  const pageCount = buf.readUInt32BE(4);
  const sizes = [];
  let off = 8;
  for (let i = 0; i < pageCount; i++) { sizes.push(buf.readUInt32BE(off)); off += 4; }
  const out = {};
  let pageStart = off;
  for (let i = 0; i < pageCount; i++) {
    parseSafariPage(buf, pageStart, out);
    pageStart += sizes[i];
  }
  return out;
}

function parseSafariPage(buf, start, out) {
  let p = start + 4; // skip page header (0x00000100)
  const num = buf.readUInt32LE(p); p += 4;
  const offsets = [];
  for (let i = 0; i < num; i++) { offsets.push(buf.readUInt32LE(p)); p += 4; }
  for (const rel of offsets) {
    const c = start + rel;
    const urlOff = buf.readUInt32LE(c + 16);
    const nameOff = buf.readUInt32LE(c + 20);
    const valueOff = buf.readUInt32LE(c + 28);
    const url = cString(buf, c + urlOff);
    const name = cString(buf, c + nameOff);
    if (/wordpress\.org/i.test(url) && (name === 'wporg_logged_in' || name === 'wporg_sec') && !out[name]) {
      out[name] = cString(buf, c + valueOff);
    }
  }
}

function cString(buf, p) {
  let e = p;
  while (e < buf.length && buf[e] !== 0) e++;
  return buf.slice(p, e).toString('utf8');
}
