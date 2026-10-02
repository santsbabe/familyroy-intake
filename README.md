# FamilyRoy Intake
Universal deliberate-share intake layer for the FamilyRoy ecosystem.

## v0.1
- `POST /intake`: normalises evidence, fingerprints it, deduplicates it, classifies it, persists it.
- `GET /health`: deployment health check.
- Multi-route classification: Homework Quest, School Readiness, Contacts/Services, Repairs, Shopping, Food, Events, Personal Admin, Pets, Electricity, Review Queue.
- Netlify Blobs persistence: global strong-consistency store in production; deploy-specific store outside production.

## Privacy boundary
This service only processes content deliberately shared/exported into FamilyRoy. It does not scrape or silently read WhatsApp.


## Gmail + Canva school sources (development branch)

The Gmail forwarder in `integrations/google-apps-script/gmail-school-ingest.gs` is installed once under the Google account. A 15-minute time-driven trigger finds unprocessed school mail containing Canva links and posts the original Gmail evidence and Canva URLs to `/intake`.

The intake layer:
- preserves Canva shortlinks and full resolved share URLs;
- stores Gmail message/thread provenance;
- accepts a later `canva` capture containing original URL, full resolved URL, design metadata, capture timestamp, evidence reference and extracted text;
- classifies the combined email + Canva text, so newsletter-only instructions can route to School Readiness;
- fingerprints source data for idempotent ingestion.

Canva content capture is intentionally a separate source-adapter step. Do not strip a resolved share URL to its bare design ID. Do not store Canva OAuth secrets in Apps Script.

### Deployment model

New emails/newsletters are runtime data and require no deployment. Deploy only when application code changes. Develop/test on a non-production branch or Deploy Preview; production remains an explicit release action.


### Canva content authority

QA against a real PNPS public-share newsletter confirmed that the public Canva viewer page can be reached but must not be treated as authoritative newsletter text. FamilyRoy therefore keeps public HTML as a reachability/diagnostic probe only. Automatic content enrichment must use Canva's authenticated MCP `get-design-content` capability (richtexts), preserving the full resolved share URL/collaboration token.

Until MCP OAuth is configured, Canva-linked Gmail records remain `awaiting_enrichment`; persistent capture failures are moved to `needs_review` rather than silently treated as complete. Historical captures more than 24 hours after the source email are quarantined because reused/living Canva designs may have changed.

### Reliability rules

- Gmail message identity is the stable source key; a later Canva capture enriches the same record instead of creating a duplicate.
- Re-sending the same Gmail evidence is idempotent.
- Multi-link emails remain incomplete until every Canva link is captured or explicitly failed.
- A failed public capture is retried during the 24-hour freshness window, then escalated to review.
- Public/redirect URLs are restricted to HTTPS Canva hosts.
- Deploy Preview builds run the test suite before functions are published.
- Production remains an explicit release action.
