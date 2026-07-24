import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generate } from './report.mjs';
import { toMarkdown, toPost, sourceUrls } from './format.mjs';
import { authenticated, tokenStatus, saveToken, checkToken } from './github.mjs';
import { fetchTicketDetails, resolveCookie, saveCookie, cookiePath, validateCookie } from './trac.mjs';
import { applyDeepDetails } from './aggregate.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const VENDOR = {
  css: readFileSync(join(DIR, 'vendor/flexidatepicker.min.css'), 'utf8'),
  js: readFileSync(join(DIR, 'vendor/flexidatepicker.umd.min.js'), 'utf8'),
};

export function startServer({ port = 4321 } = {}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(PAGE);
      return;
    }
    if (url.pathname === '/vendor/flexidatepicker.css') {
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'max-age=86400' });
      res.end(VENDOR.css);
      return;
    }
    if (url.pathname === '/vendor/flexidatepicker.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'max-age=86400' });
      res.end(VENDOR.js);
      return;
    }

    // Combined credential status for the setup wizard (never returns the values).
    if (url.pathname === '/api/config/status') {
      const c = resolveCookie();
      json(res, 200, {
        github: tokenStatus(),
        trac: {
          set: !!c,
          source: process.env.WPORG_TRAC_COOKIE ? 'env' : 'file',
          path: cookiePath(),
          envLocked: !!process.env.WPORG_TRAC_COOKIE,
        },
      });
      return;
    }

    if (url.pathname === '/api/github-token' && req.method === 'POST') {
      if (process.env.GITHUB_TOKEN) return json(res, 400, { error: 'GITHUB_TOKEN env is set and overrides the file — unset it to save one here.' });
      const value = (JSON.parse(await readBody(req) || '{}').token || '').trim();
      if (!value) return json(res, 400, { error: 'empty token' });
      json(res, 200, { ok: true, path: saveToken(value) });
      return;
    }

    if (url.pathname === '/api/github-token/test' && req.method === 'POST') {
      try {
        json(res, 200, await checkToken());
      } catch (err) {
        json(res, 200, { ok: false, message: err.message });
      }
      return;
    }

    if (url.pathname === '/api/cookie' && req.method === 'POST') {
      if (process.env.WPORG_TRAC_COOKIE) return json(res, 400, { error: 'WPORG_TRAC_COOKIE env is set and overrides the file — unset it to save one here.' });
      const value = (JSON.parse(await readBody(req) || '{}').cookie || '').trim();
      if (!value) return json(res, 400, { error: 'empty cookie' });
      json(res, 200, { ok: true, path: saveCookie(value) });
      return;
    }

    if (url.pathname === '/api/cookie/test' && req.method === 'POST') {
      const c = resolveCookie();
      if (!c) return json(res, 200, { ok: false, message: 'No cookie set yet.' });
      try {
        const ok = await validateCookie(c);
        json(res, 200, { ok, message: ok ? 'Cookie works — Trac reachable.' : 'Trac rejected it (expired or wrong cookie).' });
      } catch (err) {
        json(res, 200, { ok: false, message: err.message });
      }
      return;
    }

    if (url.pathname === '/api/report') {
      try {
        const q = url.searchParams;
        const { meta, report } = await generate({
          since: q.get('since'),
          until: q.get('until'),
          milestone: q.get('milestone') || null,
          gbBranch: q.get('gbBranch') || undefined,
          coreBranch: q.get('coreBranch') || undefined,
          labels: q.get('labels') !== 'false',
          devNotes: q.get('devNotes') !== 'false',
        });
        if (q.get('deep') === 'true') {
          const cookie = resolveCookie();
          if (!cookie) throw new Error('deep read needs a Trac cookie — add it in Setup first');
          applyDeepDetails(report, await fetchTicketDetails({ milestone: meta.milestone, cookie }));
        }
        json(res, 200, { meta, report, sources: sourceUrls(meta), markdown: toMarkdown(report, meta), post: toPost(report, meta) });
      } catch (err) {
        json(res, 400, { error: err.message });
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`uwp: port ${port} is already in use — try \`uwp serve --port ${port + 1}\`.`);
      process.exit(1);
    }
    throw err;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`uwp browser UI  ->  http://localhost:${port}`);
    if (!authenticated()) console.log('uwp: no gh token — GitHub API limited to 60 req/h (add one in Setup).');
    console.log('Press Ctrl+C to stop.');
  });
  return server;
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(data));
  });
}

