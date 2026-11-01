# MoneyManager website: setup guide

MoneyManager is a single-page website. It needs no server code of its own. **Supabase** (free plan) handles user accounts, the 6-digit email codes and the database. Any static host can serve the files (Netlify, Vercel, Cloudflare Pages, GitHub Pages, or your current website host).

```
moneymanager-site/
├── index.html                      the app (design unchanged)
├── config.js                       your Supabase keys + advisor contact (the only file to edit)
├── README.md                       this guide
├── start-moneymanager.bat          double-click to preview at http://localhost:5500 (Windows)
├── serve.ps1                       the tiny local server the .bat runs
└── supabase/
    ├── schema.sql                  database tables + privacy rules
    └── email-templates/
        ├── confirm-signup.html     6-digit code email for new accounts
        └── reset-password.html     6-digit code email for password resets
```

## Preview it on your computer (localhost)

1. Open the **MoneyManager** folder in Documents.
2. Double-click **start-moneymanager.bat**. A small black window opens and your browser goes to **http://localhost:5500**. If that port is busy it uses 5501, 5502 and so on, and the window shows the exact address.
3. Keep the black window open while you use the site. Close it to stop.

Until `config.js` has your Supabase keys, the site runs in **Demo mode** (gold label in the top bar):
- Accounts, plans and score history are saved only in this browser.
- No emails are sent. The 6-digit code is shown on the verify screen instead.
- Every screen works, so you can try sign-up, verification, the checkup, dashboard, reports and Excel download.

Once the keys are added, demo mode turns off automatically and real accounts, emails and the database take over.

If Windows shows "Windows protected your PC", click **More info → Run anyway**. The starter only runs `serve.ps1` from the same folder, which serves these files to your own computer and nothing else.

## How sign-in works

| Screen | What happens |
|---|---|
| **Create account** | Full name, email, password (8+ characters). Supabase emails a 6-digit code. |
| **Verify email** | The user types the code (or pastes it). Only then is the account active. Codes expire after 1 hour; "Resend code" unlocks after 60 seconds. |
| **Sign in** | Email + password. If someone registered but never verified, they get a new code and go straight to the verify screen. |
| **Forgot password** | Email → 6-digit code → new password → signed in. |
| **Sign out** | Button on the user card at the bottom of the sidebar. |

Each user's plan and score history live in two tables protected by **row-level security**: the database itself only returns rows where the owner is the signed-in user. One user can never read or change another user's data, even with the public key in the page.

---

## Step 1–2: Project and database ✅ done

- Supabase project **moneymanager** (US East), in the **aig61-money-manager** organization.
- Tables `plans` and `checkups` were created from `supabase/schema.sql`, with row-level security. The privacy rules were tested: each user sees and changes only their own rows, and signed-out visitors see nothing.
- In the **Table Editor**, the `plans` table shows each family's name, health score, income, monthly surplus, net worth, protection gap, retirement gap and checkup progress at a glance.

## Step 3: Turn on email verification (3 min)

1. Go to **Authentication → Sign In / Providers → Email**.
2. Make sure **Enable Email provider** and **Confirm email** are both ON.
3. Set **Minimum password length** to 8.
4. Leave **Email OTP expiration** at 3600 seconds (1 hour), which matches the text on the verify screen.

## Step 4: Use the 6-digit code email templates (5 min)

By default Supabase sends a confirmation *link*. These templates send the *code* instead.

1. Go to **Authentication → Emails → Templates**.
2. **Confirm signup**
   - Subject: `Your MoneyManager code: {{ .Token }}`
   - Body: paste the contents of `supabase/email-templates/confirm-signup.html`
3. **Reset password**
   - Subject: `Your MoneyManager password reset code: {{ .Token }}`
   - Body: paste the contents of `supabase/email-templates/reset-password.html`
4. Save each template.

## Step 5: Send the codes from swati.hgi@gmail.com (required before launch, 10 min)

Supabase's built-in email sender is only meant for testing. It has very low hourly limits and isn't meant for real users. MoneyManager sends its codes through Gmail instead, from **swati.hgi@gmail.com**.

**5a. Create a Gmail app password**
1. Sign in to **swati.hgi@gmail.com** and open **myaccount.google.com → Security**.
2. Turn on **2-Step Verification** if it isn't on already (Google requires it for app passwords).
3. Open **myaccount.google.com/apppasswords**, name it `MoneyManager`, and click **Create**.
4. Copy the 16-character password Google shows. You'll only see it once. This is not your normal Gmail password, and you can revoke it anytime from the same page.

**5b. Connect Gmail in Supabase**
1. Go to **Authentication → Emails → SMTP Settings** and turn on **Enable custom SMTP**.
2. Fill in:

| Field | Value |
|---|---|
| Sender email | `swati.hgi@gmail.com` |
| Sender name | `MoneyManager` |
| Host | `smtp.gmail.com` |
| Port | `465` |
| Username | `swati.hgi@gmail.com` |
| Password | the 16-character app password from 5a |

3. Click **Save**.
4. Under **Authentication → Rate Limits**, set the email limit to fit your expected sign-ups (for example 30 per hour).

**Good to know**
- Clients will see the codes come from **MoneyManager &lt;swati.hgi@gmail.com&gt;**, and copies appear in that account's **Sent** folder.
- A personal Gmail account can send about 500 emails a day, which is plenty for sign-up and password-reset codes.
- If you later want codes to come from a business address like `no-reply@daretodreams.org`, switch these SMTP settings to a service such as Resend or Brevo and verify your domain there. Nothing else in the website changes.

## Step 6: Keys in `config.js` ✅ done

`config.js` holds the project URL and the public **anon** key. That key is designed to be public, because the privacy rules protect the data. Never put the `service_role` / secret key in the website.

## Step 7: Website online ✅ done (Vercel)

The Vercel project **moneymanager** deploys the `main` branch of `swatihgi-coder/aig61-money-manager` automatically on every push. It needs no build: Framework Preset **Other**, empty build command.

In Supabase go to **Authentication → URL Configuration**:
- Set **Site URL** to your Vercel address.
- Add it, plus `http://localhost:5500`, under **Redirect URLs**.

## Step 8: Test before inviting clients

- [ ] Create an account with a different email from swati.hgi@gmail.com → code arrives from MoneyManager &lt;swati.hgi@gmail.com&gt; (check spam) → verify → dashboard opens with your name filled in.
- [ ] Enter a wrong code → "That code is incorrect or has expired."
- [ ] Fill the checkup or load the example family → top bar shows **Saved to your account**.
- [ ] Sign out, sign back in → your numbers are still there.
- [ ] Create a second account with another email → it starts empty and can't see the first account's data.
- [ ] Forgot password → code arrives → new password works.
- [ ] **Reports & Excel → Download Excel** saves the workbook.
- [ ] Try it on a phone.

## Updating the site later

Push to GitHub and Vercel redeploys automatically. Users' saved data is in Supabase, so redeploying never touches it.

## Costs

Supabase Free (check supabase.com/pricing for current limits) covers up to 50,000 monthly active users and 500 MB of data; MoneyManager stores only a few KB per family. Vercel Hobby (free) covers a small practice. Supabase pauses free projects after a week with no activity; upgrade to Pro ($25/month) once clients rely on it, which also adds daily backups.

---
*Educational tool, not financial advice. Insurance cost figures are illustrative estimates.*
