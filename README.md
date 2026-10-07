# FamilyRoy Intake
Universal deliberate-share intake layer for the FamilyRoy ecosystem.

## v0.1
- `POST /intake`: normalises evidence, fingerprints it, deduplicates it, classifies it, persists it.
- `GET /health`: deployment health check.
- Multi-route classification: Homework Quest, School Readiness, Contacts/Services, Repairs, Shopping, Food, Events, Personal Admin, Pets, Electricity, Review Queue.
- Netlify Blobs persistence: global strong-consistency store in production; deploy-specific store outside production.

## Privacy boundary
This service only processes content deliberately shared/exported into FamilyRoy. It does not scrape or silently read WhatsApp. User-specific school names, sender addresses, folder IDs and acceptance content belong in runtime configuration/private evidence stores, not in this public repository.

## Gmail + Canva school sources (development branch)

The Gmail forwarder in `integrations/google-apps-script/gmail-school-ingest.gs` is installed once under the connected Google account. A time-driven trigger finds recent school mail matching a runtime-configured Gmail query and containing Canva links.

For each matching message it:
1. archives the original email as a deterministic PDF in the configured school-newsletter Drive folder;
2. preserves the Drive file ID/URL in `client_context.source_archive`;
3. extracts Canva links from the original Gmail HTML/text rather than re-parsing the PDF;
4. posts the Gmail evidence and Canva provenance to `/intake`;
5. applies a captured-source Gmail label only after intake succeeds, so repeated polling does not waste calls.

Required Apps Script properties:
- `FAMILYROY_INTAKE_URL`
- `SCHOOL_NEWSLETTER_FOLDER_ID`
- `SCHOOL_NEWSLETTER_GMAIL_QUERY`

Optional:
- `FAMILYROY_INTAKE_TOKEN`
- `SCHOOL_CAPTURED_LABEL`

The intake layer:
- preserves Canva shortlinks and full resolved share URLs;
- stores Gmail message/thread provenance;
- accepts later authoritative Canva captures containing original URL, full resolved URL, design metadata, capture timestamp, evidence reference and extracted text;
- combines email + Canva text for routing;
- fingerprints source data for idempotent ingestion.

### Parallel-work boundary

This branch owns source acquisition and provenance. It deliberately does **not** duplicate the School Readiness message-level parser being hardened in the separate Control Centre QA work.

The hand-off contract is documented in `docs/newsletter-enrichment-contract.md`. Real newsletter acceptance evidence stays outside the public repository.

### Deployment model

New emails/newsletters are runtime data and require no deployment. Deploy only when application code changes. Develop/test on this non-production branch; production remains an explicit release action.

### Canva content authority

Public Canva viewer HTML can be probed for reachability but must not be treated as authoritative newsletter text.

The proven authoritative extraction path is Canva MCP `resolve-shortlink` → `get-design-content`, preserving the full resolved share URL/collaboration token. Canva REST export is not treated as a substitute for third-party public-share enrichment unless access is proven for that design.

Until a supported unattended authoritative enrichment path is available, Canva-linked Gmail records remain `awaiting_enrichment`. Historical captures more than 24 hours after the source email are quarantined because reused/living Canva designs may have changed.

### Reliability rules

- Gmail message identity is the stable source key; a later Canva capture enriches the same record instead of creating a duplicate.
- Re-sending the same Gmail evidence is idempotent.
- The email PDF is archived before enrichment is attempted.
- Multi-link emails remain incomplete until every Canva link is captured or explicitly failed.
- Public Canva HTML is diagnostic only and never marks the newsletter complete.
- Captures outside the 24-hour freshness window are not auto-routed.
- Public/redirect URLs are restricted to HTTPS Canva hosts.
- Pushes to `canva-school-sources` run the GitHub test suite; no production deploy is triggered by this workflow.
- Production remains an explicit release action.
