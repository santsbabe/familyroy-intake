import {calendarDedupeKey,resolveCalendarCandidate} from "./calendar-core.mjs";
export function calendarReviewKey(sourceId){return `calendar-review/${sourceId}.json`;}
export function buildCalendarReview(outboxItem,referenceDate=new Date()){
 const p=outboxItem?.payload||{},candidate=p.event_candidate||{},resolved=resolveCalendarCandidate(candidate,referenceDate);
 return{source_id:outboxItem?.source_id||p.source_id,route:outboxItem?.route||"control_centre.calendar_events",dedupe_key:calendarDedupeKey(outboxItem?.source_id||p.source_id,candidate),status:resolved.status,resolution:resolved,source:{source_type:p.source_type||null,source_chat:p.source_chat||null,sender:p.sender||null,source_timestamp:p.source_timestamp||null,text:p.text||"",evidence:p.evidence||[]},created_at:outboxItem?.created_at||null};
}
export function calendarDecision(review,decision,edits={}){
 if(!review?.source_id)return{ok:false,error:"invalid_review"};
 if(decision==="reject")return{ok:true,state:"rejected",source_id:review.source_id,dedupe_key:review.dedupe_key};
 if(decision!=="confirm")return{ok:false,error:"invalid_decision"};
 const r={...review.resolution,...edits};
 if(!r.start_local||!r.title)return{ok:false,error:"incomplete_event"};
 return{ok:true,state:"confirmed",source_id:review.source_id,dedupe_key:review.dedupe_key,event:{title:String(r.title).trim(),start_local:r.start_local,all_day:!!r.all_day,alerts:Array.isArray(r.alerts)?r.alerts:[],school:r.school||null,children:r.children||[],source_text:r.source_text||review.source?.text||null}};
}
export function shouldConsumeCalendarOutbox(decisionResult){return !!decisionResult?.ok&&["confirmed","rejected"].includes(decisionResult.state);}
