# HisabKitab — Production-Ready Frontend + Backend

This package contains the React/Vite frontend and Express/MongoDB backend separately.

## Important before deployment

You must supply your own:
- MongoDB Atlas connection string
- JWT secret
- Production SMTP credentials / verified sending domain
- Frontend production API URL

These are intentionally not invented or hard-coded.

## Local test

### Backend
```powershell
cd Backend
Copy-Item .env.example .env
# Edit .env and set MONGODB_URI, JWT_SECRET and initial owner values.
npm install
npm start
```

Backend health:
`http://localhost:5000/api/health`

### Frontend
Open a second terminal:
```powershell
cd Frontend
Copy-Item .env.example .env
# For local testing keep VITE_API_URL=http://localhost:5000/api
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Login

On a new/empty MongoDB database, the backend creates the owner once using:
- `DEFAULT_OWNER_PHONE`
- `DEFAULT_OWNER_PIN`

Use exactly those values on the first login.

After login, change the PIN from Settings.

If an owner already exists in MongoDB, changing DEFAULT_OWNER_* does not overwrite that existing account.

## Email delivery

Transaction emails now use **backend SMTP first**. This is the recommended production path because the sender mailbox/domain can be authenticated with SPF, DKIM and DMARC.

EmailJS remains as a fallback during migration/testing.

### Why spam cannot be fixed by React code alone

Inbox placement depends on the sending domain/provider reputation and authentication. For production:
1. Use a real business email address on your own domain.
2. Configure SPF.
3. Configure DKIM.
4. Configure DMARC.
5. Set `MAIL_FROM` to the verified sender.
6. Configure SMTP credentials in the backend environment.

No application can guarantee Inbox placement for every recipient provider.

## Vercel deployment

Deploy **Backend** and **Frontend as two separate Vercel projects**.

### Backend project
Set project root to `Backend`.

Environment variables:
- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_ORIGIN`
- `DEFAULT_OWNER_NAME`
- `DEFAULT_SHOP_NAME`
- `DEFAULT_OWNER_PHONE`
- `DEFAULT_OWNER_EMAIL`
- `DEFAULT_OWNER_PIN`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`
- `MAIL_REPLY_TO`

Then test:
`https://YOUR-BACKEND-DOMAIN/api/health`

### Frontend project
Set project root to `Frontend`.

Environment variable:
`VITE_API_URL=https://YOUR-BACKEND-DOMAIN/api`

Deploy the frontend.

## Customer handover

Do not give the customer:
- your Git credentials
- MongoDB Atlas password
- SMTP password
- JWT secret

Give them the deployed application URL and their owner login credentials.

Keep the production `.env` values in Vercel environment variables rather than committing them to Git.
