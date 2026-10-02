import type { Config } from "@netlify/functions";
export default async(req:Request)=>{
 if(Netlify.context?.deploy?.context==="production")return new Response("Not Found",{status:404});
 const token=Netlify.env.get("FAMILYROY_INTAKE_TOKEN")||"";if(!token)return Response.json({ok:false,error:"preview_token_missing"},{status:500});
 const origin=new URL(req.url).origin,stamp=new Date().toISOString(),body={source_type:"manual",source_chat:"PNPS",source_timestamp:"browser-acceptance-"+stamp,text:"[FamilyRoy browser acceptance] PNPS: Please bring Alexander's library bag tomorrow."};
 const res=await fetch(origin+"/intake",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+token},body:JSON.stringify(body)});
 const data:any=await res.json();const launch=String(data?.primary_action?.launch_url||"");
 if(res.status!==201||!launch||data?.primary_action?.route!=="control_centre.school_readiness")return Response.json({ok:false,error:"launch_not_ready",status:res.status,routes:data?.routes||[],primary:data?.primary_action?.route||null},{status:500});
 return Response.json({ok:true,source_id:data.source_id,launch_url:launch},{headers:{"cache-control":"no-store"}});
};
export const config:Config={path:"/browser-acceptance"};
