/**
 * FamilyRoy Gmail school-source forwarder.
 * Install once as a standalone Google Apps Script under Santie's Google account.
 * Required Script Property: FAMILYROY_INTAKE_URL
 * Optional: FAMILYROY_INTAKE_TOKEN
 *
 * This script forwards Gmail evidence and Canva URLs to FamilyRoy, then asks the
 * preview/production FamilyRoy service to attempt a guarded public-share capture.
 * Canva credentials never live in Gmail. Failed captures remain awaiting enrichment
 * and are retried idempotently on a later run.
 */
const FAMILYROY_QUERY = "newer_than:2d {from:communications@pnps.co.za from:aftercare@pnps.co.za \"canva.link\" \"canva.com/design\"}";

function ingestSchoolMail() {
  const props = PropertiesService.getScriptProperties();
  const intakeUrl = props.getProperty("FAMILYROY_INTAKE_URL");
  if (!intakeUrl) throw new Error("Missing FAMILYROY_INTAKE_URL Script Property.");
  const token = props.getProperty("FAMILYROY_INTAKE_TOKEN");
  const threads = GmailApp.search(FAMILYROY_QUERY, 0, 50);
  for (const thread of threads) {
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
          console.error("FamilyRoy intake failed", message.getId(), response.getResponseCode(), response.getContentText());
          continue;
        }
        let intakeResult = {};
        try { intakeResult = JSON.parse(response.getContentText()); } catch (_) {}
        if (intakeResult.status !== "awaiting_enrichment") continue;
        for (const canvaUrl of urls) {
          const capture = capturePublicCanva_(intakeUrl, token, canvaUrl);
          if (!capture || !capture.usable) continue;
          const enriched = Object.assign({}, payload, {
            canva_captures: [{
              original_url: canvaUrl,
              resolved_url: capture.resolved_url,
              captured_at: capture.captured_at,
              content_text: capture.text,
              evidence_ref: "gmail:" + message.getId(),
              capture_method: capture.capture_method || "public_html"
            }]
          });
          const enrichedResponse = UrlFetchApp.fetch(intakeUrl, {
            method: "post",
            contentType: "application/json",
            payload: JSON.stringify(enriched),
            muteHttpExceptions: true,
            headers: token ? { Authorization: "Bearer " + token } : {}
          });
          if (enrichedResponse.getResponseCode() < 200 || enrichedResponse.getResponseCode() >= 300) {
            console.error("FamilyRoy Canva enrichment failed", message.getId(), enrichedResponse.getResponseCode(), enrichedResponse.getContentText());
          }
        }
      } catch (err) {
        console.error("FamilyRoy intake exception", message.getId(), err);
      }
    }
  }
}

function extractCanvaUrls_(text) {
  const matches = String(text || "").match(/https?:\/\/(?:www\.)?(?:canva\.link|canva\.com)\/[^\s<>"')\]]+/gi) || [];
  return [...new Set(matches.map(u => u.replace(/&amp;/g, "&").replace(/[.,;:!?]+$/, "")))];
}


function capturePublicCanva_(intakeUrl, token, canvaUrl) {
  try {
    const endpoint = intakeUrl.replace(/\/intake\/?$/, "/canva-public");
    const response = UrlFetchApp.fetch(endpoint, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ url: canvaUrl }),
      muteHttpExceptions: true,
      headers: token ? { Authorization: "Bearer " + token } : {}
    });
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) return null;
    return JSON.parse(response.getContentText());
  } catch (err) {
    console.error("Public Canva capture failed", canvaUrl, err);
    return null;
  }
}

/** Run once after setting FAMILYROY_INTAKE_URL. */
function installFamilyRoyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "ingestSchoolMail")
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("ingestSchoolMail").timeBased().everyMinutes(15).create();
}
