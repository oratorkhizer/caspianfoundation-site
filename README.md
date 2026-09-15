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

## House rules
No em dashes anywhere in output. Indian English. Never publish an impact number that cannot be evidenced.
