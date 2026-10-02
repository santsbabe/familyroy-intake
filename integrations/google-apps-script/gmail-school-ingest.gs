/**
 * FamilyRoy Gmail school-source forwarder.
 * Install once as a standalone Google Apps Script under Santie's Google account.
 * Required Script Property: FAMILYROY_INTAKE_URL
 * Optional: FAMILYROY_INTAKE_TOKEN
 *
 * This script deliberately does NOT scrape Canva. It forwards the Gmail evidence
 * and every Canva URL to FamilyRoy. Canva resolution/content capture is a separate
 * source-adapter step so credentials never live in Gmail.
 */
const FAMILYROY_PROCESSED_LABEL = "FamilyRoy/Processed";
const FAMILYROY_QUERY = [
  "-label:" + FAMILYROY_PROCESSED_LABEL,
  "newer_than:30d",
  "(",
  "from:communications@pnps.co.za",
  "OR from:aftercare@pnps.co.za",
  "OR from:redroots@pnps.co.za",
  "OR \"canva.link\"",
  "OR \"canva.com/design\"",
  ")"
].join(" ");

function ingestSchoolMail() {
  const props = PropertiesService.getScriptProperties();
  const intakeUrl = props.getProperty("FAMILYROY_INTAKE_URL");
  if (!intakeUrl) throw new Error("Missing FAMILYROY_INTAKE_URL Script Property.");
  const token = props.getProperty("FAMILYROY_INTAKE_TOKEN");
  const label = GmailApp.getUserLabelByName(FAMILYROY_PROCESSED_LABEL) ||
    GmailApp.createLabel(FAMILYROY_PROCESSED_LABEL);

  const threads = GmailApp.search(FAMILYROY_QUERY, 0, 50);
  for (const thread of threads) {
    let complete = true;
    for (const message of thread.getMessages()) {
      if (message.isInTrash()) continue;
      const html = message.getBody();
      const plain = message.getPlainBody();
      const urls = extractCanvaUrls_(html + "\n" + plain);
      if (!urls.length) continue;

      const payload = {
        source_type: "gmail",
        source_chat: message.getSubject(),
        sender: message.getFrom(),
        source_timestamp: message.getDate().toISOString(),
        text: plain,
        canva_urls: urls,
        raw_evidence_ref: "gmail:" + message.getId(),
        client_context: {
          gmail_message_id: message.getId(),
          gmail_thread_id: thread.getId(),
          subject: message.getSubject()
        }
      };
      try {
        const response = UrlFetchApp.fetch(intakeUrl, {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
          headers: token ? { Authorization: "Bearer " + token } : {}
        });
        if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
          complete = false;
          console.error("FamilyRoy intake failed", message.getId(), response.getResponseCode(), response.getContentText());
        }
      } catch (err) {
        complete = false;
        console.error("FamilyRoy intake exception", message.getId(), err);
      }
    }
    if (complete) thread.addLabel(label);
  }
}

function extractCanvaUrls_(text) {
  const matches = String(text || "").match(/https?:\\/\\/(?:www\\.)?(?:canva\\.link|canva\\.com)\\/[^\\s<>"')\\]]+/gi) || [];
  return [...new Set(matches.map(u => u.replace(/&amp;/g, "&").replace(/[.,;:!?]+$/, "")))];
}

/** Run once after setting FAMILYROY_INTAKE_URL. */
function installFamilyRoyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "ingestSchoolMail")
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("ingestSchoolMail").timeBased().everyMinutes(15).create();
}
