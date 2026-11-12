# Email setup (class reports, monthly reports, student alerts)

The academy app sends email through your cPanel mailbox (for example `info@yourdomain.com`) over SMTP.
A browser cannot send SMTP mail, so sending runs in two small **Vercel functions** that deploy with the site:

| Endpoint | What it does |
|---|---|
| `POST /api/email` | Used by the app. Checks the signed-in user is an admin or educator, works out the recipients from Firestore, and puts the emails in the queue. |
| `GET /api/email-cron` | Runs on a schedule. Starts the monthly report when it is due, then sends queued emails with retries and the hourly limit. |

The queue and the log are the same Firestore collection, `email_outbox`. It holds one document per message,
with the recipients, type, batch, class, status, error and timestamps. Emails start sending immediately in the
background, so the UI never waits.

The server code is in [`server/`](server/), the templates are in [`server/templates/`](server/templates/), and the shared
report logic is in [`src/utils/studentReport.js`](src/utils/studentReport.js). Vercel bundles that file into the functions
because they import it, so there is no copy step.

---

## 1. Values you need to fill in

Add these in **Vercel → your project → Settings → Environment Variables**.
Use the **Production** environment for the live site. You can use **Preview** for testing on branch deployments.
Then **redeploy**, because environment changes only apply to new deployments.

| Variable | What to put | Where to find it |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | The whole service-account JSON (paste it as the value) | Firebase Console → ⚙ Project settings → **Service accounts** → *Generate new private key* |
| `SMTP_HOST` | e.g. `mail.yourdomain.com` | cPanel → **Email Accounts** → your mailbox → **Connect Devices** ("Outgoing Server") |
| `SMTP_PORT` | `465` (or `587`) | same page |
| `SMTP_ENCRYPTION` | `ssl` for 465, `starttls` for 587 | same page |
| `SMTP_USER` | the full address, e.g. `info@yourdomain.com` | same page |
| `SMTP_PASS` | that mailbox's password | the password you set in cPanel |
| `MAIL_FROM_NAME` | `DIGISPIRE` | — |
| `MAIL_FROM_ADDRESS` | `info@yourdomain.com` (normally the same as `SMTP_USER`) | — |
| `MAIL_TEST_MODE` | `true` until you have checked everything, then `false` | — |
| `MAIL_TEST_RECIPIENT` | **your own** email address | — |
| `MAIL_MAX_PER_HOUR` | your host's hourly limit, minus a safety margin (e.g. host limit 200 → `180`) | Ask your host, or check cPanel → Email → *Track Delivery* / your plan's limits |
| `MAIL_BCC_CHUNK_SIZE` | `50` (lower it if your host limits recipients per message) | Ask your host |
| `CRON_SECRET` | any long random string (e.g. from a password generator) | — |

Optional settings with their defaults: `MAIL_REPLY_TO` (empty), `MAIL_SEND_DELAY_MS=1000`, `MAIL_MAX_ATTEMPTS=5`,
`MAIL_TEST_SAMPLE_SIZE=3`, `MONTHLY_REPORT_ENABLED=true`, `MONTHLY_REPORT_TIME=20:00`, `APP_TIMEZONE=Asia/Kolkata`,
`ACADEMY_NAME=DIGISPIRE`, `MAIL_CC_ADDRESS=digispireacademy@gmail.com`, `APP_BASE_URL=https://digispire.vercel.app`, `ACADEMY_LOGO_URL=<APP_BASE_URL>/logo.png`.
[`.env.example`](.env.example) lists everything.

> Never give these variables a `VITE_` prefix, because Vite would put them in the browser bundle.
> Most cPanel hosts count **every** recipient toward the hourly limit, including each BCC address.
> The app counts the same way.

## 2. One-time setup

1. **Firestore rules.** [`firestore.rules`](firestore.rules) now has a block for the new `email_*` collections:
   staff can read them, and only the server can write them.
   Deploy it with `npx firebase login` and then `npx firebase deploy --only firestore:rules --project digispire-academy`.
   If you ever edited rules directly in the Firebase Console, compare first, because deploying replaces the live rules.
   Alternatively, paste the `email_outbox` / `email_bodies` / `email_runs` / `email_meta` block into the Console.
2. **Deliverability.** In cPanel → **Email Deliverability**, make sure SPF and DKIM show *Valid* for your domain.
   Without them, reports are likely to land in spam.
3. **Student emails.** Students → edit → **Email** is a new field. Students without a valid address are skipped
   and listed on screen. The phone-login address (`<phone>@digispire.in`) is never used.
4. **Schedule.** `vercel.json` adds a Vercel Cron job that runs daily at 15:00 UTC (20:30 IST).
   - On the Vercel **Hobby** plan, cron runs once a day and fires sometime within that hour (20:30–21:29 IST).
     That is fine for the monthly report.
   - For faster retries, and to spread big sends across hours when you hit the hourly limit, add a **cPanel cron job**
     that runs every 5 minutes (cPanel → **Cron Jobs**, schedule `*/5 * * * *`):
     ```
     curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://digispire.vercel.app/api/email-cron > /dev/null
     ```
   - On Vercel **Pro** you can instead change the schedule in `vercel.json` to `*/5 * * * *`.
   - The monthly report goes out on the last day of the month at `MONTHLY_REPORT_TIME` or later.
     If that run is missed, it catches up the next day.

