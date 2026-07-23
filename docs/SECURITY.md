# Creator — Security Guidelines

## Goal

Creator processes private video files, user data, AI provider credentials, and background jobs.

Security must be considered part of the architecture from the beginning and must not be added as an afterthought.

---

## Secrets

Never expose private credentials to the browser.

Examples:

* Supabase service role keys
* Cloudflare R2 secret keys
* Gemini API keys
* ElevenLabs API keys
* worker credentials
* signing secrets
* database credentials

Secrets must:

* use environment variables or an approved secret-management system
* never be committed to Git
* never appear in client-side bundles
* never be logged in plaintext

A `.env.example` file may contain variable names, but never real credentials.

---

## Authentication

Authentication will use Supabase Auth unless architecture documentation explicitly changes.

Protected application data must require authenticated access.

Do not trust user identifiers provided directly by the browser.

Authorization decisions must be enforced server-side.

---

## Authorization

Users must only be able to access resources they are authorized to access.

This includes:

* projects
* uploaded gameplay
* generated assets
* analysis results
* scripts
* voiceovers
* edit plans
* rendered videos

Database-level protections such as Row Level Security should be used where appropriate.

Never rely only on hidden UI elements for access control.

---

## Video Storage

Video and generated media assets should be private by default.

Do not expose permanent public URLs for private source videos.

Where temporary browser access is required, use controlled signed URLs or equivalent secure access mechanisms.

Signed URLs should:

* expire
* provide only required permissions
* be created server-side

---

## Upload Security

Uploads must eventually validate:

* authenticated ownership
* allowed file types
* media validity
* reasonable file size
* expected upload state

Do not trust filename extensions alone.

User-controlled filenames must not be used unsafely in filesystem paths or commands.

The system must protect against path traversal and unsafe file handling.

---

## FFmpeg and Worker Security

All video-processing inputs must be treated as untrusted.

Never build shell commands by directly concatenating unsanitized user input.

Prefer safe process execution with explicit argument arrays.

Workers should:

* run with minimal required permissions
* isolate temporary files
* clean temporary data safely
* avoid exposing infrastructure credentials
* validate job ownership and job payloads

---

## API Security

Server-side API endpoints must:

* validate authentication where required
* validate authorization
* validate request bodies
* reject malformed input
* avoid leaking internal error details
* use appropriate rate limiting where abuse is possible

Do not expose internal worker endpoints publicly without authentication.

---

## AI Provider Security

AI provider credentials must remain server-side.

Do not send unnecessary personal or private data to AI providers.

Only send the media or metadata required for the requested processing stage.

Provider responses must be treated as untrusted input and validated before use.

AI-generated structured output must be schema-validated.

---

## Database Security

Use migrations for schema changes.

Production data must not be casually modified through ad-hoc scripts.

Sensitive operations should be auditable where practical.

Database constraints should enforce important invariants instead of relying only on application logic.

---

## Logging

Logs must help diagnose failures without leaking sensitive data.

Never log:

* passwords
* access tokens
* API keys
* secret credentials
* complete signed URLs where avoidable

Be careful when logging AI requests, headers, user uploads, and external API errors.

---

## Error Handling

Errors must fail safely.

Do not:

* silently swallow security errors
* expose stack traces to end users
* reveal internal infrastructure details unnecessarily
* automatically retry operations that may cause duplicated destructive actions

Security-related failures should be explicit and observable.

---

## Dependency Security

Keep dependencies minimal.

Before adding a new package, consider whether it is necessary.

Avoid abandoned or suspicious packages.

Dependency updates should not bypass testing and validation.

---

## Git and Repository Security

Never commit:

* `.env`
* credentials
* private keys
* tokens
* production database dumps
* private user media
* generated secret configuration

The repository must include appropriate `.gitignore` rules before local development begins.

---

## Core Security Rules

1. Never expose secrets to the client.
2. Never trust browser-provided identity or ownership claims.
3. Never make private video assets permanently public by default.
4. Never execute unsanitized user input inside shell commands.
5. Validate all external input, including AI-generated output.
6. Enforce authorization on the server and database where appropriate.
7. Use least-privilege access for infrastructure and workers.
8. Security-sensitive failures must never be silently ignored.
9. Do not weaken security for convenience without explicit architectural approval.
10. Security requirements apply to every implementation phase.
