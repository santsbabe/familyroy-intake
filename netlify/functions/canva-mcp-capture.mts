import type { Config } from "@netlify/functions";
import { getDeployStore, getStore } from "@netlify/blobs";
import { buildRecord, mergeRecord, validateCanvaCapture, isCanvaUrl } from "./core.mjs";
import { callCanvaMcpTool, designIdFromUrl, getCanvaMcpAccessToken, textFromToolResult } from "./canva-mcp-client.mts";

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
function shortlinkId(value:string){
  try{
    const u=new URL(value);
    return u.hostname==="canva.link"?u.pathname.replace(/^\/+|\/+$/g,""):null;
  }catch{return null}
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
  if(existing.status!=="awaiting_enrichment")return Response.json({ok:true,changed:false,source_id:existing.source_id,status:existing.status,routes:existing.routes});

  const expected:string[]=existing.source_canva_urls||existing.canva_urls||[];
  const requested=String(body?.original_url||"").trim();
  const original=requested||expected[0]||"";
  if(!isCanvaUrl(original)||!expected.includes(original))return Response.json({ok:false,error:"unexpected_original_url"},{status:400});

  let accessToken:string;
  try{accessToken=await getCanvaMcpAccessToken();}
  catch(e:any){return Response.json({ok:false,error:e?.message||"canva_mcp_not_ready"},{status:503});}

  let resolved=original;
  try{
    const id=shortlinkId(original);
    if(id){
      const resolvedResult:any=await callCanvaMcpTool(accessToken,"resolve-shortlink",{shortlink_id:id});
      const parsed=textFromToolResult(resolvedResult);
      resolved=String(parsed.json?.target_url||"");
      if(!isCanvaUrl(resolved))throw new Error("canva_shortlink_resolution_failed");
    }

    const contentResult:any=await callCanvaMcpTool(accessToken,"get-design-content",{
      design_id:resolved,
      content_types:["richtexts"],
      user_intent:"Read the school newsletter text for FamilyRoy School Readiness intake."
    });
    const parsed=textFromToolResult(contentResult);
    const payload=parsed.json||{};
    const contentText=String(payload.text||parsed.raw||"").trim();
    if(!contentText)throw new Error("canva_design_content_empty");

    const capture={
      original_url:original,
      resolved_url:String(payload.url||resolved),
      design_id:String(payload.id||designIdFromUrl(resolved)||"")||null,
      title:String(payload.title||"")||null,
      captured_at:new Date().toISOString(),
      content_text:contentText,
      evidence_ref:existing.raw_evidence_ref||null,
      capture_method:"canva_remote_mcp"
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
      canva_urls:expected,
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
      canva_integrity:record.canva_integrity,
      captured_url:original
    });
  }catch(e:any){
    return Response.json({ok:false,error:e?.message||"canva_mcp_capture_failed",source_id:sourceId,original_url:original},{status:502});
  }
};
export const config:Config={path:"/canva/capture"};
