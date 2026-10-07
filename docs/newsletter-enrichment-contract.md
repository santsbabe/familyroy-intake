# Canva newsletter enrichment contract

This branch owns **source acquisition and provenance only**. The separate Control Centre / School Readiness QA parser remains the authority for interpreting newsletter text into child-specific obligations.

## Parallel-work boundary

`familyroy-intake:canva-school-sources` may:
- detect Canva-linked school Gmail messages using a runtime-configured Gmail query;
- archive the original email as a PDF in Google Drive;
- preserve Gmail message/thread IDs, subject, sender and timestamp;
- preserve the original Canva shortlink and the full resolved Canva share URL;
- attach an authoritative Canva text capture when available;
- deliver the enriched source record to the `control_centre.school_readiness` route;
- quarantine stale, partial or failed captures.

It must **not** duplicate or replace the School Readiness message-level parser while that parser is being hardened in the Control Centre QA work.

## Source chain

1. Gmail message is the stable source identity.
2. Original email is archived to Drive before enrichment.
3. Canva URLs are extracted from the original Gmail HTML/text.
4. Public Canva HTML may be probed for reachability but is never authoritative newsletter text.
5. Authoritative enrichment preserves `original_url`, `resolved_url`, `design_id`, `title`, `captured_at`, `content_text`, `evidence_ref`, and `capture_method`.
6. The enriched record keeps the same `source_id` as the Gmail source and is merged rather than duplicated.
7. Captures older than 24 hours relative to the source email are not auto-routed because a living Canva design may have changed.

## Drive archive contract

The Google Apps Script requires:
- `FAMILYROY_INTAKE_URL`
- `SCHOOL_NEWSLETTER_FOLDER_ID`
- `SCHOOL_NEWSLETTER_GMAIL_QUERY`

Optional:
- `FAMILYROY_INTAKE_TOKEN`
- `SCHOOL_CAPTURED_LABEL`

The email-PDF archive is deterministic per Gmail message and its Drive ID/URL is stored inside `client_context.source_archive`.

## Acceptance testing

Real school-newsletter acceptance content is intentionally kept out of this public repository. The separate QA parser can consume a private fixture/evidence copy and compare its extraction to an expected obligation set.

A source passes acceptance only when the parser:
- extracts genuine obligations;
- preserves waiting/optional states rather than inventing commitments;
- rejects stale/template blocks;
- does not convert purely informational headings into tasks;
- identifies Before We Leave requirements;
- keeps dates, money, forms, gear and parent actions distinct.