// UnleashWP light-bulb mark (design system assets/brand/bulb-full.svg).
const BULB = `<svg class="bulb" viewBox="0 0 500 500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path fill="#203058" d="M360.46,93.68c3.61-.11,7.79,3.21,7.49,7.01-.22,2.84-14.57,19.75-17.42,20.26-5.68,1.02-9.36-4.27-7.59-9.35.8-2.28,14.92-17.84,17.51-17.92Z"/><path fill="#203058" d="M402.2,150.11c5.6-.12,9.52,5.63,6.46,10.57-.73,1.17-19.82,9.79-21.34,9.86-6.03.29-10.22-6.21-6.39-11.02.72-.91,20.11-9.39,21.27-9.41Z"/><path fill="#203058" d="M403.66,225.72c3.86.6,10.59.72,12.54,4.55,1.91,3.76-.85,9.42-5.03,9.67-1.57.09-20.35-2.04-21.47-2.49-4.69-1.86-5.09-9.76-.39-12.16,2.42-1.24,11.27-.05,14.36.42Z"/><path fill="#203058" d="M273.38,56.09c3.5.02,6.99,2.86,7.11,6.48.09,2.83-2.96,19.81-4.37,21.64-3.52,4.56-11.68,1.42-11.89-4.22-.07-1.89,2.45-17.74,3.11-19.51.71-1.9,3.98-4.4,6.05-4.39Z"/><path fill="#203058" d="M91.9,176.1c1.77.03,18.92,3.47,20.28,4.16,5.92,2.97,3.42,12.24-2.02,12.71-1.52.13-20.27-3.67-21.64-4.37-5.84-3.02-3.11-12.6,3.38-12.49Z"/><path fill="#203058" d="M178.89,68.04c1.63-.14,4.43.77,5.75,1.85.79.65,8.68,17.17,8.94,18.41,1.48,7.02-5.75,11.1-11.09,6.84-2.03-1.62-9.64-20.2-8.67-23.02.38-1.11,3.86-3.97,5.07-4.08Z"/><path fill="#203058" d="M118.55,122.65c.91.08,14.33,8.46,15.25,9.41,4.77,4.89.86,10.68-5.15,8.95-1.8-.52-15.33-10.42-15.54-12.01-.38-2.98,2.22-6.64,5.43-6.35Z"/><path fill="#5d687f" d="M263.12,417.38c-5.15,5.34-10.3,4.62-14.68,7.44l-61.72-9.82c-3.4-4.01-8.48-4.88-11.64-11.62-.64-1.36-3.06-8.09-1.2-8.57l93.48,14.88c.93.81-3.44,6.86-4.25,7.7Z"/><path fill="#373a50" d="M248.44,424.82c-1.61,1.03-4.61,5.45-6.71,7.07-17.36,13.42-38.02,10.8-50.44-7.56-1.52-2.25-3.43-8-4.56-9.33l61.72,9.82Z"/><path fill="#363950" d="M263.12,417.38c.81-.84,5.18-6.89,4.25-7.7l-93.48-14.88c-1.86.47.56,7.21,1.2,8.57-7.3-1.55-17.01-7.56-12.32-16.15.55-1.01,3.18-2.54,3.23-2.74.15-.62-3.33-6.4-1.3-12.3,1-2.9,6.08-6.02,6.15-6.47.09-.56-4.15-6.2-3.93-10.4.27-5.21,5.58-11.02,5.58-11.67,0-.28-2.63-3.52-2.98-4.66-3.51-11.38,2.83-21.63.14-33.01-1.88-7.96-20.54-27.57-26.11-37.66-46.73-84.68,23.58-180.87,116.86-171.48,110.18,11.1,153.1,146.01,61.09,212.59-6.33,4.58-18.73,9.91-22.81,16.15-6.57,10.04-3.11,21.93-10.79,32.71-.45.63-3.69,2.89-3.75,3.12-.11.4,2.5,5.69,2.47,7.84-.09,8.16-6.52,11.84-6.78,13.35-.08.47,3.3,6.1,3.24,8.89-.12,5.8-4.93,10.23-4.98,10.84-.02.23,1.95,2.69,2.15,4.06,1.31,9.41-9.9,11.68-17.11,11Z"/><path fill="#ffb33d" d="M249.63,350.1c-.03-1.44-.55-1.18.97-1.71,3.08-1.08,6.09-.57,9.73-2.64,10.18-5.8,9.74-17.78,13.43-27.41,5.85-15.25,19.95-20.21,30.97-30.9,59.22-57.43,37.53-151.34-41.67-175.3-6.05-1.83-13.74-2.06-18.93-5.34,100.28-3.24,158.9,113.74,83.21,184.7-12.46,11.68-34.59,19.27-40.46,34.97-2.48,6.63-2.83,27.27-11.17,27.77-1.68.1-24.93-3.52-26.09-4.15Z"/><path fill="#ffbe3d" d="M209.53,341.85c-.2.55.02,1.39-.52,1.78-1.28.51-25.98-3.74-27.23-4.33-6.52-3.08-1.87-18.56-1.57-23.75,1.07-18.7-7.42-23.33-17-36.44,3.46.46,8.69,3.62,11.9,5.62,20.73,12.88,16.34,18.54,15.81,39.51-.29,11.36,8.97,15.42,18.6,17.62Z"/><path fill="#ffd952" d="M244.14,106.81c5.19,3.28,12.88,3.51,18.93,5.34,79.19,23.95,100.89,117.87,41.67,175.3-11.02,10.69-25.13,15.65-30.97,30.9-3.69,9.63-3.26,21.61-13.43,27.41-3.64,2.07-6.64,1.56-9.73,2.64-1.52.53-1,.27-.97,1.71l-.87-.37c3.86-15.72,3.76-35.07,8.02-50.37,7.05-25.35,30.69-56.73,39.66-82.56,1.93-18.55-14.97-3.1-17.36-3.46-1.98-.3-2.89-7.86-6.94-9.01-6.18-1.76-10.13,6.84-12.26,6.89-3.3.08-3.57-13.42-12.84-9.95-1.63.61-5.64,5.99-6.53,5.94-8.61-18.52-13.86-2.9-17.24-2.74s-7.64-11.82-14.87-8.88c-3.41,1.38-3.51,5.45-3.45,8.52.48,26.61,13.51,63.58,12.29,89.43-.37,7.8-5.34,41.74-7.69,48.33-9.63-2.19-18.89-6.26-18.6-17.62.53-20.97,4.91-26.62-15.81-39.51-3.21-2-8.44-5.15-11.9-5.62-53.82-73.6-9.41-169.38,80.93-172.31Z"/><path fill="#ffffff" d="M219.07,128.41c7.33,0,12.24,6.37,8.82,13.27-1.83,3.7-15.51,8.14-20.13,10.99-15.64,9.65-26.8,25.78-32.66,42.96-1.99,5.84-1.58,18.66-10.63,18.55-19.51-.24-.6-39.62,4.6-47.89,7.68-12.24,35.11-37.89,50-37.87Z"/><path fill="#ffd951" d="M248.76,210.84c5.23,10.87,12.53,12.72,20.87,3.32,2.94,7.13,7.6,10.37,14.66,5.82l-33.67,69.79c-5.21-8.15-17.05-9.98-24.51-3.9-3.74-25.02-7.76-50.94-10.23-76.07,5.31,6.61,10.54,3.6,15.55-1.25,4.27,10.49,10.21,10.36,17.32,2.29Z"/><path fill="#ffc33e" d="M243.08,291.82l1.46,8.37-8.07,47.8c-5.98-.33-12.19-2.21-18.12-3.12l7.8-49.01c3.65-6.49,10.64-8.52,16.93-4.05Z"/><path fill="#768299" d="M177.57,371.66l93.48,14.88c5.84,4.36,3.41,12.53-3.22,14.38l-91.67-14.59c-5.86-3.73-5.6-12.46,1.4-14.67Z"/><path fill="#7c889f" d="M181.25,348.52l93.03,14.8c6.11,3.84,3.69,13.58-3.22,14.38l-91.21-14.52c-6.2-3.42-5.51-12.29,1.4-14.67Z"/></svg>`;

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Release Helper — UnleashWP</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/vendor/flexidatepicker.css">
<style>
  :root {
    --navy: #203159; --navy-deep: #0f131f; --yellow: #fcbe00; --ink: #292b2e;
    --slate: #727f9f; --slate-2: #35415b;
    --paper: #ffffff; --paper-alt: #f2f4f7; --paper-faded: #eceef5; --hairline: #e3e7f0;
    --bg: #eef1f6; --surface: #ffffff; --sunk: #f5f7fa; --border: #e3e7f0;
    --heading: var(--navy); --text: #2b3242; --muted: #6b7794;
    --primary: var(--navy); --accent: var(--yellow); --link: var(--navy);
    --tagbg: #eceef5; --tagfg: var(--navy); --good: #1a8f57; --bad: #c0392b;
    --shadow-sm: 0 1px 2px rgba(32,49,89,.06);
    --shadow: 0 6px 24px rgba(32,49,89,.09);
    --shadow-lg: 0 18px 48px rgba(32,49,89,.16);
    /* 4pt spacing scale */
    --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px; --s7: 48px; --s8: 64px;
    --r: 14px; --r-sm: 9px;
    --font: "Ubuntu", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --mrdp-primary-color: #203159; --mrdp-primary-light: #e7ebf5;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f1218; --surface: #171b24; --sunk: #1e232e; --border: #2a3040;
      --heading: #eaf0ff; --text: #dbe2ef; --muted: #94a1bd; --primary: #7c93ff; --link: #a9bcff;
      --tagbg: #232b40; --tagfg: #b9c7ff;
      --shadow-sm: 0 1px 2px rgba(0,0,0,.4); --shadow: 0 6px 24px rgba(0,0,0,.4); --shadow-lg: 0 18px 48px rgba(0,0,0,.55);
      --mrdp-primary-light: #26314d;
    }
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; font: 400 15px/1.6 var(--font); background: var(--bg); color: var(--text);
    -webkit-font-smoothing: antialiased; font-feature-settings: "kern" 1; }
  a { color: var(--link); text-decoration: none; }
  a:hover { color: var(--accent); }
  code { background: var(--tagbg); color: var(--tagfg); padding: 1px 6px; border-radius: 6px;
    font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
  .tnum { font-variant-numeric: tabular-nums; }

  /* ---- Header ---- */
  header { position: sticky; top: 0; z-index: 20; background: color-mix(in srgb, var(--surface) 88%, transparent);
    backdrop-filter: saturate(1.4) blur(10px); border-bottom: 1px solid var(--border); }
  .bar { max-width: 1120px; margin: 0 auto; padding: var(--s4) var(--s5); display: flex; align-items: center; gap: var(--s3); }
  .bulb { width: 36px; height: 36px; flex: none; filter: drop-shadow(0 3px 6px rgba(32,49,89,.22)); }
  .brand { display: flex; flex-direction: column; line-height: 1.05; }
  .brand b { font-size: 19px; font-weight: 700; color: var(--heading); letter-spacing: -.015em; }
  .brand span { font-size: 10.5px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); margin-top: 2px; }
  .pills { margin-left: auto; display: flex; gap: var(--s2); }
  .pill { display: inline-flex; align-items: center; gap: 7px; font: 500 12.5px/1 var(--font);
    background: var(--sunk); border: 1px solid var(--border); color: var(--text);
    padding: 8px 13px; border-radius: 999px; cursor: pointer; transition: border-color .15s, transform .1s; }
  .pill:hover { border-color: var(--primary); transform: translateY(-1px); }
  .pill .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); box-shadow: 0 0 0 3px transparent; }
  .pill.ok .dot { background: var(--good); box-shadow: 0 0 0 3px color-mix(in srgb, var(--good) 22%, transparent); }
  .pill.off .dot { background: var(--yellow); box-shadow: 0 0 0 3px color-mix(in srgb, var(--yellow) 22%, transparent); }

  main { max-width: 1120px; margin: 0 auto; padding: var(--s6) var(--s5) var(--s8); }

  /* ---- Hero ---- */
  .hero { margin: var(--s2) 0 var(--s6); }
  .hero h1 { font-size: clamp(30px, 4.4vw, 46px); line-height: 1.05; letter-spacing: -.025em;
    font-weight: 700; color: var(--heading); margin: 0 0 var(--s3); max-width: 20ch; }
  .hero h1 .hl { color: var(--yellow); }
  .hero p { font-size: 17px; color: var(--muted); margin: 0; max-width: 62ch; }

  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); box-shadow: var(--shadow); }

  /* ---- Setup wizard ---- */
  .wizard { display: none; padding: var(--s6); margin-bottom: var(--s5); }
  .wizard.open { display: block; }
  .wizard h2 { font-size: 22px; font-weight: 700; color: var(--heading); margin: 0 0 var(--s1); letter-spacing: -.01em; }
  .wizard .lead { color: var(--muted); font-size: 14px; margin: 0 0 var(--s6); max-width: 70ch; }
  .steps { display: grid; gap: var(--s6); }
  .step { display: grid; grid-template-columns: 34px 1fr; gap: var(--s4); }
  .step .num { width: 34px; height: 34px; border-radius: 50%; background: var(--navy); color: #fff;
    font-weight: 700; font-size: 15px; display: grid; place-items: center; box-shadow: var(--shadow-sm); }
  .step.done .num { background: var(--good); }
  .step.done .num::after { content: "✓"; }
  .step.done .num .d { display: none; }
  .step h3 { margin: 4px 0 var(--s1); font-size: 16px; font-weight: 700; color: var(--heading); }
  .step h3 em { font-style: normal; color: var(--muted); font-weight: 500; font-size: 13px; }
  .step p { margin: 0 0 var(--s3); font-size: 13.5px; color: var(--muted); max-width: 66ch; }
  .step ol { margin: var(--s2) 0 var(--s3) 18px; padding: 0; font-size: 13px; color: var(--muted); }
  .step li { margin: var(--s1) 0; }
  .connected { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; color: var(--good); font-weight: 500; }

  input, textarea { font: inherit; width: 100%; background: var(--sunk); color: var(--text);
    border: 1px solid var(--border); border-radius: var(--r-sm); padding: 12px 14px; transition: border-color .12s, box-shadow .12s, background .12s; }
  input::placeholder, textarea::placeholder { color: var(--muted); opacity: .8; }
  textarea { font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; resize: vertical; }
  input:focus, textarea:focus { outline: none; background: var(--surface); border-color: var(--primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 22%, transparent); }
  .rowbtns { display: flex; gap: var(--s2); align-items: center; margin-top: var(--s3); flex-wrap: wrap; }
  .msg { font-size: 12.5px; color: var(--muted); }
  .msg.good { color: var(--good); } .msg.bad { color: var(--bad); }
  .expander { margin-top: var(--s2); font-size: 12.5px; color: var(--muted); cursor: pointer; background: none; border: 0; padding: 0; text-decoration: underline; }

  button { font: 500 14px/1 var(--font); cursor: pointer; border-radius: var(--r-sm);
    border: 1px solid transparent; padding: 12px 20px; transition: background .14s, color .14s, transform .1s, border-color .14s; }
  button:active { transform: translateY(1px); }
  .primary { background: var(--navy); color: #fff; box-shadow: var(--shadow-sm); }
  .primary:hover { background: var(--yellow); color: var(--navy); }
  .primary:disabled { opacity: .55; cursor: default; background: var(--navy); color: #fff; transform: none; }
  .ghost { background: transparent; color: var(--primary); border-color: var(--border); }
  .ghost:hover { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 7%, transparent); }
  .sm { padding: 9px 15px; font-size: 13px; }

  /* ---- Query form ---- */
  form.query { padding: var(--s5) var(--s6); display: flex; flex-wrap: wrap; gap: var(--s5); align-items: end; }
  form.query label { display: flex; flex-direction: column; gap: 7px; font-size: 11.5px; font-weight: 600;
    letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
  form.query input[type=text] { width: auto; }
  #range { min-width: 232px; cursor: pointer; }
  .mini { width: 88px !important; } .mini-lg { width: 116px !important; }
  .checks { display: flex; gap: var(--s5); align-items: center; padding-bottom: 2px; }
  .checks label { flex-direction: row; align-items: center; gap: 8px; text-transform: none; letter-spacing: 0;
    font-size: 13.5px; font-weight: 500; color: var(--text); cursor: pointer; }
  .checks input { width: auto; padding: 0; box-shadow: none; accent-color: var(--navy); width: 17px; height: 17px; }
  form.query .go { margin-left: auto; }
  form.query .go button { padding: 13px 30px; font-size: 15px; font-weight: 700; }

  #status { margin: var(--s5) 2px; color: var(--muted); min-height: 20px; font-size: 14.5px; display: flex; align-items: center; gap: 10px; }
  .spin { width: 15px; height: 15px; border: 2px solid var(--border); border-top-color: var(--navy); border-radius: 50%; animation: sp .7s linear infinite; }
  @keyframes sp { to { transform: rotate(360deg); } }

  /* ---- Results ---- */
  .results { margin-top: var(--s6); }
  .lead-metric { display: flex; align-items: baseline; gap: var(--s3); margin: 0 0 var(--s5); flex-wrap: wrap; }
  .lead-metric b { font-size: clamp(46px, 8vw, 76px); font-weight: 700; color: var(--heading); line-height: .9; letter-spacing: -.03em; }
  .lead-metric span { font-size: 17px; color: var(--muted); }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(158px, 1fr)); gap: var(--s3); margin: 0 0 var(--s6); }
  .stat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: var(--s4) var(--s5);
    box-shadow: var(--shadow-sm); transition: transform .12s, box-shadow .12s; }
  .stat:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
  .stat b { display: block; font-size: 32px; font-weight: 700; color: var(--heading); line-height: 1.05; }
  .stat span { color: var(--muted); font-size: 12.5px; }

  .sources { padding: var(--s5) var(--s6); margin: 0 0 var(--s6); }
  .sources h2 { font-size: 15px; font-weight: 700; color: var(--heading); margin: 0 0 var(--s2); }
  .sources h2 em { font-style: normal; font-weight: 500; color: var(--muted); font-size: 13px; }
  .srcrow { display: flex; align-items: center; gap: var(--s3); padding: var(--s3) 0; border-top: 1px solid var(--border); }
  .srcrow:first-of-type { border-top: 0; }
  .srcrow a { flex: 1; word-break: break-word; font-size: 13.5px; font-weight: 500; }

  section.group { margin: var(--s7) 0 0; }
  section.group > h2 { font-size: 21px; font-weight: 700; color: var(--heading); letter-spacing: -.01em;
    border-bottom: 2px solid var(--border); padding-bottom: var(--s3); margin: 0 0 var(--s4); }
  section.group > h2 .who { font-size: 14px; }
  h3.grp { font-size: 13px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--slate);
    margin: var(--s5) 0 var(--s2); }
  h3.grp .n { color: var(--muted); font-weight: 500; }
  ul.list { margin: var(--s2) 0; padding-left: 20px; }
  ul.list li { margin: 6px 0; }
  .tag { display: inline-block; background: var(--tagbg); color: var(--tagfg); border-radius: 5px;
    padding: 0 6px; font-size: 11px; font-weight: 600; margin-left: 4px; }
  .who { color: var(--muted); font-size: 13px; font-weight: 400; }
  .toolbar { display: flex; gap: var(--s3); margin: var(--s7) 0 0; flex-wrap: wrap; }
  details { margin-top: var(--s4); }
  summary { cursor: pointer; color: var(--muted); font-size: 13px; font-weight: 500; }
  pre { background: var(--sunk); border: 1px solid var(--border); border-radius: var(--r-sm);
    padding: var(--s4); overflow-x: auto; font-size: 12px; line-height: 1.55; margin-top: var(--s3); }
  .note { color: var(--muted); font-size: 13px; }

  /* ---- FlexiDatepicker → UnleashWP theme ---- */
  .mrdp-nav-btn, .mrdp-year-nav { color: var(--navy); }
  .mrdp-month-year-btn:hover, .mrdp-picker-item:hover, .mrdp-picker-item.current-year { color: var(--navy); border-color: var(--navy); }
  .mrdp-picker-item:hover { background-color: var(--paper-faded); }
  .mrdp-picker-item.active, .mrdp-picker-item.current-year.active { background-color: var(--navy); border-color: var(--navy); color: #fff; }
  .mrdp-day-cell.in-range { color: var(--navy); }
  @media (prefers-color-scheme: dark) {
    .mrdp-container { background: var(--surface); border-color: var(--border); color: var(--text); }
    .mrdp-calendar-panel:first-child { border-color: var(--border); }
    .mrdp-day-header { color: var(--muted); }
    .mrdp-day-cell:not(.empty):not(.disabled):hover { background-color: var(--sunk); }
    .mrdp-day-cell.in-range { color: var(--text); }
    .mrdp-month-year-display, .mrdp-month-year-btn, .mrdp-picker-header { color: var(--text); }
    .mrdp-picker-item { background: var(--sunk); color: var(--text); }
  }
  @media (max-width: 640px) {
    form.query { gap: var(--s4); } form.query .go { margin-left: 0; width: 100%; } form.query .go button { width: 100%; }
  }
</style>
</head>
<body>
<header>
  <div class="bar">
    ${BULB}
    <div class="brand"><b>Release Helper</b><span>UnleashWP</span></div>
    <div class="pills">
      <button class="pill" id="pillGh" onclick="openWizard()"><span class="dot"></span>GitHub</button>
      <button class="pill" id="pillTrac" onclick="openWizard()"><span class="dot"></span>Trac</button>
    </div>
  </div>
</header>
<main>
  <div class="hero">
    <h1>A date window in. A <span class="hl">release changelog</span> out.</h1>
    <p>Counts every Core &amp; Gutenberg change in the window and drafts the post — grounded in real PRs and tickets, with the source links to prove it.</p>
  </div>

  <section class="card wizard" id="wizard">
    <h2>Setup</h2>
    <p class="lead">Two keys, once. Stored locally on this machine (owner-only file), sent only to the official GitHub / WordPress.org APIs. The same keys power <code>uwp --deep</code> on the CLI.</p>
    <div class="steps">
      <div class="step" id="stepGh">
        <div class="num"><span class="d">1</span></div>
        <div>
          <h3>GitHub <em>— lifts the API limit 60 → 5000/h</em></h3>
          <div id="ghConnected" class="connected" hidden></div>
          <div id="ghSetup">
            <p>One click if you have the <code>gh</code> CLI logged in — it's detected automatically. Otherwise paste a token (no scopes needed, public data only).</p>
            <ol><li><a href="https://github.com/settings/tokens/new?description=wp-release-helper&scopes=" target="_blank" rel="noopener">Create a token</a> and paste it below.</li></ol>
            <input type="password" id="ghToken" placeholder="ghp_… or github_pat_…" autocomplete="off" spellcheck="false">
            <div class="rowbtns">
              <button class="primary sm" type="button" onclick="saveGh()">Save &amp; connect</button>
              <button class="ghost sm" type="button" onclick="testGh()">Test</button>
              <span class="msg" id="ghMsg"></span>
            </div>
          </div>
          <button class="expander" id="ghEdit" hidden onclick="editGh()">Use a different token</button>
        </div>
      </div>
      <div class="step" id="stepTrac">
        <div class="num"><span class="d">2</span></div>
        <div>
          <h3>WordPress.org <em>— only for “deep” (full ticket descriptions)</em></h3>
          <div id="tracConnected" class="connected" hidden></div>
          <div id="tracSetup">
            <p>Skip this for Beta-post counts. A web page can't read this cookie for you (it's HttpOnly), so paste it once — it auto-saves and tests the moment you paste.</p>
            <ol>
              <li><a href="https://wordpress.org/" target="_blank" rel="noopener">Log in to wordpress.org</a>.</li>
              <li>DevTools → Application → Cookies → <code>wordpress.org</code> → copy <code>wporg_logged_in</code> + <code>wporg_sec</code> as <code>name=value; name=value</code>.</li>
            </ol>
            <textarea id="cookieVal" rows="3" placeholder="wporg_logged_in=…; wporg_sec=…"></textarea>
            <div class="rowbtns">
              <button class="primary sm" type="button" onclick="saveCookie()">Save &amp; connect</button>
              <button class="ghost sm" type="button" onclick="testCookie()">Test</button>
              <span class="msg" id="cookieMsg"></span>
            </div>
          </div>
          <button class="expander" id="tracEdit" hidden onclick="editTrac()">Replace the cookie</button>
        </div>
      </div>
    </div>
  </section>

  <form class="query card" id="f">
    <label>Date range<input type="text" id="range" placeholder="Pick a range" autocomplete="off" readonly></label>
    <label>Milestone<input type="text" id="milestone" class="mini" placeholder="7.1"></label>
    <label>GB branch<input type="text" id="gbBranch" class="mini-lg" placeholder="wp/7.1"></label>
    <label>Core branch<input type="text" id="coreBranch" class="mini-lg" placeholder="trunk"></label>
    <div class="checks">
      <label><input type="checkbox" id="labels" checked> GB labels</label>
      <label><input type="checkbox" id="devNotes" checked> dev-notes</label>
      <label><input type="checkbox" id="deep"> deep</label>
    </div>
    <div class="go"><button class="primary" id="go" type="submit">Generate</button></div>
  </form>

  <div id="status"></div>
  <div id="out" class="results"></div>
