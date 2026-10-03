import crypto from "node:crypto";
export const HANDOFF_TTL_MS=15*60*1000;
export function tokenHash(token){return crypto.createHash("sha256").update(String(token)).digest("hex");}
export function newCapability(){return crypto.randomBytes(32).toString("base64url");}
export function validCapability(token){return /^[A-Za-z0-9_-]{43}$/.test(String(token||""));}
export function handoffKey(token){return `handoffs/${tokenHash(token)}.json`;}
export function createHandoffRecord({token,route,source_id,now=Date.now(),ttlMs=HANDOFF_TTL_MS}){
 if(!validCapability(token))throw new Error("invalid_capability");
 if(!route)throw new Error("invalid_route");
 if(!/^[a-f0-9]{64}$/i.test(String(source_id||"")))throw new Error("invalid_source_id");
 return{version:1,route,source_id,created_at:new Date(now).toISOString(),expires_at:new Date(now+ttlMs).toISOString(),status:"issued"};
}
export function handoffState(record,now=Date.now()){
 if(!record)return"missing";
 if(record.status==="acknowledged")return"acknowledged";
 if(Date.parse(record.expires_at)<=now)return"expired";
 return record.status==="redeemed"?"redeemed":"issued";
}
export function allowedOrigin(route,env={}){
 const key=route==="control_centre.school_readiness"?"FAMILYROY_CONTROL_CENTRE_ORIGIN":route==="homework_quest"?"FAMILYROY_HOMEWORK_ORIGIN":"";
 return key?String(env[key]||""):"";
}

export function canAcknowledge(record,sourceId,now=Date.now()){const state=handoffState(record,now);if(String(sourceId||"")!==String(record?.source_id||""))return{ok:false,error:"source_mismatch"};if(state==="expired")return{ok:false,error:"expired"};if(state==="acknowledged")return{ok:true,duplicate:true};if(state!=="redeemed")return{ok:false,error:"redeem_required"};return{ok:true,duplicate:false};}

export function preflightOriginAllowed(origin,env={}){const o=String(origin||"");if(!o)return false;return["FAMILYROY_CONTROL_CENTRE_ORIGIN","FAMILYROY_HOMEWORK_ORIGIN"].some(k=>String(env[k]||"")===o);}

export function extractHandoffToken(header=""){return String(header||"").replace(/^Handoff\s+/i,"");}
