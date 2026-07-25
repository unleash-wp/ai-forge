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

// Terminal commands: export `commands` and `uwp <name> …` runs your tool from
// the CLI - great for scripting or feeding data to Claude Code / Codex. Each
// gets (args, ctx); args is the parsed flags (args._ holds positionals), ctx is
// { log, error }. Print your result with ctx.log. Delete if you have no CLI.
export const commands = [
  {
    name: 'my-tool',
    summary: 'What this command prints (shown in `uwp -h`).',
    run: async (args, ctx) => {
      ctx.log(JSON.stringify({ ok: true, args: args._ }, null, 2));
    },
  },
];

// MCP tools: export `mcpTools` and `uwp mcp` serves them over stdio, so Claude
// Code / Codex can call your tool live. Each has a JSON-Schema `inputSchema`;
// `run(args)` returns a string (or any value, JSON-stringified). Delete if your
// tool has nothing for the agents to query.
export const mcpTools = [
  {
    name: 'my_tool_echo',
    description: 'Echo back the given text.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: 'Text to echo' } },
      required: ['text'],
    },
    run: async (args) => `you said: ${args.text}`,
  },
];
