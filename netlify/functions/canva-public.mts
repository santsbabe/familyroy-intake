import type { Config } from "@netlify/functions";

function allowed(value:string){
  try{const u=new URL(value);return u.protocol==="https:"&&(u.hostname==="canva.link"||u.hostname==="canva.com"||u.hostname==="www.canva.com");}
  catch{return false;}
}
function decode(s:string){return s.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#x27;/g,"'").replace(/&nbsp;/g," ");}
function visibleText(html:string){
  return decode(html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/\s+/g," ")
    .trim()).slice(0,500000);
}
async function resolveCanva(url:string){
  if(!allowed(url))throw new Error("invalid_canva_url");
  if(!new URL(url).hostname.endsWith("canva.link"))return url;
  const r=await fetch(url,{method:"GET",redirect:"manual",headers:{"user-agent":"FamilyRoy/1.0"}});
  const location=r.headers.get("location");
  if(!location)throw new Error("shortlink_no_redirect");
  const resolved=new URL(location,url).toString();
  if(!allowed(resolved)||!["canva.com","www.canva.com"].includes(new URL(resolved).hostname))throw new Error("unsafe_redirect");
  return resolved;
}
export default async(req:Request)=>{
  if(req.method!=="POST")return new Response("Method Not Allowed",{status:405,headers:{Allow:"POST"}});
  const expected=process.env.FAMILYROY_INTAKE_TOKEN;
  if(expected&&(req.headers.get("authorization")||"")!=="Bearer "+expected)return Response.json({ok:false,error:"unauthorized"},{status:401});
  let body:any;try{body=await req.json();}catch{return Response.json({ok:false,error:"invalid_json"},{status:400});}
  const original=String(body?.url||"");
  try{
    const resolved=await resolveCanva(original);
    const r=await fetch(resolved,{redirect:"follow",headers:{"user-agent":"Mozilla/5.0 FamilyRoy/1.0","accept":"text/html,application/xhtml+xml"}});
    if(!r.ok)return Response.json({ok:false,error:"canva_fetch_failed",status:r.status,resolved_url:resolved},{status:502});
    const html=await r.text();
    const text=visibleText(html);
    return Response.json({ok:true,original_url:original,resolved_url:resolved,text,text_length:text.length,usable:text.length>=200,captured_at:new Date().toISOString()});
  }catch(e:any){return Response.json({ok:false,error:e?.message||"canva_resolve_failed"},{status:400});}
};
export const config: Config={path:"/canva-public"};
