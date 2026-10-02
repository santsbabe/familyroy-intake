import type { Config } from "@netlify/functions";
import { getStore,getDeployStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";
import { ROUTES } from "./core.mjs";
import { newCapability,handoffKey,createHandoffRecord,handoffState,validCapability,allowedOrigin,canAcknowledge,preflightOriginAllowed } from "./handoff-core.mjs";

const ALLOWED=new Set([ROUTES.SCHOOL_HOMEWORK,ROUTES.SCHOOL_READINESS]);
function storeForEnvironment(){return Netlify.context?.deploy?.context==="production"?getStore("familyroy-intake",{consistency:"strong"}):getDeployStore("familyroy-intake");}
function masterAuthorised(req:Request){const expected=Netlify.env.get("FAMILYROY_INTAKE_TOKEN")||"";const supplied=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");if(!expected||!supplied)return false;const a=Buffer.from(expected),b=Buffer.from(supplied);return a.length===b.length&&timingSafeEqual(a,b);}
function routeKey(route:string){return route.replace(/[^a-z0-9._-]/gi,"_");}
function cors(route:string,req:Request){const origin=req.headers.get("origin")||"",configured=allowedOrigin(route,{FAMILYROY_CONTROL_CENTRE_ORIGIN:Netlify.env.get("FAMILYROY_CONTROL_CENTRE_ORIGIN")||"",FAMILYROY_HOMEWORK_ORIGIN:Netlify.env.get("FAMILYROY_HOMEWORK_ORIGIN")||""});return configured&&origin===configured?{"access-control-allow-origin":configured,"vary":"Origin","cache-control":"no-store"}:{"cache-control":"no-store"};}
async function loadOutbox(store:any,route:string,sourceId:string){return await store.get(`outbox/${routeKey(route)}/${sourceId}.json`,{type:"json"});}
export default async(req:Request)=>{
 const store=storeForEnvironment(),url=new URL(req.url);
 if(req.method==="POST"&&masterAuthorised(req)){
   let body:any;try{body=await req.json();}catch{return Response.json({ok:false,error:"invalid_json"},{status:400});}
   const route=String(body?.route||""),sourceId=String(body?.source_id||"");
   if(!ALLOWED.has(route))return Response.json({ok:false,error:"invalid_route"},{status:400});
   if(!/^[a-f0-9]{64}$/i.test(sourceId))return Response.json({ok:false,error:"invalid_source_id"},{status:422});
   const outbox:any=await loadOutbox(store,route,sourceId);if(!outbox)return Response.json({ok:false,error:"not_found"},{status:404});
   if(outbox.status==="consumed")return Response.json({ok:false,error:"already_consumed"},{status:409});
   const token=newCapability(),record=createHandoffRecord({token,route,source_id:sourceId});
   await store.setJSON(handoffKey(token),record);
   return Response.json({ok:true,route,source_id:sourceId,capability:token,expires_at:record.expires_at},{status:201,headers:{"cache-control":"no-store"}});
 }
 if(req.method==="OPTIONS"){
   const origin=req.headers.get("origin")||"",env={FAMILYROY_CONTROL_CENTRE_ORIGIN:Netlify.env.get("FAMILYROY_CONTROL_CENTRE_ORIGIN")||"",FAMILYROY_HOMEWORK_ORIGIN:Netlify.env.get("FAMILYROY_HOMEWORK_ORIGIN")||""};
   if(!preflightOriginAllowed(origin,env))return new Response(null,{status:403,headers:{"cache-control":"no-store","vary":"Origin"}});
   return new Response(null,{status:204,headers:{"access-control-allow-origin":origin,"access-control-allow-methods":"GET, POST, OPTIONS","access-control-allow-headers":"authorization, content-type","vary":"Origin","cache-control":"no-store"}});
 }
 const token=(req.headers.get("authorization")||"").replace(/^Handoff\\s+/i,"");
 if(!validCapability(token))return Response.json({ok:false,error:"invalid_capability"},{status:422,headers:{"cache-control":"no-store"}});
 const key=handoffKey(token),record:any=await store.get(key,{type:"json"}),state=handoffState(record);
 if(state==="missing")return Response.json({ok:false,error:"not_found"},{status:404,headers:{"cache-control":"no-store"}});
 const headers=cors(record.route,req);
 if(!headers["access-control-allow-origin"]&&req.headers.get("origin"))return Response.json({ok:false,error:"origin_not_allowed"},{status:403,headers});
 if(state==="expired")return Response.json({ok:false,error:"expired"},{status:410,headers});
 if(state==="acknowledged")return Response.json({ok:true,duplicate:true,status:"acknowledged",route:record.route,source_id:record.source_id,recovery:"already_delivered"},{headers});
 const outbox:any=await loadOutbox(store,record.route,record.source_id);
 if(!outbox)return Response.json({ok:false,error:"source_missing"},{status:404,headers});
 if(outbox.status==="consumed"){record.status="acknowledged";record.acknowledged_at=outbox.consumed_at||new Date().toISOString();await store.setJSON(key,record);return Response.json({ok:true,duplicate:true,status:"acknowledged",route:record.route,source_id:record.source_id},{headers});}
 if(req.method==="GET"){
   if(record.status!=="redeemed"){record.status="redeemed";record.redeemed_at=new Date().toISOString();await store.setJSON(key,record);}
   return Response.json({ok:true,status:"redeemed",route:record.route,source_id:record.source_id,payload:outbox.payload,expires_at:record.expires_at,recovery:"ack_after_durable_ingest"},{headers});
 }
 if(req.method==="POST"){
   let body:any={};try{body=await req.json();}catch{}
   if(body?.acknowledge!==true)return Response.json({ok:false,error:"acknowledgement_required"},{status:422,headers});
   const gate=canAcknowledge(record,body?.source_id);if(!gate.ok)return Response.json({ok:false,error:gate.error},{status:gate.error==="expired"?410:409,headers});
   outbox.status="consumed";outbox.consumed_at=new Date().toISOString();outbox.consumer=String(body?.consumer||record.route);await store.setJSON(`outbox/${routeKey(record.route)}/${record.source_id}.json`,outbox);
   record.status="acknowledged";record.acknowledged_at=outbox.consumed_at;record.consumer=outbox.consumer;await store.setJSON(key,record);
   return Response.json({ok:true,duplicate:false,status:"acknowledged",route:record.route,source_id:record.source_id},{headers});
 }
 return new Response("Method Not Allowed",{status:405,headers:{...headers,Allow:"GET, POST, OPTIONS"}});
};
export const config:Config={path:"/handoff"};
