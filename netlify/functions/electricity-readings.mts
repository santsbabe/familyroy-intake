import type { Config } from "@netlify/functions";
import { getDeployStore } from "@netlify/blobs";

export default async () => {
  if(Netlify.context?.deploy?.context==="production") return new Response("Not Found",{status:404});
  const store=getDeployStore({name:"familyroy-intake",consistency:"strong"});
  const listed:any=await store.list({prefix:"electricity/readings/"});
  const rows:any[]=[];
  for(const blob of listed.blobs||[]){
    const row:any=await store.get(blob.key,{type:"json"});
    if(row)rows.push({key:blob.key,...row});
  }
  rows.sort((a,b)=>String(b.reading_at||"").localeCompare(String(a.reading_at||"")));
  return Response.json({ok:true,count:rows.length,readings:rows.slice(0,25)});
};
export const config:Config={path:"/electricity-readings"};
