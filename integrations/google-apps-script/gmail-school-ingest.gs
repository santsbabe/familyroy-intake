/**
 * FamilyRoy Gmail school-source forwarder.
 * Install once as a standalone Google Apps Script under the connected Google account.
 *
 * Required Script Properties:
 * - FAMILYROY_INTAKE_URL
 * - SCHOOL_NEWSLETTER_FOLDER_ID
 * - SCHOOL_NEWSLETTER_GMAIL_QUERY
 * Optional:
 * - FAMILYROY_INTAKE_TOKEN
 * - SCHOOL_CAPTURED_LABEL
 *
 * The script archives each matching Canva-linked school email as a deterministic PDF first,
 * then forwards Gmail evidence + Canva URLs + Drive provenance to FamilyRoy.
 * Canva content itself remains a separate enrichment step; OAuth secrets never
 * live in Apps Script.
 */
const DEFAULT_CAPTURED_LABEL = "FamilyRoy/School Source Captured";

function schoolQuery_(props) {
  const capturedLabel = props.getProperty("SCHOOL_CAPTURED_LABEL") || DEFAULT_CAPTURED_LABEL;
  const configured = props.getProperty("SCHOOL_NEWSLETTER_GMAIL_QUERY");
  if (!configured) throw new Error("Missing SCHOOL_NEWSLETTER_GMAIL_QUERY Script Property.");
  return {
    capturedLabel: capturedLabel,
    query: configured + ' {canva.link canva.com/design} -label:"' + capturedLabel + '"'
  };
}

function ingestSchoolMail() {
  const props = PropertiesService.getScriptProperties();
  const intakeUrl = props.getProperty("FAMILYROY_INTAKE_URL");
  if (!intakeUrl) throw new Error("Missing FAMILYROY_INTAKE_URL Script Property.");
  const token = props.getProperty("FAMILYROY_INTAKE_TOKEN");
  const archiveFolderId = props.getProperty("SCHOOL_NEWSLETTER_FOLDER_ID");
  if (!archiveFolderId) throw new Error("Missing SCHOOL_NEWSLETTER_FOLDER_ID Script Property.");
  const schoolQuery = schoolQuery_(props);

  const threads = GmailApp.search(schoolQuery.query, 0, 50);
  for (const thread of threads) {
    for (const message of thread.getMessages()) {
      if (message.isInTrash()) continue;

      const html = message.getBody();
      const plain = message.getPlainBody();
      const urls = extractCanvaUrls_(html + "\n" + plain);
      if (!urls.length) continue;

      let archive = null;
      try {
        archive = archiveNewsletterEmail_(message, archiveFolderId);
      } catch (err) {
        console.error("School newsletter PDF archive failed", message.getId(), err);
      }

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
          subject: message.getSubject(),
          source_kind: "school_newsletter",
          source_archive: archive
        }
      };

      try {
        const response = postJson_(intakeUrl, token, payload);
        if (!response.ok) {
          console.error("FamilyRoy intake failed", message.getId(), response.status, response.text);
          continue;
        }

        const intakeResult = response.json || {};
        getOrCreateLabel_(schoolQuery.capturedLabel).addToThread(thread);
        if (intakeResult.status !== "awaiting_enrichment") continue;

        for (const canvaUrl of urls) {
          const capture = captureAuthoritativeCanva_(intakeUrl, token, intakeResult.source_id, canvaUrl);
          if (capture && capture.ok) continue;

          if (Date.now() - message.getDate().getTime() > 24 * 60 * 60 * 1000) {
            reportCanvaFailure_(
              intakeUrl,
              token,
              payload,
              canvaUrl,
              capture && capture.error ? capture.error : "authoritative_canva_capture_missing_after_24h"
            );
          }
        }
      } catch (err) {
        console.error("FamilyRoy intake exception", message.getId(), err);
      }
    }
  }
}

