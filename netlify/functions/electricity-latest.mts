import type { Config } from "@netlify/functions";
import { getDeployStore } from "@netlify/blobs";

export default async () => {
  if(Netlify.context?.deploy?.context==="production") return new Response("Not Found",{status:404});
  const store=getDeployStore({name:"familyroy-intake",consistency:"strong"});
  const latest:any=await store.get("electricity/latest.json",{type:"json"});
  if(!latest) return Response.json({ok:true,latest:null});
  return Response.json({ok:true,latest:{reading_kwh:latest.reading_kwh,reading_at:latest.reading_at,previous_reading_kwh:latest.previous_reading_kwh,usage_kwh:latest.usage_kwh,status:latest.status,anomaly:latest.anomaly}});
};
export const config:Config={path:"/electricity-latest"};
