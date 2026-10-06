import test from "node:test";
import assert from "node:assert/strict";
import {domainCandidate,reviewDecision,routeDedupeKey} from "../netlify/functions/domain-core.mjs";
const source="d".repeat(64);
for(const [route,kind] of [["control_centre.personal_admin","personal_admin"],["control_centre.pet_care","pet_care"],["control_centre.shopping_radar","shopping"],["control_centre.food_meal_planner","food_meal"]])test(route+" remains review-first",()=>{const x=domainCandidate(route,{source_id:source,text:"Example item",evidence:[{sha256:"x"}]});assert.equal(x.kind,kind);assert.equal(x.needs_confirmation,true);assert.equal(x.evidence.length,1);});
test("review confirmation and rejection are explicit",()=>{const x=domainCandidate("control_centre.personal_admin",{source_id:source,text:"Renew document"});assert.equal(reviewDecision(x,"confirm").state,"confirmed");assert.equal(reviewDecision(x,"reject").state,"rejected");assert.equal(reviewDecision(x,"later").ok,false);});
test("remaining-domain dedupe is source and route scoped",()=>{const a=domainCandidate("control_centre.pet_care",{source_id:source,text:"Vet item"});assert.equal(routeDedupeKey(a),source+":control_centre.pet_care");});
