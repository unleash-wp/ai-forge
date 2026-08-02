// MCP App: serve the full Forge React app as a ui:// resource that renders in a
// sandboxed iframe (Claude Desktop / Codex). No browser is involved. The app is unchanged:
// `uwp mcp` starts the existing HTTP server internally on a loopback port, and
// the iframe routes its /api calls through the `forge_api` tool over postMessage.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { once } from 'node:events';
import { startServer } from './server.mjs';
import { FONT_FACE_CSS } from './fonts.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(DIR, '..', 'dist', 'main.js');

// Start the existing HTTP server on an ephemeral loopback port, quietly (stdout
// is reserved for JSON-RPC). Resolves the chosen port.
export async function startInternalServer() {
  // internal:true blocks the credential/install/self-update routes. This server
  // is reachable only through the forge_api proxy, which the model can reach on
  // hosts that don't enforce the tool's app-only visibility.
  const server = startServer({ bind: { host: '127.0.0.1', port: 0 }, quiet: true, internal: true });
  await once(server, 'listening');
  return { port: server.address().port, server };
}

// The iframe bridge (vanilla, runs before the app): does the MCP Apps handshake,
// applies the host theme, and patches fetch so every /api call is proxied through
// the forge_api tool instead of hitting a (nonexistent) same-origin server.
const BRIDGE = `(function(){
  var nextId=1, pending={}, readyResolve, ready=new Promise(function(r){readyResolve=r;});
  function rpc(method,params,want){var id=want?nextId++:undefined;window.parent.postMessage({jsonrpc:"2.0",id:id,method:method,params:params||{}},"*");if(want)return new Promise(function(res){pending[id]=res;});}
  window.addEventListener("message",function(e){var m=e.data;if(!m||m.jsonrpc!=="2.0")return;if(m.id!=null&&pending[m.id]){var r=pending[m.id];delete pending[m.id];r(m.result);}});
  rpc("ui/initialize",{protocolVersion:"2026-01-26",capabilities:{},clientInfo:{name:"UnleashWP AI Forge",version:"1.0.0"}},true).then(function(res){var v=res&&res.hostContext&&res.hostContext.styles&&res.hostContext.styles.variables;if(v)for(var k in v)document.documentElement.style.setProperty(k,v[k]);rpc("ui/notifications/initialized",{});readyResolve();});
  var orig=window.fetch?window.fetch.bind(window):null;
  window.fetch=function(input,init){var url=typeof input==="string"?input:(input&&input.url);init=init||{};
    if(url&&String(url).indexOf("/api")===0){
      return ready.then(function(){return rpc("tools/call",{name:"forge_api",arguments:{method:init.method||"GET",path:String(url),body:init.body!=null?String(init.body):null}},true);}).then(function(result){
        var s=(result&&result.structuredContent)||{status:502,body:"{}",contentType:"application/json"};
        return new Response(s.body,{status:s.status||200,headers:{"Content-Type":s.contentType||"application/json"}});
      });
    }
    return orig?orig(input,init):Promise.reject(new Error("fetch blocked in MCP app"));
  };
})();`;

// Is the built bundle present? (Published packages ship dist/; dev needs a build.)
export function appAvailable() { return existsSync(BUNDLE); }

// The ui:// resource HTML: app shell + bridge + the inlined production bundle.
export function forgeAppHtml() {
  const bundle = readFileSync(BUNDLE, 'utf8');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>UnleashWP AI Forge</title><style>${FONT_FACE_CSS}</style></head><body><div id="root"></div><script>${BRIDGE}</script><script>${bundle}</script></body></html>`;
}
