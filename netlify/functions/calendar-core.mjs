const WEEKDAY=/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i;
const MONTHS={january:0,jan:0,february:1,feb:1,march:2,mar:2,april:3,apr:3,may:4,june:5,jun:5,july:6,jul:6,august:7,aug:7,september:8,sep:8,october:9,oct:9,november:10,nov:10,december:11,dec:11};
function isoLocal(d){const p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;}
function parseClock(s){if(!s)return null;const m=String(s).match(/^(\d{1,2})[:.](\d{2})$/);if(!m)return null;const h=+m[1],min=+m[2];return h<24&&min<60?[h,min]:null;}
export function resolveCalendarCandidate(candidate={},referenceDate=new Date()){
 const dateText=String(candidate.date_text||"").trim(),clock=parseClock(candidate.time_text),ref=new Date(referenceDate);
 if(Number.isNaN(ref.getTime()))return{status:"needs_confirmation",reason:"invalid_reference_date",candidate};
 let target=null,reason=null;
 if(/^today$/i.test(dateText)){target=new Date(ref);reason="relative_today";}
 else if(/^tomorrow$/i.test(dateText)){target=new Date(ref);target.setDate(target.getDate()+1);reason="relative_tomorrow";}
 else if(WEEKDAY.test(dateText)){target=new Date(ref);const names=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"],want=names.indexOf(dateText.toLowerCase()),delta=(want-ref.getDay()+7)%7||7;target.setDate(target.getDate()+delta);reason="relative_weekday";}
 else {const m=dateText.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(20\d{2}))?$/);if(m&&MONTHS[m[2].toLowerCase()]!==undefined){target=new Date(ref);target.setFullYear(m[3]?+m[3]:ref.getFullYear(),MONTHS[m[2].toLowerCase()],+m[1]);reason=m[3]?"explicit_date":"year_inferred";}}
 if(!target||!dateText)return{status:"needs_confirmation",reason:"unresolved_date",candidate};
 if(clock)target.setHours(clock[0],clock[1],0,0);else target.setHours(0,0,0,0);
 const safe=reason==="explicit_date";
 return{status:safe?"ready":"needs_confirmation",reason,title:candidate.title||"FamilyRoy event",start_local:isoLocal(target),all_day:!clock,alerts:safe?(clock?[{offset_minutes:-1440},{offset_minutes:-60}]:[{offset_minutes:-1440},{offset_minutes:-540}]):[],source_text:candidate.source_text||null,school:candidate.school||null,children:candidate.children||[]};
}
export function calendarDedupeKey(sourceId,candidate={}){return `${sourceId}:calendar:${String(candidate.date_text||"").toLowerCase()}:${String(candidate.time_text||"all-day")}`;}
