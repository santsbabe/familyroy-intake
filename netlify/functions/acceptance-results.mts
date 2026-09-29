import type { Config } from "@netlify/functions";
async function run(origin:string){const r=await fetch(origin+"/acceptance");let data:any;try{data=await r.json()}catch{data={ok:false,results:[{name:"Acceptance runner returned non-JSON",pass:false,status:r.status}]}};return data;}
const esc=(s:any)=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
export default async(req:Request)=>{
 if(Netlify.context?.deploy?.context==="production")return new Response("Not Found",{status:404});
 const data=await run(new URL(req.url).origin);const results=Array.isArray(data.results)?data.results:[];
 const rows=results.map((x:any)=>`<section class="${x.pass?"ok":"bad"}"><h3>${x.pass?"✓":"✗"} ${esc(x.name)}</h3><pre>${esc(JSON.stringify(x,null,2))}</pre></section>`).join("");
 const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>FamilyRoy Acceptance Results</title><style>body{font:16px system-ui;max-width:760px;margin:32px auto;padding:0 18px}.ok h3{color:#087830}.bad h3{color:#b00020}pre{white-space:pre-wrap;background:#f4f4f4;padding:12px;border-radius:10px}a{display:inline-block;margin:12px 0}</style></head><body><h1>${data.ok?"✓ ALL TESTS PASSED":"✗ TESTS FAILED"}</h1><p>Deploy Preview only · production untouched.</p>${rows}<p><a href="/acceptance-test">Run again</a></p></body></html>`;
 return new Response(html,{status:data.ok?200:500,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
};
export const config:Config={path:"/acceptance-results"};