import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generate } from './report.mjs';
import { toMarkdown, toPost, sourceUrls } from './format.mjs';
import { authenticated, tokenStatus, saveToken, checkToken, branches } from './github.mjs';
import { fetchTicketDetails, resolveCookie, saveCookie, cookiePath, validateCookie } from './trac.mjs';
import { applyDeepDetails } from './aggregate.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
// UnleashWP full-color wordmark for the white header bar (inverted to white in dark mode).
const stripXml = (s) => s.replace(/<\?xml[^?]*\?>/, '').trim();
const LOGO = stripXml(readFileSync(join(DIR, 'brand/unleashwp-logo-full.svg'), 'utf8'));
const BULB_FILE = readFileSync(join(DIR, 'brand/bulb-full.svg'), 'utf8');

export function startServer({ port = 4321 } = {}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(PAGE);
      return;
    }
    if (url.pathname === '/api/branches') {
      const repo = url.searchParams.get('repo') === 'core' ? 'WordPress/wordpress-develop' : 'WordPress/gutenberg';
      try {
        json(res, 200, { branches: await branches(repo) });
      } catch (err) {
        json(res, 200, { branches: [], error: err.message });
      }
      return;
    }
    if (url.pathname === '/brand/bulb.svg') {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'max-age=86400' });
      res.end(BULB_FILE);
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
      if (process.env.GITHUB_TOKEN) return json(res, 400, { error: 'GITHUB_TOKEN env is set and overrides the file. Unset it to save one here.' });
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
      if (process.env.WPORG_TRAC_COOKIE) return json(res, 400, { error: 'WPORG_TRAC_COOKIE env is set and overrides the file. Unset it to save one here.' });
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
        json(res, 200, { ok, message: ok ? 'Cookie works. Trac reachable.' : 'Trac rejected it (expired or wrong cookie).' });
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
          try {
            const cookie = resolveCookie();
            if (!cookie) throw new Error('no Trac cookie saved yet');
            applyDeepDetails(report, await fetchTicketDetails({ milestone: meta.milestone, cookie }));
          } catch (err) {
            meta.deepError = err.message; // never block the report on a deep failure
          }
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
      console.error(`uwp: port ${port} is already in use. Try \`uwp serve --port ${port + 1}\`.`);
      process.exit(1);
    }
    throw err;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`uwp browser UI  ->  http://localhost:${port}`);
    if (!authenticated()) console.log('uwp: no gh token. GitHub API limited to 60 req/h (add one in Setup).');
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
<title>Release Helper · UnleashWP</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(BULB)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  :root {
    --navy: #203159; --navy-deep: #0f131f; --yellow: #fcbe00; --ink: #292b2e;
    --slate: #727f9f; --slate-2: #35415b;
    --paper: #ffffff; --paper-alt: #f2f4f7; --paper-faded: #eceef5; --hairline: #e3e7f0;
    --bg: #eef1f6; --surface: #ffffff; --sunk: #f5f7fa; --border: #e3e7f0;
    --heading: var(--navy); --text: #2b3242; --muted: #55607a;
    --primary: var(--navy); --accent: var(--yellow); --link: var(--navy);
    --tagbg: #eceef5; --tagfg: var(--navy); --good: #1a8f57; --bad: #c0392b;
    --shadow-sm: 0 1px 2px rgba(32,49,89,.06);
    --shadow: 0 6px 24px rgba(32,49,89,.09);
    --shadow-lg: 0 18px 48px rgba(32,49,89,.16);
    --ring: rgba(32,49,89,.26); --ghost-hover: rgba(32,49,89,.06); --range-fill: #e7ebf5;
    /* 4pt spacing scale */
    --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px; --s7: 48px; --s8: 64px;
    --r: 5px; --r-sm: 5px;
    --font: "Ubuntu", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f1218; --surface: #171b24; --sunk: #1e232e; --border: #2a3040;
      --heading: #eaf0ff; --text: #dbe2ef; --muted: #94a1bd; --primary: #7c93ff; --link: #a9bcff;
      --tagbg: #232b40; --tagfg: #b9c7ff;
      --shadow-sm: 0 1px 2px rgba(0,0,0,.4); --shadow: 0 6px 24px rgba(0,0,0,.4); --shadow-lg: 0 18px 48px rgba(0,0,0,.55);
      --ring: rgba(124,147,255,.42); --ghost-hover: rgba(124,147,255,.12); --range-fill: #26314d;
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

  /* ---- Header (white brand bar) ---- */
  header { position: sticky; top: 0; z-index: 20; background: var(--surface); border-bottom: 1px solid var(--border); transition: box-shadow .18s ease; }
  header.scrolled { box-shadow: var(--shadow); }
  .bar { max-width: 1120px; margin: 0 auto; padding: 14px var(--s5); display: flex; align-items: center; gap: var(--s4); }
  .logo { display: inline-flex; align-items: center; flex: none; transition: opacity .15s; }
  .logo:hover { opacity: .78; }
  .logo svg { height: 22px; width: auto; display: block; }
  .divider { width: 1px; height: 20px; background: var(--border); flex: none; }
  .product { font-size: 14.5px; font-weight: 500; color: var(--heading); letter-spacing: .005em; text-decoration: none; }
  .product:hover { color: var(--heading); opacity: .7; }
  .pills { margin-left: auto; display: flex; gap: var(--s2); }
  .pill { display: inline-flex; align-items: center; gap: 7px; font: 500 12.5px/1 var(--font);
    background: var(--sunk); border: 1px solid var(--border); color: var(--text);
    padding: 8px 13px; border-radius: 5px; cursor: pointer; transition: border-color .15s, transform .1s; }
  .pill:hover { border-color: var(--primary); transform: translateY(-1px); }
  .pill .ic { width: 16px; height: 16px; border-radius: 50%; display: inline-grid; place-items: center; font-size: 10px; font-weight: 700; line-height: 1; }
  .pill.ok .ic { background: var(--good); color: #fff; }
  .pill.ok .ic::after { content: "✓"; }
  .pill.off .ic { border: 1.5px solid var(--yellow); color: var(--yellow); }
  @media (prefers-color-scheme: dark) { .logo svg { filter: brightness(0) invert(1); } }

  /* ---- App shell: tool rail (left) + workspace (right) ---- */
  .shell { max-width: 1160px; margin: 0 auto; padding: 0 var(--s5); display: grid;
    grid-template-columns: 124px minmax(0, 1fr); gap: var(--s6); align-items: start; }

  /* ---- Tool rail (compact sidebar of small Metro tiles; grows downward) ---- */
  .rail { position: sticky; top: 82px; margin-top: var(--s6); display: flex; flex-direction: column; gap: var(--s2); }
  .rail-cap { font: 600 9.5px/1 var(--font); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); padding: 0 2px var(--s1); }
  .tool { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 5px;
    width: 100%; padding: var(--s3) 6px; border-radius: var(--r); border: 1px solid transparent;
    background: var(--sunk); color: var(--text); cursor: pointer; font: inherit;
    transition: transform .12s ease, box-shadow .12s ease, background .14s ease; }
  .tool:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
  .tool-ic { display: grid; place-items: center; }
  .tool-name { font: 500 9.5px/1.25 var(--font); }
  .tool.active { background: var(--navy); color: #fff; box-shadow: var(--shadow-sm); cursor: default; }
  .tool.active:hover { transform: none; }
  .tool.is-more { background: none; border: 1px dashed var(--border); color: var(--muted); cursor: default; }
  .tool.is-more:hover { transform: none; box-shadow: none; }
  .tool.is-more .tool-ic { font: 400 16px/1 var(--font); }

  /* ---- Workspace (the active tool) ---- */
  main { min-width: 0; padding: var(--s6) 0 var(--s8); }
  .tool-head { margin-bottom: var(--s5); }
  .tool-head h1 { font-size: 25px; font-weight: 700; color: var(--heading); letter-spacing: -.02em; margin: 0 0 6px; }
  .tool-head p { margin: 0; font-size: 14.5px; color: var(--muted); max-width: 68ch; line-height: 1.55; }

  /* ---- Filter panel ---- */
  .filters { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r);
    box-shadow: var(--shadow-sm); padding: var(--s5) var(--s6); margin-bottom: var(--s6); }
  .filters-loading { display: none; align-items: center; justify-content: center; gap: 10px;
    color: var(--muted); font-size: 14px; padding: var(--s7) 0; }
  .filters.loading .filters-loading { display: flex; }
  .filters.loading > form { display: none; }

  @media (max-width: 780px) {
    .shell { grid-template-columns: 1fr; gap: var(--s4); padding: 0 var(--s4); }
    .rail { position: static; top: auto; margin-top: var(--s5); flex-direction: row; flex-wrap: wrap; gap: var(--s2); }
    .rail-cap { width: 100%; }
    .tool { flex: 1 1 120px; height: 76px; }
    .tool.is-more { height: 76px; }
    main { padding-top: var(--s4); }
    .tool-head h1 { font-size: 22px; }
    .filters { padding: var(--s5) var(--s4); }
    .qfields { gap: var(--s4); }
    .qactions { flex-direction: column; align-items: stretch; gap: var(--s4); }
    .checks { gap: var(--s4); flex-wrap: wrap; }
    .go { width: 100%; justify-content: flex-end; gap: var(--s4); }
  }

  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); box-shadow: var(--shadow); }

  /* ---- Setup wizard ---- */
  .wizard { display: none; padding: var(--s6); margin-bottom: var(--s5); position: relative; }
  .wizard.open { display: block; }
  .wiz-close { position: absolute; top: var(--s5); right: var(--s5); width: 32px; height: 32px; border: 1px solid var(--border);
    background: var(--surface); border-radius: 5px; color: var(--muted); cursor: pointer; padding: 0;
    display: grid; place-items: center; font: 400 20px/1 var(--font); }
  .wiz-close:hover { border-color: var(--navy); color: var(--navy); }
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
    box-shadow: 0 0 0 3px var(--ring); }
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
  .ghost:hover { border-color: var(--primary); background: var(--ghost-hover); }
  .sm { padding: 9px 15px; font-size: 13px; }
  .ghost.sm { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
  button svg { flex: none; }

  /* ---- Query form (two clean rows: fields, then options + actions) ---- */
  form.query { display: block; }
  .qfields { display: flex; flex-wrap: wrap; gap: var(--s5); align-items: flex-end; }
  .qactions { display: flex; align-items: center; justify-content: space-between; gap: var(--s4); margin-top: var(--s5);
    padding-top: var(--s4); border-top: 1px solid var(--border); }
  form.query label { display: flex; flex-direction: column; gap: 7px; font-size: 11.5px; font-weight: 600;
    letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
  form.query input[type=text] { width: auto; }
  .mini { width: 88px !important; } .mini-lg { width: 116px !important; }
  .branch-select { font: inherit; background-color: var(--sunk); color: var(--text); border: 1px solid var(--border);
    border-radius: 5px; padding: 11px 34px 11px 14px; width: 150px; cursor: pointer; appearance: none; -webkit-appearance: none;
    text-overflow: ellipsis; white-space: nowrap; overflow: hidden;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7' viewBox='0 0 10 7'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%237a869f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center; }
  .branch-select:focus { outline: none; background-color: var(--surface); border-color: var(--primary); box-shadow: 0 0 0 3px var(--ring); }
  .mile-select { width: 96px; }
  .checks { display: flex; gap: var(--s5); align-items: center; }
  form.query .checks label { flex-direction: row; align-items: center; gap: 8px; text-transform: none; letter-spacing: 0;
    font-size: 13.5px; font-weight: 500; color: var(--text); cursor: pointer; white-space: nowrap; }
  .checks input { width: 17px; height: 17px; padding: 0; box-shadow: none; accent-color: var(--navy); cursor: pointer; }
  .info { display: inline-grid; place-items: center; width: 14px; height: 14px; border-radius: 50%; border: 1px solid var(--border);
    color: var(--muted); font: 600 9px/1 var(--font); cursor: help; position: relative; opacity: .75; }
  .info:hover { opacity: 1; border-color: var(--muted); }
  .info::after { content: attr(data-tip); position: absolute; top: calc(100% + 7px); left: 0;
    background: var(--surface); color: var(--text); border: 1px solid var(--border); padding: 8px 10px; border-radius: 5px;
    font: 400 12px/1.4 var(--font); width: 210px; text-align: left; white-space: normal;
    opacity: 0; visibility: hidden; pointer-events: none; transition: opacity .12s, visibility .12s; z-index: 40; box-shadow: var(--shadow); }
  .info:hover::after { opacity: 1; visibility: visible; }
  .go { display: flex; align-items: center; gap: var(--s4); }
  .go .primary { padding: 12px 28px; font-size: 15px; font-weight: 700; }
  .reset-link { background: none; border: 0; color: var(--muted); font-size: 13px; cursor: pointer; text-decoration: underline; padding: 4px; }
  .reset-link:hover { color: var(--navy); }

  /* ---- Date range picker (custom, dependency-free) ---- */
  .rangewrap { position: relative; display: flex; flex-direction: column; gap: 7px; }
  .flabel { font-size: 11.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
  .rangebtn { font: inherit; text-align: left; background: var(--sunk); color: var(--text); border: 1px solid var(--border);
    border-radius: 5px; height: 42px; padding: 0 14px; min-width: 224px; cursor: pointer; display: inline-flex; align-items: center;
    line-height: 1; transition: border-color .12s, box-shadow .12s; }
  .rangebtn:hover { border-color: var(--primary); }
  .rangebtn:focus-visible { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--ring); }
  .cal { position: absolute; top: calc(100% + 8px); left: 0; z-index: 30; width: 300px; background: var(--surface);
    border: 1px solid var(--border); border-radius: var(--r); box-shadow: var(--shadow-lg); padding: 12px; }
  .cal[hidden] { display: none; }
  .cal-presets { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .preset { font: 500 12px/1 var(--font); background: var(--sunk); border: 1px solid var(--border); color: var(--text);
    border-radius: 5px; padding: 7px 12px; cursor: pointer; }
  .preset:hover { border-color: var(--navy); color: var(--navy); }
  .cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .cal-title { font-weight: 700; font-size: 14px; color: var(--heading); }
  .cal-nav { width: 30px; height: 30px; border-radius: 5px; border: 1px solid var(--border); background: var(--surface); cursor: pointer; position: relative; }
  .cal-nav:hover { background: var(--sunk); }
  .cal-nav::before { content: ""; position: absolute; top: 50%; left: 50%; width: 7px; height: 7px; border-right: 2px solid var(--navy); border-bottom: 2px solid var(--navy); }
  #calprev::before { transform: translate(-30%,-50%) rotate(135deg); }
  #calnext::before { transform: translate(-70%,-50%) rotate(-45deg); }
  .cal-dow { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; margin-bottom: 4px; }
  .cal-dow span { text-align: center; font-size: 11px; font-weight: 600; color: var(--muted); padding: 4px 0; }
  .cal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); grid-auto-rows: 36px; gap: 2px; }
  .cal-cell { height: 36px; border: 0; background: none; font: 500 13px/1 var(--font); color: var(--text); cursor: pointer;
    border-radius: 5px; display: inline-grid; place-items: center; padding: 0; }
  .cal-cell:hover { background: var(--sunk); }
  .cal-cell.empty { visibility: hidden; cursor: default; }
  .cal-cell.today { box-shadow: inset 0 0 0 1.5px var(--navy); color: var(--navy); font-weight: 700; }
  .cal-cell.inrange { background: var(--range-fill); border-radius: 0; color: var(--navy); }
  .cal-cell.start, .cal-cell.end { background: var(--navy); color: #fff; font-weight: 700; }
  .cal-cell.start { border-radius: 5px 0 0 5px; }
  .cal-cell.end { border-radius: 0 5px 5px 0; }
  .cal-cell.start.end { border-radius: 5px; }

  #status { margin: var(--s5) 2px; color: var(--muted); min-height: 20px; font-size: 14.5px; display: flex; align-items: center; gap: 10px; }
  .spin { width: 15px; height: 15px; border: 2px solid var(--border); border-top-color: var(--navy); border-radius: 50%; animation: sp .7s linear infinite; }
  @keyframes sp { to { transform: rotate(360deg); } }

  /* ---- Results ---- */
  .results { margin-top: var(--s6); }
  .lead-metric { display: flex; align-items: baseline; gap: var(--s4); margin: 0 0 var(--s6); flex-wrap: wrap; }
  .lead-metric b { position: relative; font-size: 56px; font-weight: 700; color: var(--heading); line-height: 1;
    letter-spacing: -.03em; padding-bottom: 7px; }
  .lead-metric b::after { content: ""; position: absolute; left: 0; bottom: 0; width: 100%; height: 6px;
    background: var(--yellow); border-radius: 3px; }
  .lead-metric span { font-size: 15px; color: var(--muted); }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(158px, 1fr)); gap: var(--s3); margin: 0 0 var(--s6); }
  .stat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: var(--s4) var(--s5);
    box-shadow: var(--shadow-sm); transition: transform .12s, box-shadow .12s; }
  .stat:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
  .stat b { display: block; font-size: 32px; font-weight: 700; color: var(--heading); line-height: 1.05; }
  .stat span { color: var(--muted); font-size: 12.5px; }

  /* ---- Tabs ---- */
  .rhead { margin-bottom: var(--s2); }
  .tabs { display: flex; align-items: flex-end; gap: var(--s5); border-bottom: 1px solid var(--border); margin: var(--s6) 0 var(--s5); }
  .tab { position: relative; background: none; border: 0; padding: 0 2px var(--s3); font: 600 15px/1 var(--font);
    color: var(--muted); cursor: pointer; display: inline-flex; align-items: center; gap: 8px; margin-bottom: -1px; }
  .tab:hover { color: var(--heading); }
  .tab.active { color: var(--heading); }
  .tab.active::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: var(--navy); }
  .cbadge { font: 600 11px/1 var(--font); color: var(--muted); background: var(--sunk); border: 1px solid var(--border); border-radius: 5px; padding: 3px 8px; }
  .tab.active .cbadge { color: #fff; background: var(--navy); border-color: var(--navy); }
  .tabtools { margin-left: auto; display: flex; gap: var(--s2); padding-bottom: var(--s2); }
  .panel.hidden { display: none; }
  .warn { background: rgba(252,190,0,.12); border: 1px solid rgba(252,190,0,.45);
    color: var(--text); border-radius: var(--r-sm); padding: 11px 15px; font-size: 13.5px; margin-bottom: var(--s5); }
  .panel > section.group:first-child { margin-top: 0; }

  /* ---- Props chips ---- */
  .propshead { display: flex; align-items: center; justify-content: space-between; gap: var(--s4); flex-wrap: wrap; margin-bottom: var(--s5); }
  .propshead p { margin: 0; font-size: 14.5px; color: var(--text); }
  .propshead b { color: var(--heading); }
  .propslist { margin: 0; font-size: 14.5px; line-height: 1.85; color: var(--text); }

  /* ---- Empty state ---- */
  .empty { text-align: center; padding: var(--s8) var(--s5); }
  .empty img { width: 56px; height: 56px; opacity: .95; margin-bottom: var(--s4); }
  .empty h3 { margin: 0 0 var(--s2); font-size: 18px; color: var(--heading); font-weight: 700; }
  .empty p { margin: 0 auto; max-width: 48ch; font-size: 14.5px; color: var(--muted); line-height: 1.6; }


  .sources { padding: var(--s5) var(--s6); margin: 0 0 var(--s6); }
  .sources h2 { font-size: 20px; font-weight: 700; color: var(--heading); margin: 0 0 var(--s3); letter-spacing: -.01em; }
  .sources h2 em { font-style: normal; font-weight: 500; color: var(--muted); font-size: 13px; }
  .srcrow { display: flex; align-items: center; gap: var(--s3); padding: var(--s3) 0; border-top: 1px solid var(--border); }
  .srcrow:first-of-type { border-top: 0; }
  .srcrow a { flex: 1; word-break: break-word; font-size: 13.5px; font-weight: 500; }

  section.group { margin: var(--s7) 0 0; }
  section.group > h2 { font-size: 21px; font-weight: 700; color: var(--heading); letter-spacing: -.01em;
    border-bottom: 2px solid var(--border); padding-bottom: var(--s3); margin: 0 0 var(--s4); }
  section.group > h2 .who { font-size: 14px; }
  .grouplink { display: inline-flex; align-items: center; gap: 8px; color: var(--heading); }
  .grouplink svg { color: var(--muted); transition: color .12s; }
  .grouplink:hover { color: var(--accent); }
  .grouplink:hover svg { color: var(--accent); }
  h3.grp { font-size: 13px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted);
    margin: var(--s5) 0 var(--s2); }
  h3.grp .n { color: var(--muted); font-weight: 500; }
  ul.list { margin: var(--s2) 0; padding-left: 20px; }
  ul.list li { margin: 6px 0; }
  ul.list a, .ref, .srcrow a { font-weight: 600; }
  .ref { white-space: nowrap; }
  .tag { display: inline-block; background: var(--tagbg); color: var(--tagfg); border-radius: 5px;
    padding: 0 6px; font-size: 11px; font-weight: 600; margin-left: 4px; }
  .who { color: var(--muted); font-size: 13px; font-weight: 400; }
  .toolbar { display: flex; gap: var(--s3); margin: var(--s7) 0 0; flex-wrap: wrap; }
  details { margin-top: var(--s4); }
  summary { cursor: pointer; color: var(--muted); font-size: 13px; font-weight: 500; }
  pre { background: var(--sunk); border: 1px solid var(--border); border-radius: var(--r-sm);
    padding: var(--s4); overflow-x: auto; font-size: 12px; line-height: 1.55; margin-top: var(--s3); }
  .note { color: var(--muted); font-size: 13px; }

  /* ---- Footer ---- */
  .site-footer { border-top: 1px solid var(--border); color: var(--muted); font-size: 11px; line-height: 1.6; margin-top: var(--s8); }
  .site-footer .finner { max-width: 1120px; margin: 0 auto; padding: var(--s5); display: flex; align-items: center; justify-content: space-between; gap: var(--s5); }
  .site-footer .fleft { display: flex; flex-direction: column; gap: 2px; }
  .site-footer .fnote { opacity: .8; }
  .site-footer a { color: var(--muted); font-weight: 600; }
  .site-footer a:hover { color: var(--navy); }
  .site-footer .ficon { flex: none; display: inline-flex; color: var(--muted); }
  .site-footer .ficon:hover { color: var(--navy); }

  /* ---- Calendar disabled (no future dates) ---- */
  .cal-cell.disabled { color: var(--muted); opacity: .35; cursor: not-allowed; }
  .cal-cell.disabled:hover { background: none; }
  .cal-nav:disabled { opacity: .3; cursor: not-allowed; }
  .cal-nav:disabled:hover { background: var(--surface); }

  @media (max-width: 560px) {
    .bar { padding: 11px var(--s4); gap: var(--s2); }
    .divider, .product { display: none; }
    .logo svg { height: 20px; }
    .pills { margin-left: auto; }
    .pill { padding: 7px 11px; font-size: 12px; }
    .tabs { flex-wrap: wrap; gap: var(--s4); }
    .tabtools { width: 100%; margin-left: 0; flex-wrap: wrap; }
    .go .primary { flex: 1; }
  }
