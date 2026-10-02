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
