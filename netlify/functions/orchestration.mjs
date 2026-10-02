export const DESTINATIONS={
 "homework_quest":{label:"Homework Quest",kind:"browser"},
 "control_centre.school_readiness":{label:"School Readiness",kind:"browser"},
 "control_centre.calendar_events":{label:"Calendar",kind:"queued"},
 "review_queue":{label:"Review",kind:"queued"},
 "control_centre.contacts_services":{label:"Contacts & Services",kind:"queued"},
 "control_centre.repairs":{label:"Repairs",kind:"queued"},
 "control_centre.shopping_radar":{label:"Shopping Radar",kind:"queued"},
 "control_centre.food_meal_planner":{label:"Food & Meal Planner",kind:"queued"},
 "control_centre.personal_admin":{label:"Personal Admin",kind:"queued"},
 "control_centre.pet_care":{label:"Pet Care",kind:"queued"},
 "control_centre.electricity":{label:"Electricity",kind:"queued"}
};
export function destinationSummary(routes=[],handoffs={}){
 return routes.map(route=>({route,label:DESTINATIONS[route]?.label||route,delivery:handoffs[route]?.delivery||DESTINATIONS[route]?.kind||"queued",available:!!handoffs[route]}));
}
export function shortcutMessage({duplicate=false,status="",routes=[],handoffs={}}={}){
 const names=destinationSummary(routes,handoffs).map(x=>x.label);
 if(status==="needs_review")return duplicate?"Already saved — still needs review":"Saved — needs review";
 if(!names.length)return duplicate?"Already in FamilyRoy":"Saved to FamilyRoy";
 const prefix=duplicate?"Already saved":"Saved";
 return `${prefix} → ${names.join(" + ")}`;
}
export function nextActions(routes=[],handoffs={}){
 return destinationSummary(routes,handoffs).filter(x=>x.available).map(x=>({route:x.route,label:`Open ${x.label}`,capability:handoffs[x.route].capability,expires_at:handoffs[x.route].expires_at}));
}

export function choosePrimaryAction(actions=[]){if(!actions.length)return null;const priority=["control_centre.school_readiness","homework_quest"];return priority.map(route=>actions.find(x=>x.route===route)).find(Boolean)||actions[0];}

export function destinationFragment(action,endpoint){if(!action?.capability||!endpoint)return null;const e=String(endpoint);if(!/^https:\/\//i.test(e))return null;const params=new URLSearchParams({familyroy:action.capability,endpoint:e.replace(/\/$/,"")});return params.toString();}

export function recoveryState({status="",duplicate=false,next_actions=[]}={}){
 if(status==="needs_review")return{state:"review",message:"Saved safely for review"};
 if(next_actions.length)return{state:"ready",message:duplicate?"Already saved — destination still available":"Saved — destination ready"};
 return{state:"saved",message:duplicate?"Already saved":"Saved safely"};
}

export function handoffStatus(routes=[],handoffs={}){const summary=destinationSummary(routes,handoffs),browser=summary.filter(x=>DESTINATIONS[x.route]?.kind==="browser");return{browser_total:browser.length,browser_ready:browser.filter(x=>x.available).length,queued_total:summary.filter(x=>DESTINATIONS[x.route]?.kind!=="browser").length,all_browser_ready:browser.every(x=>x.available)};}

export function shortcutPlan(response={},destinations={}){
 const action=response.primary_action;
 if(!action)return{message:response.shortcut_message||"Saved to FamilyRoy",open_url:null};
 const base=destinations[action.route];if(!base)return{message:response.shortcut_message||"Saved to FamilyRoy",open_url:null};
 const fragment=destinationFragment(action,destinations.intake_endpoint);if(!fragment)return{message:response.shortcut_message||"Saved to FamilyRoy",open_url:null};
 return{message:response.shortcut_message||"Saved to FamilyRoy",open_url:String(base).replace(/#.*$/,"")+"#"+fragment};
}

export function capabilityExposure(response={}){const caps=Object.values(response.handoffs||{}).map(x=>x?.capability).filter(Boolean);const serial=JSON.stringify({message:response.shortcut_message,destinations:response.destinations,recovery:response.recovery});return{capability_count:caps.length,leaked_in_safe_fields:caps.some(c=>serial.includes(c))};}
