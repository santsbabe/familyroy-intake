const clean=s=>String(s||"").replace(/\s+/g," ").trim();
export function domainCandidate(route,payload={}){
 const text=clean(payload.text),base={source_id:payload.source_id||null,route,text,source_type:payload.source_type||null,source_chat:payload.source_chat||null,sender:payload.sender||null,source_timestamp:payload.source_timestamp||null,evidence:payload.evidence||[]};
 if(route==="control_centre.personal_admin")return{...base,kind:"personal_admin",summary:text.slice(0,180),needs_confirmation:true};
 if(route==="control_centre.pet_care")return{...base,kind:"pet_care",summary:text.slice(0,180),needs_confirmation:true};
 if(route==="control_centre.shopping_radar")return{...base,kind:"shopping",summary:text.slice(0,180),needs_confirmation:true};
 if(route==="control_centre.food_meal_planner")return{...base,kind:"food_meal",summary:text.slice(0,180),needs_confirmation:true};
 return{...base,kind:"review",summary:text.slice(0,180),needs_confirmation:true};
}
export function reviewDecision(candidate,decision,edits={}){
 if(decision==="reject")return{ok:true,state:"rejected",source_id:candidate?.source_id||null};
 if(decision!=="confirm")return{ok:false,error:"invalid_decision"};
 const c={...candidate,...edits};if(!c.summary)return{ok:false,error:"missing_summary"};
 return{ok:true,state:"confirmed",source_id:c.source_id||null,item:c};
}
export function routeDedupeKey(candidate={}){return `${candidate.source_id||"unknown"}:${candidate.route||candidate.kind||"review"}`;}
