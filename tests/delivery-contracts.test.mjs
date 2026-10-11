import test from "node:test";
import assert from "node:assert/strict";
import {buildRecord,ROUTES} from "../netlify/functions/core.mjs";
import {ensureRouteOutbox,outboxKey,pendingRoutesFromEnsure} from "../netlify/functions/outbox-core.mjs";
import {createHandoffRecord,canAcknowledge,newCapability,handoffState} from "../netlify/functions/handoff-core.mjs";

function store(){const data=new Map();return{data,async get(k){return data.get(k)||null},async setJSON(k,v){data.set(k,structuredClone(v))}};}
const share={source_type:"whatsapp_share",source_chat:"PNPS Parents",sender:"Teacher",source_timestamp:"2026-10-06T08:00:00+02:00",text:"Alexander homework: revise klanke. Bring library bag on Friday."};

test("school fan-out preserves one canonical source and independent pending destinations",async()=>{
 const r=buildRecord(share),s=store();
 assert.deepEqual(r.routes.slice().sort(),[ROUTES.SCHOOL_HOMEWORK,ROUTES.SCHOOL_READINESS,ROUTES.EVENTS].sort());
 const x=await ensureRouteOutbox(s,r);
 assert.equal(x.created.length,3);
 for(const route of r.routes){
   const item=await s.get(outboxKey(route,r.source_id));
   assert.equal(item.source_id,r.source_id);
   assert.equal(item.payload.source_id,r.source_id);
   assert.equal(item.status,"pending");
 }
 assert.equal(pendingRoutesFromEnsure(x).size,3);
});

test("one consumed route stays consumed while duplicate share recovers other pending routes",async()=>{
 const r=buildRecord(share),s=store();
 await ensureRouteOutbox(s,r);
 const key=outboxKey(ROUTES.SCHOOL_READINESS,r.source_id);
 const completed=await s.get(key);
 completed.status="consumed";completed.consumer="control_centre.school_readiness";
 await s.setJSON(key,completed);
 const second=buildRecord(share);
 assert.equal(second.source_id,r.source_id);
 const repaired=await ensureRouteOutbox(s,second,{repairOnly:true});
 const pending=pendingRoutesFromEnsure(repaired);
 assert.equal(repaired.created.length,0);
 assert.equal((await s.get(key)).status,"consumed");
 assert.equal(pending.has(ROUTES.SCHOOL_READINESS),false);
 assert.equal(pending.has(ROUTES.SCHOOL_HOMEWORK),true);
 assert.equal(pending.has(ROUTES.EVENTS),true);
 assert.equal(s.data.size,3);
});

test("handoff stays recoverable after failed delivery until explicit redemption and acknowledgement",async()=>{
 const r=buildRecord(share),s=store();
 await ensureRouteOutbox(s,r);
 const token=newCapability();
 const h=createHandoffRecord({token,route:ROUTES.SCHOOL_READINESS,source_id:r.source_id,now:1000,ttlMs:1000});
 assert.equal(handoffState(h,1100),"issued");
 assert.equal(canAcknowledge(h,r.source_id,1100).ok,false);
 assert.equal((await s.get(outboxKey(ROUTES.SCHOOL_READINESS,r.source_id))).status,"pending");
 h.status="redeemed";
 assert.equal(canAcknowledge(h,r.source_id,1100).ok,true);
 assert.equal(canAcknowledge(h,"f".repeat(64),1100).ok,false);
 assert.equal(handoffState(h,2500),"expired");
 assert.equal(canAcknowledge(h,r.source_id,2500).ok,false);
 assert.equal((await s.get(outboxKey(ROUTES.SCHOOL_READINESS,r.source_id))).status,"pending");
});

test("pending or consumed does not imply delivered if a recipient has no durable consumer",async()=>{
 const r=buildRecord(share),s=store();
 await ensureRouteOutbox(s,r);
 const item=await s.get(outboxKey(ROUTES.SCHOOL_HOMEWORK,r.source_id));
 assert.equal(item.status,"pending");
 assert.equal(item.payload.mode,"import_candidate");
 assert.equal(item.payload.fidelity,"preserve_source");
 assert.ok(!Object.hasOwn(item,"delivered_at"));
});