</style>
</head>
<body>
<header>
  <div class="bar">
    <a class="logo" href="https://unleash-wp.com" target="_blank" rel="noopener" aria-label="UnleashWP">${LOGO}</a>
    <span class="divider"></span>
    <a href="#" class="product" onclick="window.scrollTo({ top: 0, behavior: 'smooth' }); return false;">Release Helper</a>
    <div class="pills">
      <button class="pill" id="pillGh" onclick="toggleWizard()"><span class="ic"></span>GitHub</button>
      <button class="pill" id="pillTrac" onclick="toggleWizard()"><span class="ic"></span>Trac</button>
    </div>
  </div>
</header>
<div class="shell">
  <aside class="rail">
    <span class="rail-cap">Tools</span>
    <button type="button" class="tool active" aria-current="true">
      <span class="tool-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></span>
      <span class="tool-name">Changelog Generator</span>
    </button>
    <button type="button" class="tool is-more" disabled>
      <span class="tool-ic">+</span>
      <span class="tool-name">More soon</span>
    </button>
  </aside>
  <main>
    <div class="tool-head">
      <h1>Changelog Generator</h1>
      <p>Turn a date window into a ready release-post changelog for Core and Gutenberg.</p>
    </div>
    <section class="filters loading" id="filters">
    <div class="filters-loading"><span class="spin"></span> Loading milestones and branches…</div>
    <form class="query" id="f">
      <div class="qfields">
        <div class="rangewrap">
          <span class="flabel">Date range</span>
          <button type="button" class="rangebtn" id="rangebtn" aria-haspopup="true" aria-expanded="false"><span id="rangelabel">Pick dates</span></button>
          <div class="cal" id="cal" hidden>
            <div class="cal-presets" id="presets"></div>
            <div class="cal-head">
              <button type="button" class="cal-nav" id="calprev" aria-label="Previous month"></button>
              <div class="cal-title" id="caltitle"></div>
              <button type="button" class="cal-nav" id="calnext" aria-label="Next month"></button>
            </div>
            <div class="cal-dow"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>
            <div class="cal-grid" id="calgrid"></div>
          </div>
        </div>
        <label>Milestone<select id="milestone" class="branch-select mile-select"></select></label>
        <label>Gutenberg branch<select id="gbBranch" class="branch-select"></select></label>
        <label>Core branch<select id="coreBranch" class="branch-select"></select></label>
      </div>
      <div class="qactions">
        <div class="checks">
          <label><input type="checkbox" id="labels" checked> Group Gutenberg <span class="info" data-tip="Group Gutenberg changes by label (Bug, Feature). Off shows one flat list." onclick="event.preventDefault()">i</span></label>
          <label><input type="checkbox" id="devNotes" checked> Group Core <span class="info" data-tip="Group Core changes by component (Editor, REST API). Off shows one flat list." onclick="event.preventDefault()">i</span></label>
        </div>
        <div class="go"><button type="button" class="reset-link" onclick="resetFilters()">Reset</button><button class="primary" id="go" type="submit">Generate</button></div>
      </div>
    </form>
    </section>
  <section class="card wizard" id="wizard">
    <button class="wiz-close" type="button" onclick="closeWizard()" aria-label="Close setup">&times;</button>
    <h2>Setup</h2>
    <p class="lead">Two keys, once. Stored locally on this machine (owner-only file), sent only to the official GitHub / WordPress.org APIs. The same keys power <code>uwp --deep</code> on the CLI.</p>
    <div class="steps">
      <div class="step" id="stepGh">
        <div class="num"><span class="d">1</span></div>
        <div>
          <h3>GitHub <em>lifts the API limit from 60 to 5000 requests an hour</em></h3>
          <div id="ghConnected" class="connected" hidden></div>
          <div id="ghSetup">
            <p>One click if you have the <code>gh</code> CLI logged in; it is detected automatically. Otherwise paste a token (no scopes needed, public data only).</p>
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
          <h3>WordPress.org <em>only needed for “deep” (full ticket descriptions)</em></h3>
          <div id="tracConnected" class="connected" hidden></div>
          <div id="tracSetup">
            <p>Skip this for Beta-post counts. A web page can't read this cookie for you (it's HttpOnly), so paste it once and it auto-saves and tests the moment you paste.</p>
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

  <div id="status"></div>
  <div id="out" class="results"></div>
  </main>
