import type { Config } from "@netlify/functions";
import { buildRecord } from "./core.mjs";
function result(name:string,pass:boolean,detail:any){return{name,pass,detail};}
export default async(req:Request)=>{
  if(Netlify.context?.deploy?.context==="production") return new Response("Not Found",{status:404});
  const tests:any[]=[];
  const cases=[
    ["PNPS homework + readiness + event",{source_chat:"PNPS Parents",text:"Alexander: homework is revise klanke. Bring library bag on Friday."},["homework_quest","control_centre.school_readiness","control_centre.calendar_events"],"Alexander"],
    ["HAW readiness",{source_chat:"100 Acre Wood",text:"Please bring the permission form tomorrow"},["control_centre.school_readiness","control_centre.calendar_events"],"Imogen"],
    ["Generic PNPS does not guess child",{source_chat:"PNPS",text:"Civvies on Friday"},["control_centre.school_readiness","control_centre.calendar_events"],null],
    ["Ambiguous goes to review",{text:"This looks useful"},["review_queue"],null]
  ];
  for(const [name,input,want,child] of cases as any[]){
    const r=buildRecord(input);
    tests.push(result(name,want.every((x:string)=>r.routes.includes(x))&&(child?r.extracted.children.includes(child):name!=="Generic PNPS does not guess child"||r.extracted.children.length===0),{routes:r.routes,extracted:r.extracted}));
  }
  const base=new URL(req.url).origin, token=Netlify.env.get("FAMILYROY_INTAKE_TOKEN")||"";
  async function post(auth?:string,body:any={source_chat:"PNPS",text:"Synthetic acceptance test: homework reading. Bring library bag on Friday."}){
    return fetch(base+"/intake",{method:"POST",headers:{"content-type":"application/json",...(auth?{authorization:auth}:{})},body:JSON.stringify(body)});
  }
  try{
    const no=await post();tests.push(result("Missing token rejected",no.status===401,{status:no.status}));
    const bad=await post("Bearer definitely-wrong");tests.push(result("Wrong token rejected",bad.status===401,{status:bad.status}));
    const payload={source_type:"manual",source_chat:"PNPS Acceptance Test",source_timestamp:"2099-01-01T00:00:00Z",text:"Synthetic acceptance test: Alexander homework reading. Bring library bag on Friday."};
    const one=await post("Bearer "+token,payload), j1=await one.json();
    const two=await post("Bearer "+token,payload), j2=await two.json();
    tests.push(result("Correct token accepted",one.status===201||j1.duplicate===true,{status:one.status,body:j1}));
    tests.push(result("Duplicate detected",j2.duplicate===true&&j1.source_id===j2.source_id,{first:j1,second:j2}));
  }catch(e){tests.push(result("Live intake round-trip",false,String(e)));}
  const pass=tests.every(t=>t.pass);
  return Response.json({ok:pass,environment:Netlify.context?.deploy?.context||"unknown",tests},{status:pass?200:500});
};
export const config:Config={path:"/preview-acceptance"};