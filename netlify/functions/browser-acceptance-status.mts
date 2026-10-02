import type { Config } from "@netlify/functions";
import { getDeployStore } from "@netlify/blobs";
function key(route:string,sourceId:string){return `outbox/${route.replace(/[^a-z0-9._-]/gi,"_")}/${sourceId}.json`;}
export default async(req:Request)=>{\n if(req.method!=="GET")return new Response("Method Not Allowed",{status:405,headers:{Allow:"GET","cache-control":"no-store"}});
 if(Netlify.context?.deploy?.context==="production")return new Response("Not Found",{status:404});
 const sourceId=new URL(req.url).searchParams.get("source_id")||"";if(!/^[a-f0-9]{64}$/i.test(sourceId))return Response.json({ok:false,error:"invalid_source_id"},{status:422});
 const store=getDeployStore({name:"familyroy-intake",consistency:"strong"}),source:any=await store.get(`sources/${sourceId}.json`,{type:"json"});
 if(!source||!String(source.text||"").startsWith("[FamilyRoy browser acceptance]"))return Response.json({ok:false,error:"not_synthetic_acceptance_source"},{status:404});
 const item:any=await store.get(key("control_centre.school_readiness",sourceId),{type:"json"});
 return Response.json({ok:true,source_id:sourceId,readiness_status:item?.status||"missing",consumed:item?.status==="consumed",consumer:item?.consumer||null},{headers:{"cache-control":"no-store"}});
};
export const config:Config={path:"/browser-acceptance-status"};
