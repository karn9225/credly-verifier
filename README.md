# AWS Certification Verifier (via Credly)

A lite web app that verifies whether a **Credly badge is a genuine AWS
certification** — issued by Amazon Web Services — and shows its details
(cert name, recipient, issue/expiry dates, skills).

## How it works

AWS issues its certifications as Credly digital badges. Credly has **no
official public "verify any badge" API** (the official API is scoped to badge
*issuers* with org credentials). These endpoints also send **no CORS headers**,
so the app calls them **server-side** from a Next.js route handler
(`src/app/api/verify/route.ts`) and then checks that the badge's issuer is
`Amazon Web Services …`.

**Primary source — Credly's public Open Badges (OBI) endpoints** (no auth key):

```
GET https://api.credly.com/v1/obi/v2/badge_assertions/<id>
    -> { issuedOn, expires, badge: <badge-class-url>, ... }
GET <badge-class-url>
    -> { name, description, image, tags (skills), issuer: { name } }
```

This yields the certification name, issuer, description, image, **skills**, and
**exact issue/expiry dates**. The recipient's email is hashed in the assertion,
so the recipient's display name is enriched from the badge page's Open Graph
title.

> ⚠️ When requesting these endpoints you must send `Accept: application/json`
> (not `text/html`). Credly does content negotiation and will return an HTML
> page if `text/html` is acceptable, which breaks JSON parsing.

**Fallback source — Open Graph metadata.** If the OBI endpoint is unavailable,
the app parses the public badge page's `og:title` / `og:image` /
`og:description`. This still verifies issuer, cert name, recipient, description,
image, and active/expired status (via Credly's `(Expired)` title marker), but
without issue/expiry dates or skills.

> ⚠️ These endpoints are undocumented and may change or rate-limit at any time.
> This tool is not affiliated with AWS or Credly.

## Verification outcomes

| Status          | Meaning                                              |
| --------------- | ---------------------------------------------------- |
| `valid_aws`     | Issued by AWS and currently valid                    |
| `expired_aws`   | Genuinely AWS-issued, but past its expiration date   |
| `valid_non_aws` | A real Credly badge, but not issued by AWS           |
| `private`       | Badge exists but its owner hasn't made it public     |
| `not_found`     | Couldn't retrieve the badge from Credly              |

## Run it

**Prerequisites:** Node.js 20+ and npm.

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Open http://localhost:3000 and paste a Credly badge URL or ID, e.g.
   `https://www.credly.com/badges/<id>` or just the `<id>` (a UUID).

### Production build

```bash
npm run build
npm start          # serves on http://localhost:3000
```

### Available scripts

| Command         | Description                          |
| --------------- | ------------------------------------ |
| `npm run dev`   | Start the dev server (hot reload)    |
| `npm run build` | Create an optimized production build |
| `npm start`     | Run the production build             |
| `npm run lint`  | Lint the project                     |

## API

```bash
# POST
curl -s localhost:3000/api/verify -H 'content-type: application/json' \
  -d '{"input":"https://www.credly.com/badges/<id>"}'

# GET
curl -s 'localhost:3000/api/verify?q=<id>'
```

## Tech

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4.

## License

Released into the public domain under [The Unlicense](./LICENSE) — no copyright,
no attribution required. This applies to the code in this repository only.
Badge data, trademarks, and the AWS/Credly names belong to their respective
owners; users of this tool should respect
[Credly's Terms of Service](https://info.credly.com/terms-of-service-acclaim).
