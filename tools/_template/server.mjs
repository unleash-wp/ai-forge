// Optional server side. A tool can add backend routes by exporting `routes`.
// Each handler gets (req, res, url, ctx). The ctx gives you:
//   ctx.json(res, status, obj)  - send a JSON response
//   ctx.query                   - URLSearchParams from the request URL
//   await ctx.body()            - parse the request's JSON body (POST/PUT)
// Import shared logic from ../../src/ as needed. Delete this file if your tool
// is client-only. Namespace your paths (/api/<your-id>/...) to avoid clashes.
async function hello(req, res, url, ctx) {
  const who = ctx.query.get('who') || 'world';
  ctx.json(res, 200, { hello: who });
}

export const routes = [
  { method: 'GET', path: '/api/my-tool/hello', handler: hello },
];
