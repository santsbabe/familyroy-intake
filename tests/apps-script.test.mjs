import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=readFileSync(new URL("../integrations/google-apps-script/gmail-school-ingest.gs",import.meta.url),"utf8");

test("Gmail school Apps Script parses as JavaScript",()=>{
  assert.doesNotThrow(()=>new Function(source));
});

test("school source is archived before it is posted to intake",()=>{
  const archiveAt=source.indexOf("archiveNewsletterEmail_(message, archiveFolderId)");
  const postAt=source.indexOf("postJson_(intakeUrl, token, payload)");
  assert.ok(archiveAt>=0);
  assert.ok(postAt>=0);
  assert.ok(archiveAt<postAt);
});

test("captured school sources are labelled out of future Gmail polling",()=>{
  assert.match(source,/FamilyRoy\/School Source Captured/);
  assert.match(source,/-label:/);
  assert.match(source,/addToThread\(thread\)/);
});

test("Apps Script keeps Canva public HTML diagnostic-only",()=>{
  assert.match(source,/function captureAuthoritativeCanva_\s*\(/);
  assert.match(source,/\/canva\/capture/);
  assert.match(source,/postJson_\(endpoint, token, \{ source_id: sourceId, original_url: canvaUrl \}\)/);
  assert.match(source,/function reportCanvaFailure_\s*\(/);
  assert.match(source,/canva_failures:\s*\[/);
  assert.doesNotMatch(source,/capture_method:\s*["']public_html["']/);
});
