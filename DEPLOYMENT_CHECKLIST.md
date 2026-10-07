# HisabKitab Deployment & Handover Checklist

## 1. MongoDB Atlas
Create an Atlas cluster and database user. Put the generated connection string in `Backend/.env`:
`MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER/hisabkitab?retryWrites=true&w=majority`

Do not commit `.env`.

## 2. Authentication
The backend creates the owner only when the database has no owner record.
Initial credentials come from:
- `DEFAULT_OWNER_PHONE`
- `DEFAULT_OWNER_PIN`

After first login, change the PIN from Settings.

The login flow is JWT-based. The browser stores the JWT in localStorage when "Remember me" is enabled and sessionStorage otherwise.

## 3. Production email / spam
The application now sends transaction email through backend SMTP first. EmailJS remains only as a migration/testing fallback.

For reliable inbox placement:
1. Use a real business/domain mailbox (for example `accounts@yourdomain.com`).
2. Configure your email provider's SPF record.
3. Enable DKIM and publish the provider's DKIM DNS record.
4. Publish a DMARC policy for the sending domain.
5. Set `MAIL_FROM` to the authenticated/verified sender.
6. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`.
7. Use a real `MAIL_REPLY_TO` if replies should go somewhere else.

No application code can guarantee that every recipient provider will put mail in Inbox; sender authentication and reputation control this.

## 4. Backend on Vercel
Deploy the `Backend` folder as its own Vercel project. `Backend/vercel.json` and `Backend/api/index.js` are already included.

Set all `Backend/.env` values in Vercel Project Settings > Environment Variables.

After deployment test:
`GET https://YOUR-BACKEND.vercel.app/api/health`

## 5. Frontend on Vercel
Deploy the `Frontend` folder as a separate Vercel project.

Set:
`VITE_API_URL=https://YOUR-BACKEND.vercel.app/api`

Then build/deploy.

## 6. Final acceptance test
1. Open frontend.
2. Login using the exact `DEFAULT_OWNER_PHONE` and `DEFAULT_OWNER_PIN` from the backend environment.
3. Confirm dashboard loads.
4. Add a test customer.
5. Record Udhaar.
6. Record Jama.
7. Add a supplier.
8. Record purchase.
9. Record supplier payment.
10. Open reports and verify balances.
11. Send a test transaction email to a real mailbox.
12. Confirm the message appears in Inbox/Promotions rather than Spam where possible.
13. Change the owner PIN and log in again with the new PIN.
14. Log out and confirm protected pages cannot be opened without login.
