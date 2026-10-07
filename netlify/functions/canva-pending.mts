import type { Config } from "@netlify/functions";
import { getDeployStore, getStore } from "@netlify/blobs";

function storeForEnvironment(){
  const production=Netlify.context?.deploy?.context==="production";
  return production?getStore("familyroy-intake",{consistency:"strong"}):getDeployStore("familyroy-intake");
}
function authorise(req:Request){
  const expected=process.env.FAMILYROY_INTAKE_TOKEN;
  if(!expected)return{ok:false,response:Response.json({ok:false,error:"intake_token_not_configured"},{status:503})};
  const auth=req.headers.get("authorization")||"";
  if(auth!=="Bearer "+expected)return{ok:false,response:Response.json({ok:false,error:"unauthorized"},{status:401})};
  return{ok:true,response:null};
}

export default async(req:Request)=>{
  if(req.method!=="GET")return new Response("Method Not Allowed",{status:405,headers:{Allow:"GET"}});
  const auth=authorise(req);if(!auth.ok)return auth.response!;
  const store=storeForEnvironment();
  const listed:any=await store.list({prefix:"sources/"});
  const items:any[]=[];
  for(const blob of listed.blobs||[]){
    const record:any=await store.get(blob.key,{type:"json"});
    if(!record||record.status!=="awaiting_enrichment")continue;
    const expected=record.source_canva_urls||record.canva_urls||[];
    const captured=new Set((record.canva_captures||[]).filter((x:any)=>x.content_text).flatMap((x:any)=>[x.original_url,x.resolved_url].filter(Boolean)));
    const pendingUrls=expected.filter((u:string)=>!captured.has(u));
    items.push({
      source_id:record.source_id,
      source_type:record.source_type,
      source_chat:record.source_chat,
      sender:record.sender,
      source_timestamp:record.source_timestamp,
      received_at:record.received_at,
      raw_evidence_ref:record.raw_evidence_ref,
      client_context:record.client_context,
      source_canva_urls:expected,
      pending_canva_urls:pendingUrls,
      canva_integrity:record.canva_integrity
    });
  }
  items.sort((a,b)=>String(a.source_timestamp||a.received_at||"").localeCompare(String(b.source_timestamp||b.received_at||"")));
  return Response.json({ok:true,count:items.length,items});
};
export const config:Config={path:"/canva/pending"};
