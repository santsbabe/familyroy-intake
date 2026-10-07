import type { Config } from "@netlify/functions";
import { getDeployStore, getStore } from "@netlify/blobs";
import { buildRecord, mergeRecord, validateCanvaCapture } from "./core.mjs";

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
  if(req.method!=="POST")return new Response("Method Not Allowed",{status:405,headers:{Allow:"POST"}});
  const auth=authorise(req);if(!auth.ok)return auth.response!;
  let body:any;try{body=await req.json();}catch{return Response.json({ok:false,error:"invalid_json"},{status:400});}
  const sourceId=String(body?.source_id||"").trim();
  if(!sourceId)return Response.json({ok:false,error:"source_id_required"},{status:400});

  const store=storeForEnvironment();
  const key="sources/"+sourceId+".json";
  const existing:any=await store.get(key,{type:"json"});
  if(!existing)return Response.json({ok:false,error:"source_not_found"},{status:404});

  const capture={
    original_url:body?.capture?.original_url||null,
    resolved_url:body?.capture?.resolved_url||null,
    design_id:body?.capture?.design_id||null,
    title:body?.capture?.title||null,
    captured_at:body?.capture?.captured_at||new Date().toISOString(),
    content_text:String(body?.capture?.content_text||"").trim(),
    evidence_ref:body?.capture?.evidence_ref||existing.raw_evidence_ref||null,
    capture_method:body?.capture?.capture_method||"authenticated_canva"
  };
  const check=validateCanvaCapture(existing,capture);
  if(!check.ok)return Response.json({ok:false,error:check.error},{status:400});

  const incoming=buildRecord({
    source_type:existing.source_type,
    source_chat:existing.source_chat,
    sender:existing.sender,
    source_timestamp:existing.source_timestamp,
    text:existing.text,
    attachments:existing.attachments||[],
    raw_evidence_ref:existing.raw_evidence_ref,
    client_context:existing.client_context,
    canva_urls:existing.source_canva_urls||existing.canva_urls||[],
    canva_captures:[capture],
    canva_failures:existing.canva_failures||[]
  });
  const merged=mergeRecord(existing,incoming);
  if(merged.changed)await store.setJSON(key,merged.record);
  const record=merged.record;
  return Response.json({
    ok:true,
    changed:merged.changed,
    source_id:record.source_id,
    status:record.status,
    routes:record.routes,
    confidence:record.confidence,
    canva_integrity:record.canva_integrity
  });
};
export const config:Config={path:"/canva/enrich"};
