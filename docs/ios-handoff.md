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


## Attachment contract (preview v0.2)
Files/images/WhatsApp Export Chat ZIPs are sent as attachment objects:
- name
- mime_type
- data_base64

The intake service decodes and hashes each attachment, stores the original bytes in the preview-scoped evidence store, and keeps only metadata + SHA-256 in the source record. ZIP exports are inspected server-side; `_chat.txt` is extracted into routing text while the original ZIP remains evidence.

Safety limits:
- maximum decoded size per attachment: 3 MiB
- malformed ZIP: rejected with 422
- oversized attachment: rejected with 413
- raw base64 is never written into the source JSON record

For iOS, encode the deliberately shared file with Base64 before building the JSON attachment object. Text-only shares continue using the existing contract unchanged.

## Destination capabilities (preview v0.3)
A successful Intake response may also contain `handoffs` for browser destinations such as Homework Quest and School Readiness. Each handoff contains a short-lived opaque capability and expiry. This is not the Intake bearer token and cannot access the general outbox.

The Shortcut may use a returned capability to open the intended destination in one tap. Put the capability in the URL **fragment** (after `#`), never in query parameters. Fragments are not sent in the HTTP request to the static host. The destination removes the fragment from browser history before redemption and sends the capability to Intake in the `Authorization: Handoff …` header.

Do not log, screenshot, persist or reuse a capability. If it expires before redemption, re-sharing the same source is safe: Intake dedupes the canonical source and can issue a fresh capability for any still-pending route.
