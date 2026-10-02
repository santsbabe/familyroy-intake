import type { Config } from "@netlify/functions";
const cases=[
 {name:"PNPS multi-route",body:{source_type:"manual",source_chat:"PNPS Parents",text:"Alexander: homework is revise klanke. Bring library bag on Friday."},want:["homework_quest","control_centre.school_readiness","control_centre.calendar_events"],child:"Alexander"},
 {name:"HAW → Imogen",body:{source_type:"manual",source_chat:"100 Acre Wood",text:"Please bring the permission form tomorrow"},want:["control_centre.school_readiness"],child:"Imogen"},
 {name:"PNPS does not guess child",body:{source_type:"manual",source_chat:"PNPS",text:"Civvies on Friday"},want:["control_centre.school_readiness","control_centre.calendar_events"],child:null},
 {name:"Ambiguous → review",body:{source_type:"manual",text:"This looks useful"},want:["review_queue"],child:null},
 {name:"Optional + mandatory school notice",body:{source_type:"manual",source_chat:"PNPS",text:"Parents may buy raffle tickets, but please return Alexander\'s consent form on Friday."},want:["control_centre.school_readiness","control_centre.calendar_events"],child:"Alexander"}
];
async function post(origin:string,token:string|undefined,body:any){const headers:any={"content-type":"application/json"};if(token)headers.authorization=`Bearer ${token}`;const r=await fetch(origin+"/intake",{method:"POST",headers,body:JSON.stringify(body)});let data:any={};try{data=await r.json()}catch{}return{status:r.status,data};}
export default async(req:Request)=>{
 if(Netlify.context?.deploy?.context==="production")return new Response("Not Found",{status:404});
 const url=new URL(req.url),origin=url.origin,token=Netlify.env.get("FAMILYROY_INTAKE_TOKEN");
 if(!token)return Response.json({ok:false,error:"preview_token_missing"},{status:500});
 const noAuth=await post(origin,undefined,{text:"auth test"});
 const wrongAuth=await post(origin,"definitely-wrong",{text:"auth test"});
 const results:any[]=[
  {name:"Missing token rejected",pass:noAuth.status===401,got:noAuth.status,want:401},
  {name:"Wrong token rejected",pass:wrongAuth.status===401,got:wrongAuth.status,want:401}
 ];
 for(const c of cases){const unique={...c.body,source_timestamp:new Date().toISOString()+"-"+c.name};const x=await post(origin,token,unique);const routes=x.data?.routes||[],children=x.data?.extracted?.children||[];const routesOK=c.want.every((v:string)=>routes.includes(v));const childOK=c.child?children.includes(c.child):children.length===0;const browserRoutes=c.want.filter((v:string)=>v==="homework_quest"||v==="control_centre.school_readiness"),handoffOK=browserRoutes.every((v:string)=>/^[A-Za-z0-9_-]{43}$/.test(x.data?.handoffs?.[v]?.capability||""));results.push({name:c.name,pass:x.status===201&&routesOK&&childOK&&handoffOK,status:x.status,routes,children,handoff_routes:Object.keys(x.data?.handoffs||{})});}
 const dupe={source_type:"manual",source_chat:"PNPS",source_timestamp:"acceptance-dedupe-v1",text:"Homework: reading pages 4 and 5"};
 const first=await post(origin,token,dupe),second=await post(origin,token,dupe);
 results.push({name:"Duplicate ingestion",pass:[200,201].includes(first.status)&&second.status===200&&second.data?.duplicate===true&&first.data?.source_id===second.data?.source_id,first:{status:first.status,duplicate:first.data?.duplicate},second:{status:second.status,duplicate:second.data?.duplicate},same_source_id:first.data?.source_id===second.data?.source_id});
 return Response.json({ok:results.every(x=>x.pass),preview:true,production_untouched:true,results});
};
export const config:Config={path:"/acceptance"};