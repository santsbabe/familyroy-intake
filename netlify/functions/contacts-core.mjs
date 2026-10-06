const PHONE=/((?:\+27|0)\s?\d{2}(?:[\s-]?\d{3}){2})/;
const SERVICE=/\b(plumber|electrician|handyman|cleaner|cleaning|gardener|garden service|beauty|massage|travel|transport|driver|pool|painter|builder|carpenter|locksmith|appliance repair|repair)\b/i;
export function contactCandidate(payload={}){
 const text=String(payload.text||"").replace(/\s+/g," ").trim(),phone=(text.match(PHONE)||[])[1]||null,service=(text.match(SERVICE)||[])[1]||null;
 const nameMatch=text.match(/(?:recommend(?:ed)?|contact|ask for|call|whatsapp)\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)?)/);
 const name=nameMatch?.[1]||null;
 const hasIdentity=!!(name||phone),hasService=!!service;
 return{name,phone,service:service?service.toLowerCase():null,notes:text,source_chat:payload.source_chat||null,sender:payload.sender||null,source_timestamp:payload.source_timestamp||null,evidence:payload.evidence||[],needs_confirmation:!(hasIdentity&&hasService)};
}
export function contactsDedupeKey(sourceId,candidate={}){return `${sourceId}:contact:${String(candidate.phone||candidate.name||"unknown").toLowerCase()}:${String(candidate.service||"unknown").toLowerCase()}`;}
export function contactDecision(sourceId,candidate,decision,edits={}){
 if(!/^[a-f0-9]{64}$/i.test(String(sourceId||"")))return{ok:false,error:"invalid_source_id"};
 if(decision==="reject")return{ok:true,state:"rejected",source_id:sourceId};
 if(decision!=="confirm")return{ok:false,error:"invalid_decision"};
 const c={...candidate,...edits};if(!c.name&&!c.phone)return{ok:false,error:"missing_identity"};if(!c.service)return{ok:false,error:"missing_service"};
 return{ok:true,state:"confirmed",source_id:sourceId,dedupe_key:contactsDedupeKey(sourceId,c),contact:{name:c.name||null,phone:c.phone||null,service:c.service,notes:c.notes||"",source_chat:c.source_chat||null,source_timestamp:c.source_timestamp||null,evidence:c.evidence||[]}};
}

function norm(v){return String(v||"").toLowerCase().replace(/[^a-z0-9+]/g,"");}
export function contactIdentity(candidate={}){return norm(candidate.phone)||norm(candidate.name);}
export function findContactMatch(candidate={},existing=[]){
 const id=contactIdentity(candidate);if(!id)return{match:null,reason:"no_identity"};
 const exact=existing.find(x=>contactIdentity(x)===id);if(exact)return{match:exact,reason:candidate.phone?"same_phone":"same_name"};
 return{match:null,reason:"no_match"};
}
export function mergeContact(existing={},incoming={}){
 const services=[...new Set([...(existing.services||[existing.service].filter(Boolean)),...(incoming.services||[incoming.service].filter(Boolean))].map(x=>String(x).toLowerCase()))];
 const sources=[...new Set([...(existing.source_ids||[]),...(incoming.source_id?[incoming.source_id]:[])])];
 return{...existing,name:existing.name||incoming.name||null,phone:existing.phone||incoming.phone||null,services,notes:[existing.notes,incoming.notes].filter(Boolean).join("\n---\n"),source_ids:sources,evidence:[...(existing.evidence||[]),...(incoming.evidence||[])]};
}
export function upsertContact(directory=[],incoming={}){
 const {match,reason}=findContactMatch(incoming,directory);
 if(!match)return{action:"create",reason,contact:mergeContact({},incoming),directory:[...directory,mergeContact({},incoming)]};
 const merged=mergeContact(match,incoming);return{action:"merge",reason,contact:merged,directory:directory.map(x=>x===match?merged:x)};
}
