import type { Config } from "@netlify/functions";
import { getStore,getDeployStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

const ALLOWED=new Set(["homework_quest","control_centre.school_readiness","control_centre.calendar_events","review_queue"]);
function storeForEnvironment(){return Netlify.context?.deploy?.context==="production"?getStore("familyroy-intake",{consistency:"strong"}):getDeployStore("familyroy-intake");}
function authorised(req:Request){const expected=Netlify.env.get("FAMILYROY_INTAKE_TOKEN")||"";const supplied=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");if(!expected||!supplied)return false;const a=Buffer.from(expected),b=Buffer.from(supplied);return a.length===b.length&&timingSafeEqual(a,b);}
function routeKey(route:string){return route.replace(/[^a-z0-9._-]/gi,"_");}
export default async(req:Request)=>{
 if(!authorised(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 const url=new URL(req.url),route=url.searchParams.get("route")||"";
 if(!ALLOWED.has(route))return Response.json({ok:false,error:"invalid_route"},{status:400});
 const store=storeForEnvironment(),prefix=`outbox/${routeKey(route)}/`;
 if(req.method==="GET"){
   const listed=await store.list({prefix});
   const items=[];for(const blob of listed.blobs||[]){const item:any=await store.get(blob.key,{type:"json"});if(item?.status==="pending")items.push(item);}
   items.sort((a:any,b:any)=>String(a.created_at).localeCompare(String(b.created_at)));
   return Response.json({ok:true,route,count:items.length,items});
 }
 if(req.method==="POST"){
   let body:any;try{body=await req.json();}catch{return Response.json({ok:false,error:"invalid_json"},{status:400});}
   const sourceId=String(body?.source_id||"");if(!/^[a-f0-9]{64}$/i.test(sourceId))return Response.json({ok:false,error:"invalid_source_id"},{status:422});
   const key=`${prefix}${sourceId}.json`,item:any=await store.get(key,{type:"json"});if(!item)return Response.json({ok:false,error:"not_found"},{status:404});
   if(item.status==="consumed")return Response.json({ok:true,duplicate:true,item});
   item.status="consumed";item.consumed_at=new Date().toISOString();item.consumer=String(body?.consumer||route);await store.setJSON(key,item);
   return Response.json({ok:true,duplicate:false,item});
 }
 return new Response("Method Not Allowed",{status:405,headers:{Allow:"GET, POST"}});
};
export const config:Config={path:"/route-outbox"};
