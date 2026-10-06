import test from "node:test";
import assert from "node:assert/strict";
import {contactCandidate,contactsDedupeKey,contactDecision,findContactMatch,mergeContact,upsertContact} from "../netlify/functions/contacts-core.mjs";
import {buildRecord,ROUTES} from "../netlify/functions/core.mjs";
const source="a".repeat(64);
test("contact candidate extracts service without inventing identity",()=>{const c=contactCandidate({text:"Can recommend a great plumber"});assert.equal(c.service,"plumber");assert.equal(c.name,null);assert.equal(c.needs_confirmation,true);});
test("contact candidate preserves provenance",()=>{const c=contactCandidate({text:"Recommend Chelsea Cleaning",source_chat:"Neighbourhood group",sender:"Neighbour",source_timestamp:"2026-10-06T10:00:00+02:00",evidence:[{sha256:"abc"}]});assert.equal(c.service,"cleaning");assert.equal(c.source_chat,"Neighbourhood group");assert.equal(c.evidence[0].sha256,"abc");});
test("under-specified recommendation requires confirmation",()=>{const c=contactCandidate({text:"I recommend Sarah"});assert.equal(c.needs_confirmation,true);});
test("confirmed contact requires identity and service",()=>{const d=contactDecision(source,{name:"Sarah",service:"plumber",notes:"recommended"},"confirm");assert.equal(d.state,"confirmed");assert.equal(d.contact.name,"Sarah");assert.equal(d.contact.service,"plumber");});
test("missing service cannot be silently committed",()=>{const d=contactDecision(source,{name:"Sarah",notes:"recommended"},"confirm");assert.equal(d.ok,false);assert.equal(d.error,"missing_service");});
test("reject is terminal without creating contact",()=>{const d=contactDecision(source,{name:"Sarah"},"reject");assert.equal(d.state,"rejected");assert.equal(d.contact,undefined);});
test("contact dedupe is stable",()=>{const c={name:"Sarah",service:"plumber"};assert.equal(contactsDedupeKey(source,c),contactsDedupeKey(source,c));});
test("Contacts route gets structured candidate while Repairs remains independent",()=>{const r=buildRecord({source_chat:"Neighbourhood group",text:"Recommend Sarah the plumber to fix the leak"});assert.ok(r.routes.includes(ROUTES.CONTACTS));assert.ok(r.routes.includes(ROUTES.REPAIRS));assert.equal(r.route_payloads[ROUTES.CONTACTS].mode,"contact_candidate");assert.equal(r.route_payloads[ROUTES.CONTACTS].contact_candidate.service,"plumber");assert.equal(r.route_payloads[ROUTES.REPAIRS].mode,"repair_candidate");});

test("same named provider merges additional service rather than duplicating",()=>{const existing=[{name:"Chelsea Cleaning",services:["cleaning"],source_ids:["old"]}],incoming={name:"Chelsea Cleaning",service:"cleaner",source_id:source};const r=upsertContact(existing,incoming);assert.equal(r.action,"merge");assert.deepEqual(r.contact.services.sort(),["cleaner","cleaning"]);assert.equal(r.directory.length,1);});
test("different named providers never merge merely because service matches",()=>{const r=findContactMatch({name:"Sarah",service:"plumber"},[{name:"Sam",service:"plumber"}]);assert.equal(r.match,null);});
test("merge preserves old and new provenance",()=>{const x=mergeContact({name:"Sarah",source_ids:["old"],evidence:[{sha256:"old"}]},{name:"Sarah",service:"plumber",source_id:source,evidence:[{sha256:"new"}]});assert.deepEqual(x.source_ids,["old",source]);assert.equal(x.evidence.length,2);});
test("new identity creates a new directory record",()=>{const r=upsertContact([{name:"Sarah",services:["plumber"]}],{name:"Rosa",service:"massage",source_id:source});assert.equal(r.action,"create");assert.equal(r.directory.length,2);});