</main>
<script src="/vendor/flexidatepicker.js"></script>
<script>
var $ = function (id) { return document.getElementById(id); };
var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
  return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
var GB = 'https://github.com/WordPress/gutenberg';
var TRAC = 'https://core.trac.wordpress.org';
var lastMarkdown = '', lastPost = '', rangeSince = '', rangeUntil = '';

// ---- Date range (FlexiDatepicker) ----
(function () {
  var iso = function (x) { return x.toISOString().slice(0, 10); };
  var d = new Date(); rangeUntil = iso(d); var s = new Date(d); s.setDate(s.getDate() - 7); rangeSince = iso(s);
  try {
    new FlexiDatepicker('#range', {
      mode: 'range', dateFormat: 'yyyy-MM-dd',
      onSelectionChange: function (data) {
        var r = data && data.ranges && data.ranges[0];
        if (r && r.start && r.end) { rangeSince = r.start; rangeUntil = r.end; $('range').value = r.start + '  →  ' + r.end; }
      }
    });
  } catch (e) { $('range').removeAttribute('readonly'); $('range').placeholder = 'YYYY-MM-DD..YYYY-MM-DD'; }
  $('range').value = rangeSince + '  →  ' + rangeUntil;
})();

// ---- Setup wizard ----
function openWizard() { $('wizard').classList.add('open'); $('wizard').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function setPill(id, set, source) {
  var el = $(id); el.className = 'pill ' + (set ? 'ok' : 'off');
  el.innerHTML = '<span class="dot"></span>' + (id === 'pillGh' ? 'GitHub' : 'Trac') + (set ? ' · ' + source : ' · off');
}
function refreshStatus() {
  return fetch('/api/config/status').then(function (r) { return r.json(); }).then(function (d) {
    setPill('pillGh', d.github.set, d.github.source);
    setPill('pillTrac', d.trac.set, d.trac.source);
    // GitHub step
    if (d.github.set) {
      $('stepGh').className = 'step done';
      $('ghConnected').hidden = false;
      $('ghConnected').innerHTML = '<span>✓</span> Connected · ' + (d.github.source === 'gh' ? 'GitHub CLI (gh)' : d.github.source) + ' · 5000/h';
      $('ghSetup').hidden = true; $('ghEdit').hidden = (d.github.source !== 'file');
    } else {
      $('stepGh').className = 'step'; $('ghConnected').hidden = true; $('ghSetup').hidden = false; $('ghEdit').hidden = true;
    }
    // Trac step
    if (d.trac.set) {
      $('stepTrac').className = 'step done';
      $('tracConnected').hidden = false; $('tracConnected').innerHTML = '<span>✓</span> Cookie saved · ' + d.trac.source;
      $('tracSetup').hidden = true; $('tracEdit').hidden = (d.trac.source !== 'file');
    } else {
      $('stepTrac').className = 'step'; $('tracConnected').hidden = true; $('tracSetup').hidden = false; $('tracEdit').hidden = true;
    }
    if (!d.github.set && !d.trac.set) $('wizard').classList.add('open');
  }).catch(function () {});
}
function editGh() { $('ghSetup').hidden = false; $('ghEdit').hidden = true; $('ghToken').focus(); }
function editTrac() { $('tracSetup').hidden = false; $('tracEdit').hidden = true; $('cookieVal').focus(); }
function msg(id, text, kind) { var el = $(id); el.className = 'msg' + (kind ? ' ' + kind : ''); el.textContent = text; }

function saveGh() {
  var token = $('ghToken').value.trim();
  if (!token) { msg('ghMsg', 'paste the token first', 'bad'); return; }
  msg('ghMsg', 'saving…');
  fetch('/api/github-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token }) })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (x) { if (x.ok) { $('ghToken').value = ''; testGh(); } else msg('ghMsg', x.d.error, 'bad'); });
}
function testGh() {
  msg('ghMsg', 'testing…');
  fetch('/api/github-token/test', { method: 'POST' }).then(function (r) { return r.json(); }).then(function (d) {
    msg('ghMsg', d.message, d.ok ? 'good' : 'bad'); refreshStatus();
  });
}
function saveCookie() {
  var cookie = $('cookieVal').value.trim();
  if (!cookie) { msg('cookieMsg', 'paste the cookie first', 'bad'); return; }
  msg('cookieMsg', 'saving…');
  fetch('/api/cookie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cookie: cookie }) })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (x) { if (x.ok) { $('cookieVal').value = ''; testCookie(); } else msg('cookieMsg', x.d.error, 'bad'); });
}
function testCookie() {
  msg('cookieMsg', 'testing…');
  fetch('/api/cookie/test', { method: 'POST' }).then(function (r) { return r.json(); }).then(function (d) {
    msg('cookieMsg', d.message, d.ok ? 'good' : 'bad'); refreshStatus();
  });
}
// auto-save+test the instant a key is pasted (one-paste flow)
$('ghToken').addEventListener('paste', function () { setTimeout(saveGh, 30); });
$('cookieVal').addEventListener('paste', function () { setTimeout(saveCookie, 30); });

// ---- Report ----
$('f').addEventListener('submit', function (e) {
  e.preventDefault();
  if (!rangeSince || !rangeUntil) { $('status').textContent = 'Pick a date range first.'; return; }
  $('go').disabled = true; $('out').innerHTML = '';
  $('status').innerHTML = '<span class="spin"></span> Fetching commits, labels and dev-notes…';
  var p = new URLSearchParams({
    since: rangeSince, until: rangeUntil,
    milestone: $('milestone').value.trim(), gbBranch: $('gbBranch').value.trim(),
    coreBranch: $('coreBranch').value.trim(),
    labels: $('labels').checked, devNotes: $('devNotes').checked, deep: $('deep').checked,
  });
  fetch('/api/report?' + p).then(function (r) {
    return r.json().then(function (data) { if (!r.ok) throw new Error(data.error || 'request failed'); return data; });
  }).then(function (data) {
    lastMarkdown = data.markdown; lastPost = data.post; render(data); $('status').textContent = '';
  }).catch(function (err) {
    $('status').textContent = 'Error: ' + err.message; if (/cookie/i.test(err.message)) openWizard();
  }).finally(function () { $('go').disabled = false; });
});

function render(data) {
  var meta = data.meta, report = data.report, t = report.totals;
  var issues = (t.coreTickets || 0) + (t.gutenbergPRs || 0);
  var h = '<div class="lead-metric"><b class="tnum">' + issues + '</b><span>issues addressed · ' + esc(rangeSince) + ' to ' + esc(rangeUntil) + '</span></div>';
  var stat = function (n, l) { return '<div class="stat"><b class="tnum">' + n + '</b><span>' + l + '</span></div>'; };
  h += '<div class="stats">' +
    stat(t.gutenbergPRs, 'Gutenberg PRs') + stat(t.gutenbergCommits, 'GB commits') +
    stat(t.coreChangesets, 'Core changesets') + stat(t.coreTickets, 'Core tickets') +
    stat(t.contributors, 'Contributors') + '</div>';

  if (data.sources) {
    var s = data.sources, mile = s.milestone ? ' (milestone ' + esc(s.milestone) + ')' : '';
    h += '<section class="card sources"><h2>Sources <em>— link these in the post so anyone can verify</em></h2>' +
      srcRow(s.trac, 'Closed Core Trac tickets' + mile + ' — ' + esc(s.since) + ' to ' + esc(s.until)) +
      srcRow(s.gutenberg, 'Gutenberg commits on ' + esc(s.gbBranch) + ' — ' + esc(s.since) + ' to ' + esc(s.until)) +
      '</section>';
  }

  h += '<section class="group"><h2>Gutenberg <span class="who">(' + esc(meta.gbBranch) + ')</span></h2>';
  if (report.gutenberg.byCategory) {
    sortGroups(report.gutenberg.byCategory).forEach(function (g) { h += gbGroup(g[0], g[1]); });
  } else h += '<ul class="list">' + report.gutenberg.commits.map(gbItem).join('') + '</ul>';
  h += '</section>';

  h += '<section class="group"><h2>Core <span class="who">(' + esc(meta.coreBranch) + ')</span></h2>';
  if (report.core.tracker) {
    h += '<p class="note">Grouped via <code>' + esc(report.core.tracker.slug) + '</code> dev-notes tracker.</p>';
    sortGroups(report.core.byComponent, true).forEach(function (g) { h += coreGroup(g[0], g[1]); });
  } else {
    if (meta.trackerMissing) h += '<p class="note">No dev-notes tracker for this milestone — Core ungrouped.</p>';
    h += '<ul class="list">' + report.core.commits.map(coreItem).join('') + '</ul>';
  }
  h += '</section>';

  var all = uniq((report.gutenberg.contributors || []).concat(report.core.contributors || []))
    .sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
  h += '<section class="group"><h2>Contributors <span class="who">(' + all.length + ')</span></h2><p>' + all.map(esc).join(', ') + '</p></section>';

  h += '<div class="toolbar"><button class="primary" onclick="copyPost()">Copy post template</button>' +
    '<button class="ghost" onclick="copyMd()">Copy Markdown</button>' +
    '<button class="ghost" onclick="downloadMd()">Download .md</button></div>';
  h += '<details><summary>Post template</summary><pre>' + esc(lastPost) + '</pre></details>';
  h += '<details><summary>Raw Markdown</summary><pre>' + esc(lastMarkdown) + '</pre></details>';
  $('out').innerHTML = h;
}

function srcRow(url, text) {
  return '<div class="srcrow"><a href="' + esc(url) + '" target="_blank" rel="noopener">' + text + '</a>' +
    '<button class="ghost sm" onclick="copyText(this.dataset.u)" data-u="' + esc(url) + '">Copy link</button></div>';
}
function uniq(arr) { var seen = {}, out = []; arr.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } }); return out; }
function sortGroups(obj, uncatLast) {
  return Object.keys(obj).map(function (k) { return [k, obj[k]]; }).sort(function (a, b) {
    if (uncatLast) { if (a[0] === 'Uncategorized') return 1; if (b[0] === 'Uncategorized') return -1; }
    return b[1].length - a[1].length;
  });
}
function gbGroup(cat, items) { return '<h3 class="grp">' + esc(cat) + ' <span class="n">(' + items.length + ')</span></h3><ul class="list">' + items.map(gbItem).join('') + '</ul>'; }
function gbItem(c) {
  var pr = c.pr ? ' <a href="' + GB + '/pull/' + c.pr + '">#' + c.pr + '</a>' : '';
  return '<li>' + esc(c.subject) + pr + ' <span class="who">' + esc(c.author) + '</span></li>';
}
function coreGroup(comp, items) { return '<h3 class="grp">' + esc(comp) + ' <span class="n">(' + items.length + ')</span></h3><ul class="list">' + items.map(coreItem).join('') + '</ul>'; }
function coreItem(c) {
  var ref = c.changeset ? '<a href="' + TRAC + '/changeset/' + c.changeset + '">r' + c.changeset + '</a>' : esc(c.shortSha);
  var tix = (c.tickets || []).map(function (n) { return '<a href="' + TRAC + '/ticket/' + n + '">#' + n + '</a>'; }).join(' ');
  var cls = c.classification ? ' <span class="tag">' + esc(c.classification) + '</span>' : '';
  var props = c.props && c.props.length ? ' <span class="who">props ' + esc(c.props.join(', ')) + '</span>' : '';
  return '<li>' + ref + ': ' + esc(c.subject) + cls + (tix ? ' ' + tix : '') + props + '</li>';
}
function copyText(s) { navigator.clipboard.writeText(s); }
function copyPost() { navigator.clipboard.writeText(lastPost); }
function copyMd() { navigator.clipboard.writeText(lastMarkdown); }
function downloadMd() {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lastMarkdown], { type: 'text/markdown' }));
  a.download = 'changelog.md'; a.click();
}

refreshStatus();
</script>
</body>
</html>`;
