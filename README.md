# Vale

Your bank statement names the charge. It never names the door.

Vale is a subscription steward: it matches ugly bank descriptors to the real cancel page, names the dark patterns in advance, and records the money you keep.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What works

- **Accounts** — email + password or Google, stored in this browser
- **Inbox scan** — after login, Vale asks permission to read Gmail for that address, then lists receipts you can add or cancel
- **Statement paste** — match `NETFLIX.COM`, `APPLE.COM/BILL`, `PLANET FITNESS` to the actual management portal
- **Cancel walks** — difficulty that is honest (gyms are hostile), trap warnings, official cancel URLs, a checklist, then “I cancelled”
- **Quiet detection** — unused for 60+ days rises to the top
- **Kept** — first-year savings, plus a working Free / Plus ($6) / Share (15% of savings) model
- **Local only** — ledger and accounts live in this browser. Inbox access is Google read-only, and only if you allow it.

## Stack

Next.js, TypeScript, Tailwind CSS. No backend.
