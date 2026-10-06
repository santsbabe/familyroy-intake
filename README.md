# FamilyRoy Intake
Universal deliberate-share intake layer for the FamilyRoy ecosystem.

## v0.1
- `POST /intake`: normalises evidence, fingerprints it, deduplicates it, classifies it, persists it.
- `GET /health`: deployment health check.
- Multi-route classification: Homework Quest, School Readiness, Contacts/Services, Repairs, Shopping, Food, Events, Personal Admin, Pets, Electricity, Review Queue.
- Netlify Blobs persistence: global strong-consistency store in production; deploy-specific store outside production.

## Privacy boundary
This service only processes content deliberately shared/exported into FamilyRoy. It does not scrape or silently read WhatsApp.


## School Router contract
A single deliberately shared school item may route to more than one destination. The intake record remains the canonical evidence object; each destination receives a deterministic `route_payloads[route]` projection keyed to the same `source_id`.

- `homework_quest`: learning-task import candidate; source wording/evidence must be preserved for Fidelity Lock processing downstream.
- `control_centre.school_readiness`: concrete physical/preparation obligation only; informational, optional and fee/admin notices are excluded.
- `control_centre.calendar_events`: event candidate only when the school item is actionable or explicitly event-like and contains a concrete date/day signal.
- `review_queue`: ambiguous evidence is preserved for human review rather than guessed.

Routing is classification, not silent execution. Destination adapters must remain idempotent using `source_id` / the supplied dedupe key.


## Destination delivery (preview)
New intake records now persist one pending outbox item per route. Destination apps can consume routed evidence without reclassifying the original share.

`GET /route-outbox?route=<route>` returns pending items for an authorised destination.
`POST /route-outbox?route=<route>` with `{"source_id":"<sha256>","consumer":"<name>"}` acknowledges successful consumption.

Consumption is idempotent: repeating an acknowledgement returns the already-consumed item instead of creating a second destination action. The same bearer credential protects the preview endpoint. Production credentials and deployment remain a separate release decision.

## Destination security boundary
The Intake bearer token is a server credential. It must not be embedded in Homework Quest browser code, the GitHub Pages Control Centre, localStorage, query strings, or committed configuration. Browser-only destinations receive routed payloads through a separate secure handoff/bridge; they do not call the master outbox directly.

Duplicate intake is also a recovery operation: if a canonical source already exists but one of its deterministic outbox entries is missing, Intake recreates only the missing entry and leaves existing/consumed entries unchanged.

## Scoped browser handoff
Browser destinations never receive the master Intake bearer token. For pending Homework Quest and School Readiness routes, Intake can issue a random 256-bit capability with a 15-minute expiry. Only a SHA-256 hash of the capability is stored. The capability is route- and source-scoped.

The browser presents the capability as `Authorization: Handoff <capability>` to `/handoff`; it is never placed in the request URL. GET redeems the routed payload. After the destination has durably ingested/deduplicated it, POST with `{"acknowledge":true,"source_id":"…"}` consumes the corresponding outbox item. The source ID must match the capability and acknowledgement is rejected until that capability has successfully redeemed the payload. Acknowledgement is idempotent. Expired capabilities cannot be redeemed, and a new capability can be minted while the outbox item remains pending.

Cross-origin redemption is deny-by-default. The server only returns CORS permission when the request origin exactly matches the route-specific configured origin (`FAMILYROY_CONTROL_CENTRE_ORIGIN` or `FAMILYROY_HOMEWORK_ORIGIN`). The Control Centre may receive a capability in a URL fragment for a one-tap handoff; it removes the fragment from browser history before calling Intake.

## Shortcut orchestration
The Intake response is deliberately small-brain-friendly for the phone: `shortcut_message` names every routed destination, `next_actions` contains only browser destinations with a live capability, and `primary_action` selects at most one page to open immediately. Mixed school shares prefer School Readiness as the immediate page while Homework Quest remains independently recoverable; queued destinations such as Calendar never cause extra tabs.

`recovery` and `handoff_status` make failure states explicit. A source is considered safe once its canonical Intake record/outbox exists; failure to open or acknowledge a browser destination does not require reconstructing the source. Re-sharing identical evidence repairs/mints pending delivery state without duplicating the canonical source.

## Acceptance status
The preview branch is guarded by unit/regression tests, a Netlify-function compilation check, and an exact-commit live deploy-preview smoke workflow. The live smoke path exercises authenticated Intake, dedupe, scoped handoff lifecycle, origin/CORS enforcement, partial-route recovery, and a synthetic PNPS share through the real public Control Centre QA page in headless Chrome through acknowledgement.

Synthetic browser-acceptance functions are preview-only and return 404 in production for all tested methods. They only create tagged synthetic PNPS evidence; the status probe refuses non-synthetic source IDs.

The current iPhone contract is intentionally minimal: use the existing working Intake request, read the top-level `launch_url`, and open it only when present. The nested `primary_action.launch_url` remains available for structured clients, but iOS Shortcuts should use the top-level value. The server constructs the destination URL and keeps the scoped capability in the URL fragment. The Shortcut does not implement routing or capability construction.

Queued means queued, not delivered: Calendar and other destinations remain explicit outbox work until a consumer exists.


### Real-device acceptance
On 6 October 2026 the existing **Send to FamilyRoy** iPhone Share Sheet shortcut passed the mixed PNPS acceptance case (`Alexander homework is revise klanke. Bring library bag on Friday.`): Intake returned Homework Quest + School Readiness ready / Calendar queued, the top-level `launch_url` was present, iOS handed the URL to the user's default browser (Chrome) after the user granted the Shortcut permission, and the public Control Centre QA page redeemed, ingested and rendered the School Readiness item. Browser choice is therefore not part of the server contract; the Shortcut uses iOS `Open URLs` and the user's browser association/permission.
