# Lab registration · Cloudflare Workers

A public student form, a protected lecturer dashboard, and a shared D1 database. Physical slots start at 14, 28, 37, and 25 occupied out of 40. The online slot has unlimited capacity. New registrations are stored in D1; matrix numbers are unique. The lecturer can search, edit, move, and delete records.

## What you need

- A Cloudflare account and Node.js 20 or newer.
- A GitHub repository if you want automatic deployments.
- For a public student form with a private `/admin` dashboard, a domain managed in Cloudflare. A temporary `workers.dev` URL works for testing, but configure path-based Access for the final public site.

## 1. Create and connect the database

```bash
npm install
npx wrangler login
npx wrangler d1 create lab-registration-db
```

Copy the `database_id` from Wrangler's output into `wrangler.jsonc`, replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`. Keep the binding name `DB`. Then apply the table schema:

```bash
npm run db:remote
```

For local student-form testing, run `npm run db:local` and `npm run dev`. Local `/admin` deliberately returns 403 without a real Cloudflare Access identity.

## 2. Configure lecturer identity

Set `ADMIN_EMAILS` as a Worker environment variable in **Workers & Pages → your Worker → Settings → Variables and Secrets**. Use comma-separated email addresses, for example `lecturer@example.edu.my,assistant@example.edu.my`. These accounts must also be allowed by your Cloudflare Access policy. Do not save personal email addresses or passwords in GitHub. The Worker refuses admin requests until this variable and an authenticated Cloudflare Access identity are present.

## 3. Deploy the Worker

```bash
npm run deploy
```

Wrangler shows the deployment URL. When using GitHub deployments, push this project (including `wrangler.jsonc`) to GitHub. In Cloudflare, use **Workers & Pages → Create application → Import a repository** and choose the repo. Configure a build command if requested; this Worker requires no compilation command, and the deployment command is `npx wrangler deploy`. Database migrations are a separate step; run `npm run db:remote` before student registrations begin and whenever a new migration is added.

## 4. Protect the dashboard

Assign a custom domain, such as `lab.example.edu.my`, to the Worker. In **Cloudflare Zero Trust → Access → Applications**, add a **Self-hosted** application for the exact path `lab.example.edu.my/admin` and the wildcard path `lab.example.edu.my/admin/*`, with an Allow policy for the lecturer's email. Depending on the UI, these may be two application-domain entries within one application; the wildcard alone does not cover the parent path. Keep the rest of the domain public so students can use `/` and `/api/register`.

The Worker also checks Cloudflare's verified `ctx.access` identity and the `ADMIN_EMAILS` allowlist on **every** `/admin` request. The public form never exposes registration data. Do not use account-wide or Worker-wide Access on the public student form, and do not publish student records or D1 exports in GitHub.

## 5. Verify

- Open `/` in a private browser session. Choose a slot and register a test student. Refresh: occupied count increases by one.
- Open `/admin` without signing in: Access asks for authentication or the Worker returns 403.
- Sign in with the allowlisted lecturer email. Search and edit the test registration, then delete it. The slot count falls again.
- Try an unlisted email: it must not see records or edit the API.

## Existing registrations

The numbers 14, 28, 37 and 25 are **baseline totals**, not individual records. This project does not import registrations stored in the prior ChatGPT-hosted Site. If you export and import those records, adjust the corresponding baselines in both `src/index.ts` and `public/student.js` to avoid double counting.
