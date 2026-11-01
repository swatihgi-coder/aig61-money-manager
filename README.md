# MoneyManager

A personal financial checkup website: DIME analysis, cash flow, protection, retirement and college goals, net worth, an affordable action plan, and reports with Excel download. Built for DareToDreams Financial Group.

**How it fits together**

- **Website** (`index.html`, `config.js`): a single static page, hosted on Vercel.
- **Database**: a private **Google Sheet** in your Google account.
- **Backend** (`google-apps-script/Code.gs`): a small Google Apps Script attached to that sheet. It creates accounts, emails the 6-digit codes from your Gmail, keeps sign-in sessions, and saves each family's plan.

```
aig61-money-manager/
├── index.html                    the app (design unchanged)
├── config.js                     your Google Sheets web app link + advisor contact
├── google-apps-script/Code.gs    the backend to paste into your Google Sheet
├── start-moneymanager.bat        double-click to preview at http://localhost:5500 (Windows)
├── serve.ps1                     the tiny local server the .bat runs
└── README.md                     this guide
```

## What's in the Google Sheet

The script creates these tabs automatically:

| Tab | What it holds |
|---|---|
| **Users** | Email, name, verified, sign-up and last sign-in dates. Passwords are stored only as salted hashes (`pass_hash`, `salt`), never readable. |
| **Plans** | One row per family: health score, household income, monthly surplus, net worth, protection gap, retirement gap and checkup progress. These are readable at a glance. The full answers are in `state_json`. |
| **Checkups** | Score history each time a user clicks **Save to history**. |
| **Codes** | Pending 6-digit codes, stored hashed, expiring after 1 hour. |
| **Sessions** | Sign-in sessions, stored hashed, expiring after 30 days. |

**Privacy:** website users never see the sheet. The script only ever returns a user's own rows to that user. You, as the sheet's owner, can see every family's data, so keep the sheet unshared. Only share it with people who are allowed to see client information. Don't edit the `Codes`, `Sessions`, `pass_hash` or `salt` columns by hand.

---

## Connect Google Sheets (about 10 minutes, one time)

Do this signed in to **swati.hgi@gmail.com**. The 6-digit code emails will be sent from that account.

**1. Create the sheet**
1. Go to **sheets.new**.
2. Rename it (top left) to **MoneyManager Data**.

**2. Add the backend script**
1. In the sheet, click **Extensions → Apps Script**.
2. Delete everything in the editor, then paste the entire contents of `google-apps-script/Code.gs`.
3. Click the **Save** icon. You can name the project **MoneyManager API**.

**3. Run setup once**
1. In the toolbar's function dropdown, choose **setup**, then click **Run**.
2. Google asks for permission: click **Review permissions** and choose your account.
3. You'll see "Google hasn't verified this app". That's expected, because it's your own script. Click **Advanced → Go to MoneyManager API (unsafe) → Allow**. It asks to manage your spreadsheets and send email as you, which is exactly what the backend does.
4. Back in the sheet, you'll now see the tabs **Users, Plans, Checkups, Codes, Sessions**.

**4. Publish it as a web app**
1. In Apps Script, click **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set **Execute as: Me** and **Who has access: Anyone**. "Anyone" only means the website can call the script. The sheet itself stays private.
4. Click **Deploy** and copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy…/exec`.

**5. Put the link in `config.js`**
```js
googleSheetsApiUrl: "https://script.google.com/macros/s/AKfy…/exec",
```
Commit and push to GitHub. Vercel redeploys automatically within a minute, and Demo mode turns off.

**If you change `Code.gs` later:** in Apps Script, go to **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. This keeps the same URL, so `config.js` doesn't change.

## How sign-in works

| Screen | What happens |
|---|---|
| **Create account** | Full name, email, password (8+ characters). The script emails a 6-digit code from your Gmail. |
| **Verify email** | The user types or pastes the code. Codes expire after 1 hour and allow 5 tries. "Resend code" unlocks after 60 seconds. |
| **Sign in** | Email and password. After 10 wrong passwords, sign-in locks for 15 minutes. Unverified accounts are sent a fresh code. |
| **Forgot password** | Email → 6-digit code → new password. This also signs that account out of other devices. |
| **Sign out** | The button on the user card at the bottom of the sidebar. |

**Email limit:** a personal Gmail account can send about **100 code emails a day** through Apps Script. `setup` prints how many are left today. If you outgrow that, a Google Workspace account raises it to 1,500 a day.

## Preview on your computer (localhost)

1. Open the project folder.
2. Double-click **start-moneymanager.bat**. Your browser opens **http://localhost:5500**.
3. Keep the black window open while you use the site, and close it to stop.

You can also double-click `index.html` to open it directly.

## Demo mode

While `googleSheetsApiUrl` is empty, the site shows a gold **Demo mode** label. Accounts and plans are kept only in each visitor's browser, and the 6-digit code is shown on screen instead of emailed. Every screen works, which is useful for previews. When the link is added, the real sheet takes over.

## Deploying (Vercel)

The Vercel project **moneymanager** deploys the `main` branch of `swatihgi-coder/aig61-money-manager` automatically on every push. It needs no build: Framework Preset **Other**, empty build command.

## Test checklist after connecting the sheet

- [ ] Create an account with an email other than swati.hgi@gmail.com → the code arrives from MoneyManager (check spam) → verify → the dashboard opens with your name.
- [ ] A wrong code shows "That code is incorrect or has expired."
- [ ] Load the example family → the top bar shows **Saved to your account** → a row appears in the **Plans** tab.
- [ ] Sign out and back in → your numbers are still there.
- [ ] A second account starts empty and can't see the first account's data.
- [ ] Forgot password → a code arrives → the new password works.
- [ ] **Reports & Excel → Download Excel** saves the workbook.

---
*Educational tool, not financial advice. Insurance cost figures are illustrative estimates.*
