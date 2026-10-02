import test from "node:test";
import assert from "node:assert/strict";
import {destinationSummary,shortcutMessage,nextActions,choosePrimaryAction,destinationFragment,recoveryState,handoffStatus} from "../netlify/functions/orchestration.mjs";
const H={homework_quest:{capability:"x",expires_at:"2026-10-02T20:00:00Z",delivery:"scoped_handoff"},"control_centre.school_readiness":{capability:"y",expires_at:"2026-10-02T20:00:00Z",delivery:"scoped_handoff"}};
test("multi-route response names each destination once",()=>{const routes=["homework_quest","control_centre.school_readiness","control_centre.calendar_events"];assert.equal(shortcutMessage({routes,handoffs:H}),"Saved → Homework Quest + School Readiness + Calendar");assert.deepEqual(destinationSummary(routes,H).map(x=>x.label),["Homework Quest","School Readiness","Calendar"]);});
test("next actions contain only browser destinations with capabilities",()=>{const a=nextActions(["homework_quest","control_centre.school_readiness","control_centre.calendar_events"],H);assert.equal(a.length,2);assert.deepEqual(a.map(x=>x.label),["Open Homework Quest","Open School Readiness"]);assert.ok(a.every(x=>x.capability));});
test("duplicate response stays informative without creating false work",()=>{assert.equal(shortcutMessage({duplicate:true,routes:["control_centre.calendar_events"],handoffs:{}}),"Already saved → Calendar");assert.deepEqual(nextActions(["control_centre.calendar_events"],{}),[]);});
test("review message takes precedence over route labels",()=>{assert.equal(shortcutMessage({status:"needs_review",routes:["review_queue"]}),"Saved — needs review");assert.equal(shortcutMessage({duplicate:true,status:"needs_review",routes:["review_queue"]}),"Already saved — still needs review");});

test("School Readiness is primary for mixed physical + homework share",()=>{const a=nextActions(["homework_quest","control_centre.school_readiness"],H);assert.equal(choosePrimaryAction(a).route,"control_centre.school_readiness");});
test("Homework is primary when it is the only browser handoff",()=>{const a=nextActions(["homework_quest","control_centre.calendar_events"],H);assert.equal(choosePrimaryAction(a).route,"homework_quest");});
test("no browser handoff means no forced app opening",()=>{assert.equal(choosePrimaryAction([]),null);});

test("destination handoff uses fragment parameters rather than a full URL",()=>{const f=destinationFragment({capability:"secret-cap"}, "https://preview.example/");assert.equal(f,"familyroy=secret-cap&endpoint=https%3A%2F%2Fpreview.example");assert.ok(!f.startsWith("http"));});

test("recovery state distinguishes saved, ready and review",()=>{assert.equal(recoveryState({}).state,"saved");assert.equal(recoveryState({next_actions:[{route:"homework_quest"}]}).state,"ready");assert.equal(recoveryState({status:"needs_review"}).state,"review");});
test("duplicate pending destination remains recoverable",()=>{assert.deepEqual(recoveryState({duplicate:true,next_actions:[{route:"homework_quest"}]}),{state:"ready",message:"Already saved — destination still available"});});

test("handoff status reports mixed browser and queued delivery",()=>{assert.deepEqual(handoffStatus(["homework_quest","control_centre.school_readiness","control_centre.calendar_events"],H),{browser_total:2,browser_ready:2,queued_total:1,all_browser_ready:true});});
test("missing capability is visible in diagnostics",()=>{const h={homework_quest:H.homework_quest};assert.deepEqual(handoffStatus(["homework_quest","control_centre.school_readiness"],h),{browser_total:2,browser_ready:1,queued_total:1,all_browser_ready:false});});
