const URGENCY=/\b(urgent|emergency|asap|immediately|today|burst|flood|no power|sparking)\b/i;
const PROBLEM=/\b(leak|broken|not working|repair|fix|burst|blocked|clogged|fault|damage|damaged|sparking|no power)\b/i;
export function repairCandidate(payload={}){
 const text=String(payload.text||"").replace(/\s+/g," ").trim();
 const service=(text.match(/\b(plumber|electrician|handyman|cleaner|gardener|painter|builder|carpenter|locksmith|appliance repair)\b/i)||[])[1]||null;
 return{summary:text.slice(0,180),service:service?service.toLowerCase():null,urgent:URGENCY.test(text),problem_detected:PROBLEM.test(text),source_chat:payload.source_chat||null,sender:payload.sender||null,source_timestamp:payload.source_timestamp||null,evidence:payload.evidence||[],linked_contact_source_id:payload.linked_contact_source_id||null,needs_confirmation:!PROBLEM.test(text)};
}
export function repairDedupeKey(sourceId){return `${sourceId}:repair`;}
export function linkRepairToContact(repair={},contactDecisionResult={}){
 if(contactDecisionResult?.state!=="confirmed")return{...repair,linked_contact_source_id:null};
 return{...repair,linked_contact_source_id:contactDecisionResult.source_id,provider:contactDecisionResult.contact||null};
}
export function repairDecision(sourceId,candidate,decision,edits={}){
 if(!/^[a-f0-9]{64}$/i.test(String(sourceId||"")))return{ok:false,error:"invalid_source_id"};
 if(decision==="reject")return{ok:true,state:"rejected",source_id:sourceId};
 if(decision!=="confirm")return{ok:false,error:"invalid_decision"};
 const r={...candidate,...edits};if(!r.summary)return{ok:false,error:"missing_summary"};
 return{ok:true,state:"confirmed",source_id:sourceId,dedupe_key:repairDedupeKey(sourceId),repair:r};
}