</div>
<footer class="site-footer">
  <div class="finner">
    <div class="fleft">
      <span>&copy; <span id="year">2026</span> <a href="https://unleash-wp.com" target="_blank" rel="noopener">UnleashWP</a> · Benjamin Zekavica · data via <a href="https://github.com/Automattic/mcp-context-wporg" target="_blank" rel="noopener">Automattic mcp-context-wporg</a></span>
      <span class="fnote">Independent project, not affiliated with Automattic or the WordPress project.</span>
    </div>
    <a class="ficon" href="https://github.com/unleash-wp/wp-release-helper" target="_blank" rel="noopener" aria-label="Contribute on GitHub" title="Contribute on GitHub"><svg viewBox="0 0 16 16" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 012-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg></a>
  </div>
</footer>
<script>
var $ = function (id) { return document.getElementById(id); };
var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
  return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
// Render inline code spans in changelog summaries: escape HTML first, then turn
// backtick pairs into <code>. Build the backtick char via charCode so no literal
// backtick appears in the PAGE template literal (it would close the string).
var BT = String.fromCharCode(96);
var CODE_RE = new RegExp(BT + '([^' + BT + ']+)' + BT, 'g');
var codefmt = function (s) { return esc(s).replace(CODE_RE, '<code>$1</code>'); };
var GB = 'https://github.com/WordPress/gutenberg';
var TRAC = 'https://core.trac.wordpress.org';
var CORE_GH = 'https://github.com/WordPress/wordpress-develop';
// Inline icons for the results toolbar / tabs (16px, stroke = currentColor).
function svgIc(inner) { return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>'; }
var IC = {
  post: svgIc('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>'),
  md: svgIc('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  down: svgIc('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  link: svgIc('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
  list: svgIc('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),
  users: svgIc('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  clip: svgIc('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  ext: svgIc('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>')
};
var lastMarkdown = '', lastPost = '', rangeSince = '', rangeUntil = '';
var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(isoStr) { var p = isoStr.split('-'); return MON[(+p[1]) - 1] + ' ' + (+p[2]); }
function fmtRange(a, b) {
  var ya = a.split('-')[0], yb = b.split('-')[0];
  return ya === yb ? fmtDay(a) + ' to ' + fmtDay(b) + ', ' + ya
                   : fmtDay(a) + ', ' + ya + ' to ' + fmtDay(b) + ', ' + yb;
}

// ---- Date range picker (custom, dependency-free, works in every browser) ----
(function () {
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var view = new Date(today.getFullYear(), today.getMonth(), 1);
  var pendStart = null, hoverDay = null;
  var cal = $('cal'), grid = $('calgrid'), title = $('caltitle'), lbl = $('rangelabel'), btn = $('rangebtn');

  // default window: last 7 days
  var end0 = new Date(today), start0 = new Date(today); start0.setDate(start0.getDate() - 7);
  rangeSince = iso(start0); rangeUntil = iso(end0);
  view = new Date(end0.getFullYear(), end0.getMonth(), 1);

  function label() { lbl.textContent = (rangeSince && rangeUntil) ? fmtRange(rangeSince, rangeUntil) : 'Pick dates'; }
  function draw() {
    title.textContent = MON[view.getMonth()] + ' ' + view.getFullYear();
    $('calnext').disabled = view.getFullYear() > today.getFullYear() || (view.getFullYear() === today.getFullYear() && view.getMonth() >= today.getMonth());
    var startDow = new Date(view.getFullYear(), view.getMonth(), 1).getDay(); // Sunday-first (US)
    var days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    var s, e;
    if (pendStart) {
      if (hoverDay) { s = pendStart < hoverDay ? pendStart : hoverDay; e = pendStart < hoverDay ? hoverDay : pendStart; }
      else { s = pendStart; e = null; }
    } else { s = rangeSince; e = rangeUntil; }
    var tISO = iso(today), html = '';
    for (var i = 0; i < startDow; i++) html += '<button type="button" class="cal-cell empty" tabindex="-1"></button>';
    for (var day = 1; day <= days; day++) {
      var ds = view.getFullYear() + '-' + pad(view.getMonth() + 1) + '-' + pad(day), cls = 'cal-cell';
      if (ds > tISO) cls += ' disabled';
      if (ds === tISO) cls += ' today';
      if (s && e) { if (ds === s) cls += ' start'; if (ds === e) cls += ' end'; if (ds > s && ds < e) cls += ' inrange'; }
      else if (s && ds === s) cls += ' start end';
      html += '<button type="button" class="' + cls + '" data-d="' + ds + '">' + day + '</button>';
    }
    grid.innerHTML = html;
  }
  function open() { cal.hidden = false; btn.setAttribute('aria-expanded', 'true'); draw(); }
  function close() { cal.hidden = true; btn.setAttribute('aria-expanded', 'false'); pendStart = null; hoverDay = null; }

  btn.addEventListener('click', function (e) { e.stopPropagation(); if (cal.hidden) open(); else close(); });
  cal.addEventListener('click', function (e) { e.stopPropagation(); });
  $('calprev').addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); draw(); });
  $('calnext').addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); draw(); });
  grid.addEventListener('click', function (e) {
    var cell = e.target.closest ? e.target.closest('.cal-cell') : null;
    if (!cell || cell.className.indexOf('empty') !== -1 || cell.className.indexOf('disabled') !== -1) return;
    var ds = cell.getAttribute('data-d');
    if (!pendStart) { pendStart = ds; hoverDay = ds; draw(); }
    else {
      var a = pendStart, b = ds; if (b < a) { var t = a; a = b; b = t; }
      rangeSince = a; rangeUntil = b; pendStart = null; hoverDay = null; label(); close();
    }
  });
  grid.addEventListener('mouseover', function (e) {
    if (!pendStart) return;
    var cell = e.target && e.target.closest ? e.target.closest('.cal-cell') : null;
    if (!cell || cell.className.indexOf('empty') !== -1 || cell.className.indexOf('disabled') !== -1) return;
    var d = cell.getAttribute('data-d');
    if (d !== hoverDay) { hoverDay = d; draw(); }
  });
  grid.addEventListener('mouseleave', function () { if (pendStart && hoverDay !== pendStart) { hoverDay = pendStart; draw(); } });
  var presets = [['7 days', 7], ['14 days', 14], ['30 days', 30]];
  $('presets').innerHTML = presets.map(function (p) { return '<button type="button" class="preset" data-n="' + p[1] + '">' + p[0] + '</button>'; }).join('');
  $('presets').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.preset') : null; if (!b) return;
    var n = +b.getAttribute('data-n'), ed = new Date(today), sd = new Date(today); sd.setDate(sd.getDate() - n);
    rangeSince = iso(sd); rangeUntil = iso(ed); pendStart = null;
    view = new Date(ed.getFullYear(), ed.getMonth(), 1); label(); close();
  });
  document.addEventListener('click', function () { if (!cal.hidden) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !cal.hidden) close(); });
  label();
})();

