import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg=JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
const oauthStart=readFileSync(new URL("../netlify/functions/canva-oauth-start.mts",import.meta.url),"utf8");
const oauthCallback=readFileSync(new URL("../netlify/functions/canva-oauth-callback.mts",import.meta.url),"utf8");
const client=readFileSync(new URL("../netlify/functions/canva-mcp-client.mts",import.meta.url),"utf8");
const capture=readFileSync(new URL("../netlify/functions/canva-mcp-capture.mts",import.meta.url),"utf8");

test("Canva adapter uses the remote MCP service",()=>{
  assert.ok(pkg.dependencies["@modelcontextprotocol/client"]);
  assert.match(oauthStart,/https:\/\/mcp\.canva\.com\/authorize/);
  assert.match(oauthCallback,/https:\/\/mcp\.canva\.com\/token/);
  assert.match(client,/https:\/\/mcp\.canva\.com\/mcp/);
  assert.doesNotMatch(oauthStart,/www\.canva\.com\/api\/oauth\/authorize/);
  assert.doesNotMatch(oauthCallback,/api\.canva\.com\/rest\/v1\/oauth\/token/);
});

test("authoritative capture resolves shortlinks before reading design content",()=>{
  assert.match(capture,/"resolve-shortlink"/);
  assert.match(capture,/"get-design-content"/);
  assert.match(capture,/capture_method:"canva_remote_mcp"/);
  assert.match(capture,/validateCanvaCapture/);
});

test("Canva OAuth configuration is runtime-only",()=>{
  assert.match(oauthStart,/CANVA_MCP_CLIENT_ID/);
  assert.match(oauthCallback,/CANVA_MCP_CLIENT_SECRET/);
  assert.doesNotMatch(oauthStart,/clientId\s*=\s*"[^"]+"/);
  assert.doesNotMatch(oauthCallback,/clientSecret\s*=\s*"[^"]+"/);
});
