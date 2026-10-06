export function electricityCandidate(payload={}){
 const text=String(payload.text||"").replace(/\s+/g," ").trim();
 const reading=(text.match(/\b(\d{3,8}(?:[.,]\d{1,3})?)\s*(?:kwh)?\b/i)||[])[1]||null;
 const value=reading?Number(reading.replace(",",".")):null;
 const photos=(payload.evidence||[]).filter(x=>/^image\//i.test(x?.mime_type||x?.type||""));
 return{reading:value,unit:"kWh",captured_at:payload.source_timestamp||null,photos,notes:text,needs_confirmation:value===null,attribution:null};
}
export function electricityDedupeKey(sourceId){return `${sourceId}:electricity`;}
export function usageInterval(previous,current){
 if(previous?.reading==null||current?.reading==null)return null;
 const delta=Number(current.reading)-Number(previous.reading);if(!Number.isFinite(delta)||delta<0)return null;
 return{from:previous.captured_at||null,to:current.captured_at||null,usage_kwh:delta,needs_attribution:true};
}
export function electricityDecision(sourceId,candidate,decision,edits={}){
 if(!/^[a-f0-9]{64}$/i.test(String(sourceId||"")))return{ok:false,error:"invalid_source_id"};
 if(decision==="reject")return{ok:true,state:"rejected",source_id:sourceId};
 if(decision!=="confirm")return{ok:false,error:"invalid_decision"};
 const c={...candidate,...edits};if(c.reading==null)return{ok:false,error:"missing_reading"};
 return{ok:true,state:"confirmed",source_id:sourceId,dedupe_key:electricityDedupeKey(sourceId),reading:c};
}
