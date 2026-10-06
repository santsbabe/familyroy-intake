import test from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { prepareEvidence, MAX_ATTACHMENT_BYTES } from "../netlify/functions/attachments.mjs";

const b64=b=>Buffer.from(b).toString("base64");
test("image evidence is hashed and stripped of inline bytes",()=>{
 const p=prepareEvidence({attachments:[{name:"notice.jpg",mime_type:"image/jpeg",data_base64:b64(Buffer.from("fake-image"))}]});
 assert.equal(p.attachments.length,1); assert.equal(p.attachments[0].size,10); assert.ok(p.attachments[0].sha256); assert.equal("data_base64" in p.attachments[0],false); assert.equal(p._evidence[0].kind,"image");
});
test("WhatsApp export ZIP extracts chat text and marks source type",()=>{
 const zip=zipSync({"_chat.txt":strToU8("PNPS: Harrison homework is reading page 12. Bring library bag on Friday."),"Alice.vcf":strToU8("BEGIN:VCARD\nFN:Alice\nEND:VCARD")});
 const p=prepareEvidence({source_type:"whatsapp_share",attachments:[{name:"WhatsApp Chat.zip",mime_type:"application/zip",data_base64:b64(zip)}]});
 assert.equal(p.source_type,"whatsapp_export"); assert.match(p.text,/Harrison homework/); assert.equal(p.attachments[0].archive_entries,2); assert.equal(p.attachments[0].chat_file,"_chat.txt");
});
test("oversize attachment is rejected",()=>{
 const oversized=Buffer.alloc(MAX_ATTACHMENT_BYTES+1,1);
 assert.throws(()=>prepareEvidence({attachments:[{name:"huge.bin",data_base64:b64(oversized)}]}),/attachment_too_large/);
});
test("invalid ZIP is rejected",()=>{assert.throws(()=>prepareEvidence({attachments:[{name:"bad.zip",mime_type:"application/zip",data_base64:b64(Buffer.from("nope"))}]}),/invalid_zip/);});

test("universal payload decodes shared text without branching",()=>{
 const p=prepareEvidence({source_type:"whatsapp_share",payload:{name:"shared-item",data_base64:b64(Buffer.from("PNPS: Harrison homework is reading page 12."))}});
 assert.match(p.text,/Harrison homework/); assert.equal(p._evidence[0].kind,"text"); assert.equal(p.attachments[0].mime_type,"text/plain");
});
test("universal payload detects PNG bytes without MIME supplied",()=>{
 const png=Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),Buffer.from("test")]);
 const p=prepareEvidence({payload:{name:"shared-item",data_base64:b64(png)}});
 assert.equal(p._evidence[0].kind,"image"); assert.equal(p.attachments[0].mime_type,"image/png");
});
test("universal payload detects WhatsApp ZIP by bytes even without zip filename or MIME",()=>{
 const zip=zipSync({"_chat.txt":strToU8("PNPS: Harrison homework is reading page 12. Wear Bokke shirt on Friday.")});
 const p=prepareEvidence({source_type:"whatsapp_share",payload:{name:"shared-item",data_base64:b64(zip)}});
 assert.equal(p.source_type,"whatsapp_export"); assert.match(p.text,/Wear Bokke shirt/); assert.equal(p.attachments[0].chat_file,"_chat.txt");
});
