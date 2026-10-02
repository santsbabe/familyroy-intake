import type { Config } from "@netlify/functions";
import { buildRecord,ROUTES } from "./core.mjs";
const esc=(s:any)=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
function check(name:string,pass:boolean,details:any={}){return{name,pass,...details};}
export default async()=>{
 if(Netlify.context?.deploy?.context==="production")return new Response("Not Found",{status:404});
 const results:any[]=[];
 const a=buildRecord({source_chat:"PNPS Parents",text:"Alexander: homework is revise klanke. Bring library bag on Friday."});
 results.push(check("PNPS multi-route",a.routes.includes(ROUTES.SCHOOL_HOMEWORK)&&a.routes.includes(ROUTES.SCHOOL_READINESS)&&a.routes.includes(ROUTES.EVENTS)&&a.extracted.children.includes("Alexander"),{routes:a.routes,children:a.extracted.children}));
 const b=buildRecord({source_chat:"100 Acre Wood",text:"Please bring the permission form tomorrow"});
 results.push(check("HAW → Imogen",b.routes.includes(ROUTES.SCHOOL_READINESS)&&b.extracted.children.includes("Imogen"),{routes:b.routes,children:b.extracted.children}));
 const c=buildRecord({source_chat:"PNPS",text:"Civvies on Friday"});
 results.push(check("PNPS does not guess child",c.routes.includes(ROUTES.SCHOOL_READINESS)&&c.routes.includes(ROUTES.EVENTS)&&c.extracted.children.length===0,{routes:c.routes,children:c.extracted.children}));
 const d=buildRecord({text:"This looks useful"});
 results.push(check("Ambiguous → review",d.routes.length===1&&d.routes[0]===ROUTES.REVIEW,{routes:d.routes}));
 const e=buildRecord({source_chat:"PNPS",text:"Parents may buy raffle tickets, but please return Alexander's consent form on Friday."});
 results.push(check("Optional + mandatory notice",e.routes.includes(ROUTES.SCHOOL_READINESS)&&e.extracted.children.includes("Alexander"),{routes:e.routes,children:e.extracted.children}));
 const f=buildRecord({source_chat:"PNPS",text:"Please complete the school fee payment form by Friday."});
 results.push(check("School fee admin excluded from readiness",!f.routes.includes(ROUTES.SCHOOL_READINESS),{routes:f.routes}));
 const g=buildRecord({source_chat:"PNPS",text:"PNPS: Alexander homework is revise klanke. Bring library bag on Friday."});
 results.push(check("Mixed share fan-out",g.routes.includes(ROUTES.SCHOOL_HOMEWORK)&&g.routes.includes(ROUTES.SCHOOL_READINESS)&&g.routes.includes(ROUTES.EVENTS),{routes:g.routes}));
 const tokenPresent=!!Netlify.env.get("FAMILYROY_INTAKE_TOKEN");
 results.push(check("Preview intake secret available to functions",tokenPresent));
 const ok=results.every(x=>x.pass);
 const rows=results.map(x=>`<section class="${x.pass?"ok":"bad"}"><h3>${x.pass?"✓":"✗"} ${esc(x.name)}</h3><pre>${esc(JSON.stringify(x,null,2))}</pre></section>`).join("");
 const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>FamilyRoy Acceptance Results</title><style>body{font:16px system-ui;max-width:760px;margin:32px auto;padding:0 18px}.ok h3{color:#087830}.bad h3{color:#b00020}pre{white-space:pre-wrap;background:#f4f4f4;padding:12px;border-radius:10px}</style></head><body><h1>${ok?"✓ ROUTER TESTS PASSED":"✗ TESTS FAILED"}</h1><p>Deploy Preview only · production untouched.</p>${rows}<p><strong>Next gate:</strong> destination handoff acceptance: one routed source must arrive once in each intended consumer without exposing the Intake master credential.</p></body></html>`;
 return new Response(html,{status:ok?200:500,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
};
export const config:Config={path:"/acceptance-results"};