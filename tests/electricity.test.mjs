import test from "node:test";
import assert from "node:assert/strict";
import {electricityCandidate,usageInterval,electricityDecision} from "../netlify/functions/electricity-core.mjs";
const source="c".repeat(64);
test("numeric reading is parsed",()=>{assert.equal(electricityCandidate({text:"Meter reading 12345.6 kWh"}).reading,12345.6);});
test("missing reading stays reviewable",()=>{assert.equal(electricityCandidate({text:"electricity meter"}).needs_confirmation,true);});
test("prepaid remaining-balance decrease measures consumption",()=>{const x=usageInterval({reading:129.06},{reading:125.39});assert.equal(Number(x.usage_kwh.toFixed(2)),3.67);assert.equal(x.needs_attribution,true);});
test("increasing prepaid balance indicates top-up, not consumption",()=>{assert.equal(usageInterval({reading:100},{reading:107}),null);});
test("confirmed reading is accepted",()=>{assert.equal(electricityDecision(source,{reading:123},"confirm").state,"confirmed");});
test("missing reading cannot commit",()=>{assert.equal(electricityDecision(source,{reading:null},"confirm").ok,false);});

test("identical prepaid balance records zero consumption",()=>{assert.equal(usageInterval({reading:125.39},{reading:125.39}).usage_kwh,0);});
