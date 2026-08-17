# Vale

Your bank statement names the charge. It never names the door.

Vale is a subscription steward: paste a statement (or add a charge by hand), match ugly bank descriptors to the real cancel page, name the dark patterns in advance, and record the money you keep. Gmail scan is optional proof of mailed recurring bills — not a complete list of every subscription on the account.

There is no Vale server and no database. Accounts and the ledger live in this browser. Nothing costs money to run.

## Run it

```bash
npm install
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** — not `127.0.0.1`. Google treats those as different sites.

## Google (optional, free)

Google sign-in and inbox scan need a free OAuth **client ID**. Google does not charge for this. Create a Cloud project, enable the **Gmail API**, set the OAuth consent screen to **External**, add yourself as a **test user**, then create a **Web application** client.

Authorized JavaScript origins (no path, no trailing slash):

- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `https://your-app.vercel.app` (and the `*.vercel.app` URL you actually open)

## Vercel

In the Vercel project: **Settings → Environment Variables**

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = the same client ID as `.env.local`
- `NEXT_PUBLIC_SITE_URL` = `https://your-app.vercel.app`

Apply to Production, Preview, and Development. **Redeploy** after saving. `NEXT_PUBLIC_` values are baked in at build time — changing them without a new deploy does nothing.

Then in Google Cloud → Clients → Vale, add that `https://….vercel.app` origin. Google’s “Something went wrong” popup is almost always a missing origin.

Do not put the client secret in Vercel or Vale.

Scopes: `email`, `profile`, `openid`, and `https://www.googleapis.com/auth/gmail.readonly`.

Put the client ID in `.env.local` (see `.env.example`) and restart `npm run dev`:

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=….apps.googleusercontent.com
```

Do not put the client secret in Vale. Vale only uses the client ID in the browser.

While the app is in testing, Google may say it is unverified. Add your Gmail under **Audience → Test users**, then **Advanced → Go to Vale**.

Allow popups for localhost. Sign-in opens a second window.

## What works

- **Accounts** — email + password or Google, stored in this browser. Forgot-password is a device code, not email. No Vale server, no paid API.
- **Statement paste** — the free complete path. Match `NETFLIX.COM`, `APPLE.COM/BILL`, `PLANET FITNESS` to the cancel portal. One-time shop lines stay off the ledger unless you check them.
- **Inbox scan** — optional. After you allow Gmail readonly, Vale lists proven recurring bills (Stripe / PayPal / Google payments, repeats, or recurring language). It does not invent a catalog price. Outlook, Yahoo, and iCloud cannot be scanned this way.
- **Add by hand** — search the catalog or type a custom name.
- **Cancel walks** — honest difficulty, trap warnings, official cancel URLs, a checklist, then “I cancelled”
- **Quiet detection** — unused for 60+ days rises to the top
- **Kept** — first-year savings. Plus / Share are labels on this device and never charge you.

## Limits

- Data stays on this machine and this browser. Clearing site data wipes the ledger.
- Gmail cannot list “every subscription on this account.” Deleted mail is gone. Charges that never emailed this address will not appear.
- A live bank connection (Plaid and the like) would be more complete and costs money. Vale does not use it.
- Inbox scan needs a Google mailbox (Gmail or Google Workspace) and your explicit allow.
- No backend, so no sync across devices until you add a database.

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS v4. No backend.