function archiveNewsletterEmail_(message, folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const filename = newsletterPdfFilename_(message);
  const existing = folder.getFilesByName(filename);
  if (existing.hasNext()) {
    const file = existing.next();
    return {
      drive_file_id: file.getId(),
      drive_url: file.getUrl(),
      filename: file.getName(),
      archived_at: null,
      duplicate: true
    };
  }

  const html = [
    "<!doctype html><html><head><meta charset=\"utf-8\">",
    "<style>body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.4;color:#111}",
    ".meta{border-bottom:1px solid #ddd;padding-bottom:12px;margin-bottom:18px}",
    ".meta div{margin:3px 0}.label{font-weight:bold}</style></head><body>",
    "<div class=\"meta\">",
    "<div><span class=\"label\">Subject:</span> ", escapeHtml_(message.getSubject()), "</div>",
    "<div><span class=\"label\">From:</span> ", escapeHtml_(message.getFrom()), "</div>",
    "<div><span class=\"label\">To:</span> ", escapeHtml_(message.getTo()), "</div>",
    "<div><span class=\"label\">Date:</span> ", escapeHtml_(message.getDate().toISOString()), "</div>",
    "<div><span class=\"label\">Gmail message ID:</span> ", escapeHtml_(message.getId()), "</div>",
    "</div>",
    message.getBody(),
    "</body></html>"
  ].join("");

  const pdfBlob = Utilities.newBlob(html, "text/html", filename + ".html")
    .getAs(MimeType.PDF)
    .setName(filename);
  const file = folder.createFile(pdfBlob);
  file.setDescription("FamilyRoy source Gmail message ID: " + message.getId());

  return {
    drive_file_id: file.getId(),
    drive_url: file.getUrl(),
    filename: file.getName(),
    archived_at: new Date().toISOString(),
    duplicate: false
  };
}

function newsletterPdfFilename_(message) {
  const date = Utilities.formatDate(message.getDate(), Session.getScriptTimeZone() || "Africa/Johannesburg", "yyyy-MM-dd");
  const subject = String(message.getSubject() || "School Newsletter")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  const suffix = String(message.getId()).slice(-8);
  return date + " - " + subject + " - Email [" + suffix + "].pdf";
}

function escapeHtml_(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function extractCanvaUrls_(text) {
  const matches = String(text || "").match(/https?:\/\/(?:www\.)?(?:canva\.link|canva\.com)\/[^\s<>"')\]]+/gi) || [];
  return [...new Set(matches.map(u => u.replace(/&amp;/g, "&").replace(/[.,;:!?]+$/, "")))];
}

function postJson_(url, token, payload) {
  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    headers: token ? { Authorization: "Bearer " + token } : {}
  });
  let json = null;
  try { json = JSON.parse(response.getContentText()); } catch (_) {}
  return {
    ok: response.getResponseCode() >= 200 && response.getResponseCode() < 300,
    status: response.getResponseCode(),
    text: response.getContentText(),
    json: json
  };
}

function captureAuthoritativeCanva_(intakeUrl, token, sourceId, canvaUrl) {
  try {
    const endpoint = intakeUrl.replace(/\/intake\/?$/, "/canva/capture");
    const result = postJson_(endpoint, token, { source_id: sourceId, original_url: canvaUrl });
    return result.json || { ok: false, error: "canva_capture_failed_" + result.status };
  } catch (err) {
    console.error("Authoritative Canva capture failed", canvaUrl, err);
    return null;
  }
}

function reportCanvaFailure_(intakeUrl, token, payload, canvaUrl, reason) {
  try {
    postJson_(intakeUrl, token, Object.assign({}, payload, {
      canva_failures: [{ url: canvaUrl, failed_at: new Date().toISOString(), reason: reason }]
    }));
  } catch (err) {
    console.error("Could not report Canva capture failure", canvaUrl, err);
  }
}

/** Run once after setting the required Script Properties. */
function installFamilyRoyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "ingestSchoolMail")
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("ingestSchoolMail").timeBased().everyMinutes(15).create();
}
