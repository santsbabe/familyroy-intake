import test from "node:test";
import assert from "node:assert/strict";

function decode(s){return s.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#x27;/g,"'").replace(/&nbsp;/g," ");}
function visibleText(html){return decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim());}

test("public Canva share resolves and loads, while content extraction is handled by authenticated MCP", {skip: process.env.CONTEXT !== "deploy-preview", timeout: 15000}, async()=>{
  const short="https://canva.link/3nwbztf04kapaai";
  const first=await fetch(short,{redirect:"manual",headers:{"user-agent":"Mozilla/5.0 FamilyRoy-QA/1.0"}});
  const location=first.headers.get("location");
  assert.ok(location,"Canva shortlink did not return a redirect");
  const resolved=new URL(location,short);
  assert.ok(["canva.com","www.canva.com"].includes(resolved.hostname),"Canva shortlink redirected outside Canva");
  const page=await fetch(resolved,{redirect:"follow",headers:{"user-agent":"Mozilla/5.0 FamilyRoy-QA/1.0","accept":"text/html,application/xhtml+xml"}});
  assert.equal(page.ok,true,"Canva public page was not fetchable");
  const text=visibleText(await page.text());
  assert.ok(/Newsletter 8|Triple J|Bike Bus|Study Skills/i.test(text),"Public Canva HTML did not expose known newsletter body text");
});