// ---- Setup wizard ----
function openWizard() { $('wizard').classList.add('open'); $('wizard').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function closeWizard() { $('wizard').classList.remove('open'); }
function toggleWizard() { if ($('wizard').classList.contains('open')) closeWizard(); else openWizard(); }
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeWizard(); });

function resetFilters() {
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var isoD = function (x) { return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
  var d = new Date(), s = new Date(d); s.setDate(s.getDate() - 7);
  rangeSince = isoD(s); rangeUntil = isoD(d);
  $('rangelabel').textContent = fmtRange(rangeSince, rangeUntil);
  if ($('milestone').options.length) $('milestone').selectedIndex = 0;
  syncGbToMilestone(); $('coreBranch').value = 'trunk';
  $('labels').checked = true; $('devNotes').checked = true;
  $('status').textContent = ''; $('out').innerHTML = emptyState();
}
function setPill(id, set, source) {
  var el = $(id); el.className = 'pill ' + (set ? 'ok' : 'off');
  el.innerHTML = '<span class="ic"></span>' + (id === 'pillGh' ? 'GitHub' : 'Trac');
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
    labels: $('labels').checked, devNotes: $('devNotes').checked, deep: 'true',
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
  var changes = (t.gutenbergPRs || 0) + (t.coreChangesets || 0);
  var all = uniq((report.gutenberg.contributors || []).concat(report.core.contributors || []))
    .sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
  window._propsLine = all.join(', ');

  var h = '<div class="rhead"><div class="lead-metric"><b class="tnum">' + issues +
    '</b><span>issues addressed, ' + esc(fmtRange(rangeSince, rangeUntil)) + '</span></div>';
  var stat = function (n, l) { return '<div class="stat"><b class="tnum">' + n + '</b><span>' + l + '</span></div>'; };
  h += '<div class="stats">' + stat(t.gutenbergPRs, 'Gutenberg PRs') + stat(t.gutenbergCommits, 'GB commits') +
    stat(t.coreChangesets, 'Core changesets') + stat(t.coreTickets, 'Core tickets') +
    stat(t.contributors, 'Contributors') + '</div></div>';

  if (meta.deepError) h += '<div class="warn">Deep descriptions skipped (' + esc(meta.deepError) +
    '). Showing the cookie-free changelog. Save a fresh wordpress.org cookie in Setup for full descriptions.</div>';

  h += '<div class="tabs" role="tablist">' +
    '<button class="tab active" data-tab="changelog">' + IC.list + 'Changelog<span class="cbadge">' + changes + '</span></button>' +
    '<button class="tab" data-tab="props">' + IC.users + 'Props<span class="cbadge">' + all.length + '</span></button>' +
    '<div class="tabtools">' +
      '<button class="ghost sm" onclick="copyPost()">' + IC.post + 'Copy post</button>' +
      '<button class="ghost sm" onclick="copyMd()">' + IC.md + 'Copy Markdown</button>' +
      '<button class="ghost sm" onclick="downloadMd()">' + IC.down + 'Download</button>' +
    '</div></div>';

  var cl = '';
  var s = data.sources || {};
  if (data.sources) {
    var mile = s.milestone ? ' (milestone ' + esc(s.milestone) + ')' : '';
    cl += '<section class="card sources"><h2>Sources <em>link these in the post so anyone can verify</em></h2>' +
      srcRow(s.trac, 'Closed Core Trac tickets' + mile + ', ' + esc(s.since) + ' to ' + esc(s.until)) +
      srcRow(s.gutenberg, 'Gutenberg commits on ' + esc(s.gbBranch) + ', ' + esc(s.since) + ' to ' + esc(s.until)) +
      '</section>';
  }
  cl += '<section class="group">' + groupHead('Gutenberg', s.gutenberg, meta.gbBranch);
  if (report.gutenberg.byCategory) sortGroups(report.gutenberg.byCategory).forEach(function (g) { cl += gbGroup(g[0], g[1]); });
  else cl += '<ul class="list">' + report.gutenberg.commits.map(gbItem).join('') + '</ul>';
  cl += '</section>';
  cl += '<section class="group">' + groupHead('Core', s.trac, meta.coreBranch);
  if (report.core.tracker) {
    cl += '<p class="note">Grouped via <code>' + esc(report.core.tracker.slug) + '</code> dev-notes tracker.</p>';
    sortGroups(report.core.byComponent, true).forEach(function (g) { cl += coreGroup(g[0], g[1]); });
  } else {
    if (meta.trackerMissing) cl += '<p class="note">No dev-notes tracker for this milestone. Core stays ungrouped.</p>';
    cl += '<ul class="list">' + report.core.commits.map(coreItem).join('') + '</ul>';
  }
  cl += '</section>';
  cl += '<details><summary>Post template</summary><pre>' + esc(lastPost) + '</pre></details>';
  cl += '<details><summary>Raw Markdown</summary><pre>' + esc(lastMarkdown) + '</pre></details>';
  h += '<div class="panel" id="p-changelog">' + cl + '</div>';

  var pv = '<div class="propshead"><p>Props to <b>' + all.length + '</b> contributors for this window.</p>' +
    '<button class="ghost sm" onclick="copyProps()">' + IC.clip + 'Copy props line</button></div>';
  pv += '<p class="propslist">' + all.map(esc).join(', ') + '</p>';
  h += '<div class="panel hidden" id="p-props">' + pv + '</div>';

  $('out').innerHTML = h;
}

// Section heading that links to the same source URL as the Sources block, so the
// list visibly points back at the real GitHub / Trac query it was built from.
function groupHead(label, url, who) {
  var inner = url ? '<a class="grouplink" href="' + esc(url) + '" target="_blank" rel="noopener">' + label + IC.ext + '</a>' : label;
  return '<h2>' + inner + ' <span class="who">(' + esc(who) + ')</span></h2>';
}
function srcRow(url, text) {
  return '<div class="srcrow"><a href="' + esc(url) + '" target="_blank" rel="noopener">' + text + '</a>' +
    '<button class="ghost sm" onclick="copyText(this.dataset.u)" data-u="' + esc(url) + '">' + IC.link + 'Copy link</button></div>';
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
  var ref = c.pr
    ? '<a class="ref" href="' + GB + '/pull/' + c.pr + '" target="_blank" rel="noopener">#' + c.pr + '</a>'
    : (c.sha ? '<a class="ref" href="' + GB + '/commit/' + c.sha + '" target="_blank" rel="noopener">' + esc(c.shortSha) + '</a>' : '');
  return '<li>' + codefmt(c.subject) + (ref ? ' ' + ref : '') + ' <span class="who">' + esc(c.author) + '</span></li>';
}
function coreGroup(comp, items) { return '<h3 class="grp">' + esc(comp) + ' <span class="n">(' + items.length + ')</span></h3><ul class="list">' + items.map(coreItem).join('') + '</ul>'; }
function coreItem(c) {
  var ref = c.changeset
    ? '<a class="ref" href="' + TRAC + '/changeset/' + c.changeset + '" target="_blank" rel="noopener">r' + c.changeset + '</a>'
    : (c.sha ? '<a class="ref" href="' + CORE_GH + '/commit/' + c.sha + '" target="_blank" rel="noopener">' + esc(c.shortSha) + '</a>' : esc(c.shortSha));
  var tix = (c.tickets || []).map(function (n) { return '<a class="ref" href="' + TRAC + '/ticket/' + n + '" target="_blank" rel="noopener">#' + n + '</a>'; }).join(' ');
  var cls = c.classification ? ' <span class="tag">' + esc(c.classification) + '</span>' : '';
  var props = c.props && c.props.length ? ' <span class="who">props ' + esc(c.props.join(', ')) + '</span>' : '';
  return '<li>' + ref + ': ' + codefmt(c.subject) + cls + (tix ? ' ' + tix : '') + props + '</li>';
}
function copyText(s) { navigator.clipboard.writeText(s); }
function copyPost() { navigator.clipboard.writeText(lastPost); }
function copyMd() { navigator.clipboard.writeText(lastMarkdown); }
function copyProps() { navigator.clipboard.writeText(window._propsLine || ''); }
function downloadMd() {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lastMarkdown], { type: 'text/markdown' }));
  a.download = 'changelog.md'; a.click();
}

