# Send to FamilyRoy — iPhone Shortcut build sheet

Target during acceptance:
https://deploy-preview-1--familyroy-intake.netlify.app/intake

## Share Sheet
Name: Send to FamilyRoy
Show in Share Sheet: on
Accepted input for v0.1 acceptance: Text and URLs
If no input: stop with "Nothing useful was shared."

## Request
POST target above.
Headers:
- Content-Type: application/json
- Authorization: Bearer [local preview token]

JSON:
{
  "source_type": "whatsapp_share",
  "text": "[Shortcut Input]",
  "client_context": {
    "platform": "ios",
    "shortcut": "Send to FamilyRoy",
    "version": "0.1-preview"
  }
}

The token is local-only. Never put it in GitHub, screenshots, logs, or a distributable Shortcut.

## Response
Read JSON field shortcut_message and show it as a notification/result.
Useful fields retained for diagnostics: duplicate, source_id, status, routes, confidence, extracted.

## Deterministic acceptance item
Share exactly this synthetic text twice:
PNPS: Alexander homework is revise klanke. Bring library bag on Friday.

Expected first request:
- HTTP 201
- duplicate false
- routes include homework_quest, control_centre.school_readiness, control_centre.calendar_events
- extracted child includes Alexander

Expected second identical request:
- HTTP 200
- duplicate true
- same source_id

## After acceptance
Extend accepted Share Sheet types to files/images/ZIP exports and add attachment handling. Do not use real family data until the endpoint is production-secured with a fresh production token.


## v0.2 Share Sheet extension — device build
Do not change the working text path. Extend it.

Accepted Share Sheet types:
- Text
- URLs
- Images
- Files

Branch on input type:
1. Text/URL: keep existing JSON request unchanged.
2. File/Image:
   - Get Name of Shortcut Input
   - Get Type of Shortcut Input / MIME type when available
   - Base64 Encode Shortcut Input with line breaks OFF
   - POST the same /intake endpoint with:
     source_type = whatsapp_share
     text = empty string
     attachments = List containing one Dictionary:
       name = file name
       mime_type = detected content type (fallback application/octet-stream)
       data_base64 = Base64 Encoded
   - read shortcut_message from response
   - show the same confirmation.

WhatsApp Export Chat:
- In WhatsApp: Export Chat → Without Media for first acceptance.
- Share the generated ZIP directly to Send to FamilyRoy.
- The server recognises .zip/application/zip, extracts _chat.txt for routing, and retains the original ZIP as evidence.
- First acceptance ZIP must be synthetic/non-family evidence only.

Current preview limit: 3 MiB decoded per attachment. Keep "Without Media" for WhatsApp ZIP acceptance so iOS does not create an unnecessarily large payload.

UX target after functional acceptance:
- replace blocking Show Result with a non-blocking notification if iOS exposes the action reliably on the user's version.
- preserve the current Show Result until the replacement has been proven; do not remove the working confirmation first.

## v0.3 historical orchestration design — superseded by v0.4
The Intake response now returns:
- `shortcut_message`: concise confirmation naming all routed destinations.
- `next_actions[]`: only browser destinations that currently have a redeemable scoped capability.
- `primary_action`: at most one recommended immediate destination, or null.
- queued destinations such as Calendar continue asynchronously and do not force another app/page open.

For a mixed school share, School Readiness is the primary browser destination; Homework Quest remains queued with its own capability. This avoids opening several tabs from one Share Sheet action.

This earlier design had the Shortcut construct the destination URL itself. **Do not implement that.** v0.4 below supersedes it: the server now returns the complete launch URL, keeping route and capability construction out of iOS Shortcuts.

This section is an implementation contract, not a request for Santie to edit the Shortcut now.

### Recovery behaviour
If the destination page does not open, the Intake record is already safe. Do not ask Santie to recreate or manually copy the school notice. Re-run Send to FamilyRoy on the same evidence: dedupe returns the same `source_id` and refreshes a capability only for destinations still pending.

If a share has more than one browser destination, open only `primary_action`. The secondary action remains available in `next_actions`; do not open multiple tabs automatically. If no browser action is available, show the confirmation and stop.

## v0.4 minimal device extension
The server now returns `primary_action.launch_url` when there is one immediate browser destination. The URL is already complete and carries the short-lived capability only in its fragment.

This reduces the eventual iPhone change to the smallest practical extension of the existing working Shortcut:
1. Read top-level `launch_url` from the existing Intake response.
2. If it has a value, Open URL.
3. If it is empty, finish normally.

The Shortcut does **not** need to know route names, destination base URLs, the Intake endpoint for handoff construction, or any handoff token logic. Do not rebuild the existing request/authentication path.

### iOS compatibility simplification
The response also exposes the selected `launch_url` at the top level. iOS Shortcuts should read this top-level key directly from `Contents of URL`; do not traverse `primary_action` for the launch URL. `primary_action.launch_url` remains for structured/API consumers and must equal the top-level value.