> Which `vercel.json` applies depends on your Vercel project's **Root Directory** setting
> (Settings → Build & Deployment). Both files (repo root and `digispire-app/`) are set up the same way,
> and each has its own `api/` folder, so it works either way. Once you know which one Vercel uses,
> you can delete the other `api/` folder and `vercel.json`.

## 3. Test everything with only your own address

Keep `MAIL_TEST_MODE=true` (the default). In test mode **every** email goes to `MAIL_TEST_RECIPIENT`, with a yellow
banner listing who would have received it. Monthly runs send only `MAIL_TEST_SAMPLE_SIZE` sample reports.
Every screen also has a **Send test to me** button, which sends to the signed-in staff member's own email and never to students.

Before you start, make sure your own staff profile has your real email address. The email features are web-only and hidden in the Android app.

1. **SMTP check.** Admin → **Email Center** → *Send SMTP test to me*.
   You should receive "SMTP test" within a minute. If it fails, the exact SMTP error appears on screen and in the log.
2. **Set up two test students.** Give them email addresses you control (Gmail `+` aliases such as `you+s1@gmail.com` work well).
   Mark one present and one absent for a class today, using the QR code or *Log Manual Entry*.
3. **Feature 1: class report.**
   1. Go to Take Attendance → **Class Reports** tab and open today's session for that batch.
   2. Check that the topics, faculty, time and the present-out-of-total count are filled in automatically.
   3. Type the tasks, add or remove a topic, and click *Update preview*.
   4. Click *Send test to me* first, then *Send*.
   5. Check:
      - One email arrives at your test address, banner "would have gone to … BCC: you+s1@…".
      - The absent student is not listed.
      - The row now says "Sent on … by …".
      - *Send* has become *Resend…*, which asks for confirmation.
      - Topics you added show as completed for the present student in Completion Reports.
4. **Feature 3: individual emails.**
   1. Go to Attendance Reports. Adjust the "Highlight" thresholds and check that the chips appear.
   2. Select students (or use *Select flagged*) and click *Email individually*.
   3. Pick a type, add a note, click names to preview each student's own email, then *Send test to me* and *Send*.
   4. Open a student's **Audit**. The Email history list shows what was sent, by whom and when.
5. **Feature 2: monthly report.**
   1. Go to Email Center → Monthly attendance report, pick this month, and click *Preview*.
   2. Check the numbers per student (Absent and Leave are separate) and the rendered email.
   3. Click *Send this one to me*, then *Run for <month>*.
   4. Click *Run* again. It should report "0 queued · N already sent", because re-runs never double-send.
6. **Inactive students.** Mark a test student *Inactive* (Students → edit → Status). They disappear from email lists
   and receive nothing.

**Going live:** set `MAIL_TEST_MODE=false` in Vercel and redeploy. Test-mode monthly runs use a separate key,
so the real monthly run still goes to everyone.

## 4. Where things are stored

| Collection / field | Contents |
|---|---|
| `email_outbox/{id}` | Queue and log: `type`, `status` (queued/sending/sent/failed), `to`, `bcc`, `recipients`, `recipientUids`, `batchId`, `classSessionId`, `month`, `createdBy`, `attempts`, `lastError`, `createdAt`, `sentAt`, `testMode`, `isResend` |
| `email_bodies/{id}` | Subject, HTML and plain text of each message (viewable in Email Center) |
| `email_runs/monthly_YYYY-MM` | Monthly run summary: when, by whom/scheduler, queued/skipped counts |
| `email_meta/rate` | Recipients sent in the current hour (enforces `MAIL_MAX_PER_HOUR`) |
| `class_sessions/{batchId}_{date}` | Now one doc per batch per day. New fields: `tasks`, `topicsNote`, `takenBy`, `emailReport { sendCount, lastSentAt, lastSentBy, lastStatus }` |
| `users/{uid}.status` | `active` / `inactive`. A missing value means active. |

## 5. Troubleshooting

- **"Email is not configured yet. Missing …"**: add the listed variables in Vercel and redeploy.
- **SMTP test fails with an auth error**: check `SMTP_USER` (the full address) and `SMTP_PASS`.
  Some hosts need port `587` + `starttls`.
- **Emails stay "Queued" with "Hourly sending limit reached"**: this is expected.
  They send in the next hour, on the next cron tick (add the cPanel cron for 5-minute ticks).
- **"Failed" in the log**: hover or read the error, fix the cause, then click ↻ (Retry) in Email Center.
- **Email history says it needs updated rules**: deploy `firestore.rules` (step 2.1).
- **Running locally**: `npm run dev` serves only the web app. To use the email API locally, run `npx vercel link`,
  `npx vercel env pull .env.local`, then `npx vercel dev`.
