import type { Config } from "@netlify/functions";
export default async () => {
 if (Netlify.context?.deploy?.context === "production") return new Response("Not Found",{status:404});
 const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>FamilyRoy Preview Acceptance</title><style>body{font:16px system-ui;max-width:760px;margin:40px auto;padding:0 18px}a{display:inline-block;font:inherit;padding:14px 20px;border-radius:12px;background:#eee;text-decoration:none}code{background:#f4f4f4;padding:2px 5px;border-radius:5px}</style></head><body><h1>FamilyRoy Preview Acceptance</h1><p>Tests this Deploy Preview only. No family data is used and the intake token is never sent to the browser.</p><p><a href="/acceptance-results">Run acceptance tests</a></p><p><small>Server-side runner · preview only</small></p></body></html>`;
 return new Response(html,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
};
export const config:Config={path:"/acceptance-test"};