// Tab switching (delegated, survives re-render)
document.addEventListener('click', function (e) {
  var tab = e.target && e.target.closest ? e.target.closest('.tab') : null;
  if (!tab) return;
  var name = tab.getAttribute('data-tab');
  var tabs = document.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i] === tab);
  var panels = document.querySelectorAll('.panel');
  for (var j = 0; j < panels.length; j++) panels[j].classList.toggle('hidden', panels[j].id !== 'p-' + name);
});

function emptyState() {
  return '<div class="empty"><img src="/brand/bulb.svg" alt=""><h3>No changelog yet</h3>' +
    '<p>Pick a date range and a milestone, then Generate. You get the counts, the source links, ' +
    'the grouped changelog, and the props.</p></div>';
}

// Searchable branch pickers (branches fetched live from GitHub)
// Populate the milestone + branch <select>s from GitHub (branches drive both).
function fillSelect(sel, list, preferred) {
  sel.innerHTML = list.map(function (b) { return '<option value="' + esc(b) + '">' + esc(b) + '</option>'; }).join('');
  if (preferred && list.indexOf(preferred) !== -1) sel.value = preferred;
}
function syncGbToMilestone() {
  var want = 'wp/' + $('milestone').value, sel = $('gbBranch');
  for (var i = 0; i < sel.options.length; i++) { if (sel.options[i].value === want) { sel.value = want; return; } }
}
(function loadBranches() {
  var gb = fetch('/api/branches?repo=gutenberg').then(function (r) { return r.json(); }).then(function (d) {
    var list = d.branches || [], versions = [];
    list.forEach(function (b) { if (b.indexOf('wp/') === 0) { var v = b.slice(3); if (/^[0-9]+[.][0-9]+$/.test(v) && versions.indexOf(v) === -1) versions.push(v); } });
    fillSelect($('gbBranch'), list.slice(0, 80), null);
    fillSelect($('milestone'), versions, null);
    if (versions.length) $('milestone').value = versions[0];
    syncGbToMilestone();
  }).catch(function () {});
  var core = fetch('/api/branches?repo=core').then(function (r) { return r.json(); }).then(function (d) {
    fillSelect($('coreBranch'), (d.branches || []).slice(0, 80), 'trunk');
  }).catch(function () {});
  // Reveal the search form only once both pickers are populated (spinner until then).
  Promise.all([gb, core]).then(function () { $('filters').classList.remove('loading'); });
})();
$('milestone').addEventListener('change', syncGbToMilestone);

(function () { var y = $('year'); if (y) y.textContent = new Date().getFullYear(); })();
(function () { // pin the tool rail just under the sticky header; shadow the header on scroll
  var header = document.querySelector('header'), rail = document.querySelector('.rail');
  function place() { if (rail) rail.style.top = (header.offsetHeight + 12) + 'px'; }
  function onScroll() { header.classList.toggle('scrolled', window.scrollY > 4); }
  window.addEventListener('resize', place);
  window.addEventListener('scroll', onScroll, { passive: true });
  place(); onScroll();
})();

$('out').innerHTML = emptyState();

refreshStatus();
</script>
</body>
</html>`;
