// Optional server side. A tool can add backend routes by exporting `routes`.
// Each handler gets (req, res, url, ctx); reply with ctx.json(res, status, obj).
// Import shared logic from ../../src/ as needed. Delete this file if your tool
// is client-only. Namespace your paths (/api/<your-id>/...) to avoid clashes.
async function hello(req, res, url, ctx) {
  ctx.json(res, 200, { hello: 'from your tool' });
}

export const routes = [
  { method: 'GET', path: '/api/my-tool/hello', handler: hello },
];
