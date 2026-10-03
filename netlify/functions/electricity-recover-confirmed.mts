import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

export default async () => {
  if(Netlify.context?.deploy?.context==="production") return new Response("Not Found",{status:404});
  const store=getStore("familyroy-electricity-preview",{consistency:"strong"});
  const rows=[
    {source_id:"recovered-2026-10-03-0931",reading_kwh:129.06,reading_at:"2026-10-03T09:31:00+02:00",previous_reading_kwh:null,usage_kwh:null,evidence_ref:null,extraction_confidence:1,extraction_source:"confirmed_photo_reading",status:"logged",anomaly:null,source:"Recovered from confirmed meter photo"},
    {source_id:"recovered-2026-10-03-1727",reading_kwh:125.39,reading_at:"2026-10-03T17:27:00+02:00",previous_reading_kwh:129.06,usage_kwh:3.67,evidence_ref:null,extraction_confidence:1,extraction_source:"confirmed_shortcut_output",status:"logged",anomaly:null,source:"Recovered from confirmed Shortcut output"}
  ];
  for(const row of rows){
    const key=`readings/${row.reading_at.replace(/:/g,"-")}-${row.source_id}.json`;
    const existing=await store.get(key,{type:"json"});
    if(!existing)await store.setJSON(key,row);
  }
  await store.setJSON("latest.json",rows[1]);
  return Response.json({ok:true,recovered:rows.map(r=>({reading_kwh:r.reading_kwh,reading_at:r.reading_at,usage_kwh:r.usage_kwh}))});
};
export const config:Config={path:"/electricity-recover-confirmed"};
