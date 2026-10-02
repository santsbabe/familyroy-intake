const DESTINATIONS={
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
