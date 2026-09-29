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
