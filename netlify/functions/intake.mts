import type { Config } from "@netlify/functions";
import { getStore, getDeployStore } from "@netlify/blobs";
import { buildRecord, buildElectricityReading, ROUTES } from "./core.mjs";
function storeForEnvironment(){const production=Netlify.context?.deploy?.context==="production";return production?getStore("familyroy-intake",{consistency:"strong"}):getDeployStore("familyroy-intake");}
export default async(req:Request)=>{if(req.method!=="POST")return new Response("Method Not Allowed",{status:405,headers:{Allow:"POST"}});let body:any;try{body=await req.json();}catch{return Response.json({ok:false,error:"invalid_json"},{status:400});}const record=buildRecord(body);const store=storeForEnvironment();const key=`sources/${record.source_id}.json`;
if(record.routes.includes(ROUTES.ELECTRICITY)){
  const latest:any=await store.get("electricity/latest.json",{type:"json"});
  const reading=buildElectricityReading(body,latest?.reading_kwh??null);
  record.extracted.electricity=reading;
  if(reading.status==="needs_review") record.status="needs_review";
}const existing=await store.get(key,{type:"json"});if(existing)return Response.json({ok:true,duplicate:true,source_id:record.source_id,status:existing.status,routes:existing.routes});await store.setJSON(key,record);
if(record.routes.includes(ROUTES.ELECTRICITY)&&record.extracted?.electricity?.reading_kwh!==null){
  const reading=record.extracted.electricity;
  await store.setJSON(`electricity/readings/${reading.reading_at}-${record.source_id}.json`,{source_id:record.source_id,...reading});
  await store.setJSON("electricity/latest.json",{source_id:record.source_id,...reading});
}
return Response.json({ok:true,duplicate:false,source_id:record.source_id,status:record.status,routes:record.routes,confidence:record.confidence,extracted:record.extracted},{status:201});};
export const config: Config={path:"/intake"};
