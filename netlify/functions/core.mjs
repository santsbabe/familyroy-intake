import crypto from "node:crypto";
export const ROUTES={SCHOOL_HOMEWORK:"homework_quest",SCHOOL_READINESS:"control_centre.school_readiness",CONTACTS:"control_centre.contacts_services",REPAIRS:"control_centre.repairs",SHOPPING:"control_centre.shopping_radar",FOOD:"control_centre.food_meal_planner",EVENTS:"control_centre.calendar_events",ADMIN:"control_centre.personal_admin",PETS:"control_centre.pet_care",ELECTRICITY:"control_centre.electricity",REVIEW:"review_queue"};
export function normalisePayload(input={}){const text=String(input.text??"").trim();const attachments=Array.isArray(input.attachments)?input.attachments:[];return{source_type:input.source_type||"whatsapp_share",source_chat:input.source_chat||null,sender:input.sender||null,source_timestamp:input.source_timestamp||null,text,attachments,content_types:[...new Set([...(text?["text"]:[]),...attachments.map(a=>a?.mime_type||a?.type||"file")])],raw_evidence_ref:input.raw_evidence_ref||null,client_context:input.client_context||null};}
export function fingerprint(payload){const canonical=JSON.stringify({source_type:payload.source_type,source_chat:payload.source_chat,sender:payload.sender,source_timestamp:payload.source_timestamp,text:payload.text,attachments:payload.attachments.map(a=>({name:a?.name||null,mime_type:a?.mime_type||a?.type||null,size:a?.size||null,sha256:a?.sha256||null}))});return crypto.createHash("sha256").update(canonical).digest("hex");}
const hasAny=(t,words)=>words.some(w=>t.includes(w));
const optionalSchool=/\b(optional|voluntary|if you would like|if you wish|welcome to|may participate|can participate|families are welcome|parents? may|parents? can|able to donate|purchase tickets?|buy tickets?)\b/i;
const informationalSchool=/\b(for your information|fyi|school fees?|fee structure|uniform shop|newsletter|lost property|sharing of food|positive friendships)\b/i;
const schoolAdmin=/\b(school fees?|fee structure|payment|debit order|invoice|account)\b/i;
const readinessAction=/\b(bring|wear|pack|return|hand in|drop off|sign|complete|fill|submit|send|pay|prepare|collect|required|must|ensure|make sure|due)\b/i;
const physicalReadinessAction=/\b(bring|wear|pack|return|hand in|drop off|sign|complete|fill|submit|send|pay|prepare|collect)\b/i;
const readinessObject=/\b(civvies|uniform|sports? kit|library (?:bag|book)|costume|hat|shoes?|shirt|money|form|permission|consent|project|raffle|donation|assessment (?:file|folder)|red book|homework book|book bag|swimming|gala|kaskar)\b/i;
const impliedPrepObject=/\b(civvies|uniform|sports? kit|library (?:bag|book)|costume|hat|shoes?|shirt|assessment (?:file|folder)|red book|homework book|book bag)\b/i;
const learningTask=/\b(homework|huiswerk|spelling|reading|lees|maths|wiskunde|worksheet|revise|hersien|klanke|phonics|sight words?|practise|practice|learn|page(?:s)?\s+\d|poem)\b/i;
const concreteDate=/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|deadline|due|rsvp|save the date|\d{1,2}[:.]\d{2}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))\b/i;
function inferSchool(t,chat=""){const s=(t+" "+chat).toLowerCase();if(hasAny(s,["pnps","pinelands north primary"]))return"PNPS";if(hasAny(s,["red roots"]))return"Red Roots";if(hasAny(s,["100 acre wood","100acrewood","haw"]))return"100 Acre Wood";return null;}
function inferChildren(t,school){const names=[];if(/\bharrison\b/i.test(t))names.push("Harrison");if(/\balexander\b|\balex\b/i.test(t))names.push("Alexander");if(/\bimogen\b/i.test(t))names.push("Imogen");if(!names.length&&school==="100 Acre Wood")names.push("Imogen");return names;}
export function classify(payload){const raw=payload.text||"",t=raw.toLowerCase(),routes=[],reasons=[];let confidence=.45;const schoolName=inferSchool(t,payload.source_chat||"");const schoolContext=!!schoolName||hasAny(t,["school","teacher","class","grade r","homework","huiswerk"]);const homework=schoolContext&&learningTask.test(raw);const segments=raw.split(/[.!?\n;]+|\bbut\b/i).map(s=>s.trim()).filter(Boolean);const readiness=schoolContext&&segments.some(seg=>((physicalReadinessAction.test(seg)||(readinessAction.test(seg)&&!learningTask.test(seg)))&&(readinessObject.test(seg)||/\bR\s?\d+(?:[.,]\d{2})?\b/i.test(seg))||impliedPrepObject.test(seg)&&concreteDate.test(seg))&&!optionalSchool.test(seg)&&!informationalSchool.test(seg)&&!schoolAdmin.test(seg));const event=schoolContext&&concreteDate.test(raw)&&(homework||readiness||/\b(event|meeting|outing|excursion|gala|concert|sports? day|photo day|book day)\b/i.test(raw));
if(homework){routes.push(ROUTES.SCHOOL_HOMEWORK);reasons.push("school learning task");confidence=Math.max(confidence,.9);}
if(readiness){routes.push(ROUTES.SCHOOL_READINESS);reasons.push("concrete school readiness action");confidence=Math.max(confidence,.9);}
if(event){routes.push(ROUTES.EVENTS);reasons.push("actionable school item contains a date/day candidate");confidence=Math.max(confidence,.78);}
if(hasAny(t,["plumber","electrician","handyman","cleaner","cleaning","gardener","repair","fix","recommend","recommendation","contact number","whatsapp him","whatsapp her"])){routes.push(ROUTES.CONTACTS);reasons.push("service/contact recommendation");confidence=Math.max(confidence,.78);if(hasAny(t,["repair","fix","broken","leak","plumber","electrician","handyman"]))routes.push(ROUTES.REPAIRS);}
if(hasAny(t,["special","sale","deal","price","checkers","pick n pay","woolworths","food lover","dis-chem","clicks","takealot","temu"])||/\bpnp\b/i.test(t)){routes.push(ROUTES.SHOPPING);reasons.push("shopping/deal language");confidence=Math.max(confidence,.8);}
if(hasAny(t,["recipe","dinner","lunch","breakfast","meal","ingredients","vegan","vegetarian"])){routes.push(ROUTES.FOOD);reasons.push("food/meal language");confidence=Math.max(confidence,.72);}
if(!schoolContext&&hasAny(t,["invitation","invite","rsvp","appointment","meeting","party","concert","on saturday","on sunday","save the date"])){routes.push(ROUTES.EVENTS);reasons.push("event/date language");confidence=Math.max(confidence,.75);}
if(hasAny(t,["passport","home affairs","licence","license","id document","birth certificate","sars","municipal account"])){routes.push(ROUTES.ADMIN);reasons.push("personal admin language");confidence=Math.max(confidence,.82);}
if(hasAny(t,["vet","vaccine","vaccination","dog","cat","pet","rescue","groomer"])){routes.push(ROUTES.PETS);reasons.push("pet-care language");confidence=Math.max(confidence,.75);}
const electricityContext=payload.source_type==="electricity_meter_photo"||payload.client_context?.route===ROUTES.ELECTRICITY||hasAny(t,["meter reading","electricity meter","kwh","prepaid electricity"]);if(electricityContext){routes.push(ROUTES.ELECTRICITY);reasons.push(payload.source_type==="electricity_meter_photo"?"electricity meter photo":"electricity language");confidence=Math.max(confidence,.9);}
const unique=[...new Set(routes)];return{routes:(!unique.length||confidence<.6)?[ROUTES.REVIEW]:unique,confidence,reasons:reasons.length?reasons:["no sufficiently confident route"],school:schoolName,children:inferChildren(payload.text,schoolName)};}
export function buildRoutePayloads(payload,routing,source_id){const base={source_id,source_type:payload.source_type,source_chat:payload.source_chat,sender:payload.sender,source_timestamp:payload.source_timestamp,text:payload.text,evidence:payload.attachments};const out={};for(const route of routing.routes){if(route===ROUTES.SCHOOL_HOMEWORK)out[route]={...base,school:routing.school,children:routing.children,mode:"import_candidate",fidelity:"preserve_source"};else if(route===ROUTES.SCHOOL_READINESS)out[route]={...base,school:routing.school,children:routing.children,mode:"parse_readiness",dedupe_key:source_id};else if(route===ROUTES.EVENTS)out[route]={...base,school:routing.school,children:routing.children,mode:"extract_event_candidate"};else if(route===ROUTES.REVIEW)out[route]={...base,mode:"human_review"};else out[route]={...base,mode:"domain_intake"};}return out;}
export function buildRecord(input,now=new Date()){const payload=normalisePayload(input),source_id=fingerprint(payload),routing=classify(payload),route_payloads=buildRoutePayloads(payload,routing,source_id);return{source_id,source_type:payload.source_type,received_at:now.toISOString(),source_chat:payload.source_chat,sender:payload.sender,source_timestamp:payload.source_timestamp,content_types:payload.content_types,raw_evidence_ref:payload.raw_evidence_ref,text:payload.text,attachments:payload.attachments,extracted:{school:routing.school,children:routing.children},routes:routing.routes,route_payloads,confidence:routing.confidence,routing_reasons:routing.reasons,status:routing.routes.includes(ROUTES.REVIEW)?"needs_review":"routed"};}

