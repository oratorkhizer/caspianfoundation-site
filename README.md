# caspianfoundation.in

Website of Caspian Healthcare Foundation, a registered public charitable trust in Hyderabad.

## Stack
Static HTML, no framework. `node build.mjs` assembles `pages/*.html` into `public/` using `layout.html`,
so the header, footer and meta tags are defined once. Serverless functions live in `/api`.

- `pages/` page bodies, each with a `<!--meta {...} -->` JSON block at the top (title, description, nav key, extra head or foot markup)
- `layout.html` the shell
- `assets/` stylesheet and scripts
- `img/` photographs, from the Caspian Diabesity Expo 2025
- `api/create-order.js` creates a Razorpay order for a donation, amount validated server side
- `api/verify-payment.js` verifies the Razorpay signature and emails a donation alert
- `api/enquiry.js` relays the contact form so the inbox address is never in the page source

The build fails on an unreplaced template token or an em dash, on purpose.

## The approval orders
`docs/` is optional and is not in this repository by default. Drop
`CHF-12A-registration-order.pdf` and `CHF-80G-approval-order.pdf` into `docs/`, redeploy, and the
download block on the transparency page reveals itself (app.js HEAD-checks the 80G file and keeps the
block hidden until it is really there, so the page never offers a download that 404s).

The trust deed and the PAN card are deliberately NOT published: the deed scan carries the trustees'
photographs, thumb impressions, signatures, partial Aadhaar numbers and a home address.

## The donate form
Validation runs in `assets/donate.js` and again in `api/create-order.js`, because the browser can be
bypassed. Both check the email format, the PAN format, and the mobile number. The number is split into
a country code box (default `+91`) and a local number; Indian numbers must be ten digits starting 6 to 9,
other countries are checked for length only. A PAN without an address is refused, because the 80G receipt
needs both. The page-specific styles for the asterisks and the phone row are inlined in the `head` key of
`pages/donate.html`, not in the shared stylesheet.

## Foreign donations
The Foundation cannot accept them, and the donate page says so.

1. Razorpay does not offer international payments to charitable organisations, so foreign cards will not
   work on this page whatever we do in code.
2. Under FCRA a trust may accept money from a foreign source only with FCRA registration, which the
   Foundation does not hold. Registration normally needs three years of existence and a minimum spend on
   core activities over that period, so the earliest realistic window is after FY 2025-26.
3. An NRI holding a valid Indian passport is not a foreign source, so such a donation is fine. A person of
   Indian origin who has taken another citizenship IS a foreign source.

If FCRA registration is ever obtained, foreign contributions must go into the designated FCRA account at
SBI New Delhi Main Branch and nowhere else, so a second payment route would be needed, not this one.

## Environment variables (Vercel)
| Name | Purpose |
| --- | --- |
| `RAZORPAY_KEY_ID` | Razorpay key id of the Caspian Healthcare Foundation account |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret, never committed |
| `ALERT_EMAIL` | inbox that receives donation alerts and contact form enquiries |

Without the Razorpay variables the donate form reports that donations are not configured.
The FormSubmit address used by `ALERT_EMAIL` has to be activated once by clicking the link in its first email.

## Facts that must stay accurate
- PAN AADTC2568A
- Section 12AB URN AADTC2568A23HY01, granted 17 February 2024, valid AY 2023-24 to 2027-28
- Section 80G URN AADTC2568A24HY01, granted 26 August 2024, valid AY 2024-25 to 2028-29
- Trust registered 1 March 2023, Document No. 30/2023, Book IV, SRO Golconda, Hyderabad

The 12AB registration runs out after AY 2027-28. Renewal in Form 10AB is due at least six months before
the end of that period, so the paperwork should start around September 2027.

## Email
The domain's mail runs on Google Workspace as a user alias domain of caspianobesity.com, so
info@caspianfoundation.in lands in the same mailbox. DNS lives in GoDaddy: five Google MX records,
SPF `v=spf1 include:_spf.google.com ~all`, and DKIM at `google._domainkey` once generated.

## House rules
No em dashes anywhere in output. Indian English. Never publish an impact number that cannot be evidenced.
