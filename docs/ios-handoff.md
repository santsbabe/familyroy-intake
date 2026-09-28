# Send to FamilyRoy — iPhone handoff contract

## Shortcut behaviour
The iOS Share Sheet shortcut sends only content the user deliberately shares.

POST /intake
Authorization: Bearer <local secret>
Content-Type: application/json

Payload:
- source_type: whatsapp_share | whatsapp_export | manual
- source_chat: optional chat/group label
- sender: optional
- source_timestamp: optional source timestamp
- text: shared text or URL
- attachments: array of metadata/evidence references when available
- client_context: { platform: "ios", shortcut: "Send to FamilyRoy", version: "0.1" }

Success:
- 201 new evidence
- 200 duplicate evidence
- routes[] explains destinations
- status is routed or needs_review

Errors:
- 400 invalid JSON
- 401 missing/wrong credential
- 405 non-POST
- 422 empty evidence

The credential must remain local to the installed Shortcut. Never commit it to GitHub or include it in a distributable shortcut/template.