export function extractElectricityReading(input={}) {
  const explicitRaw=input.reading_kwh ?? input.meter_reading ?? input.reading;
  const explicit=explicitRaw===null||explicitRaw===undefined||explicitRaw===""?NaN:Number(explicitRaw);
  if(Number.isFinite(explicit)&&explicit>=0&&explicit<=999.99){
    return{reading_kwh:Number(explicit.toFixed(2)),confidence:.99,source:"explicit"};
  }
  const t=String(input.text??"");
  const matches=[...t.matchAll(/(?:^|[^\d])(\d{1,3}[\.,]\d{1,2})(?=$|[^\d])/g)]
    .map(m=>Number(m[1].replace(",",".")))
    .filter(n=>Number.isFinite(n)&&n>=0&&n<=999.99);
  if(matches.length===1)return{reading_kwh:Number(matches[0].toFixed(2)),confidence:.9,source:"ocr_text_decimal"};
  return{reading_kwh:null,confidence:0,source:"unresolved"};
}

export function buildElectricityReading(input={},previousReading=null,now=new Date()){
  const parsed=extractElectricityReading(input);
  const reading_at=input.source_timestamp||input.reading_at||now.toISOString();
  const previousRaw=previousReading===null||previousReading===undefined||previousReading===""?null:Number(previousReading);
  const previous=Number.isFinite(previousRaw)?previousRaw:null;
  let usage_kwh=null,anomaly=null;
  if(parsed.reading_kwh===null)anomaly="reading_unresolved";
  else if(previous!==null){
    usage_kwh=Number((previous-parsed.reading_kwh).toFixed(2));
    if(usage_kwh<0)anomaly="reading_increased";
    else if(usage_kwh>100)anomaly="usage_spike";
  }
  return{
    reading_kwh:parsed.reading_kwh,
    reading_at,
    previous_reading_kwh:previous,
    usage_kwh,
    evidence_ref:input.raw_evidence_ref||null,
    extraction_confidence:parsed.confidence,
    extraction_source:parsed.source,
    status:anomaly?"needs_review":"logged",
    anomaly
  };
}
