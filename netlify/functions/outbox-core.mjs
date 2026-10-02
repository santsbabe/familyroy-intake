export function outboxKey(route,sourceId){const rk=String(route).replace(/[^a-z0-9._-]/gi,"_");return `outbox/${rk}/${sourceId}.json`;}
export async function ensureRouteOutbox(store,record,{repairOnly=false}={}){
 const created=[],existing=[];
 for(const [route,payload] of Object.entries(record?.route_payloads||{})){
  const key=outboxKey(route,record.source_id),queued=await store.get(key,{type:"json"});
  if(queued){existing.push({route,key,status:queued.status});continue;}
  const item={source_id:record.source_id,route,payload,status:"pending",created_at:record.received_at};
  await store.setJSON(key,item);created.push({route,key,status:"pending"});
 }
 return{created,existing,repairOnly};
}
