# HisabKitab — MongoDB Backend

This project keeps the existing React UI and connects it to a real Node/Express/MongoDB API.

## Stack
- Node.js + Express
- MongoDB + Mongoose
- JWT authentication
- bcryptjs PIN hashing
- Helmet, CORS, rate limiting
- Existing EmailJS remains on the frontend for customer/supplier transaction notifications

## Folder
```text
backend/
  src/
    config/db.js
    middleware/auth.js
    models/
    routes/api.js
    utils/
    server.js
  .env.example
  package.json
```

## MongoDB
Install MongoDB Community locally or use MongoDB Atlas. Create a database named `hisabkitab` by using:
```env
MONGODB_URI=mongodb://127.0.0.1:27017/hisabkitab
```

## Environment
Copy `backend/.env.example` to `backend/.env` and change `JWT_SECRET`.

Default first-owner login is seeded only when the database has no owner:
- Phone: `+92 0300-1234567`
- PIN: `1234`

Change the PIN from Settings after login.

## Run backend
```powershell
cd backend
npm install
npm run dev
```
Backend: `http://localhost:5000`
Health check: `http://localhost:5000/api/health`

## Run frontend
From the project root:
```powershell
npm install
npm run dev
```
Frontend: `http://localhost:5173`

Optional frontend env:
```env
VITE_API_URL=http://localhost:5000/api
```

## API endpoints
### Auth
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/profile`
- `PUT /api/auth/pin`

### Bootstrap/settings
- `GET /api/bootstrap`
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/dashboard`
- `GET /api/reports`

### Customers
- `GET /api/customers`
- `POST /api/customers`
- `PUT /api/customers/:id`
- `DELETE /api/customers/:id`
- `GET /api/customers/:id/transactions`
- `POST /api/customers/:id/transactions`

### Suppliers
- `GET /api/suppliers`
- `POST /api/suppliers`
- `PUT /api/suppliers/:id`
- `PATCH /api/suppliers/:id/status`
- `DELETE /api/suppliers/:id`
- `GET /api/suppliers/:id/transactions`
- `POST /api/suppliers/:id/purchases`
- `POST /api/suppliers/:id/payments`
- `POST /api/suppliers/:id/returns`

### Inventory
- `GET /api/inventory`

## Data model
The backend persists Users, ShopSettings, Customers, Suppliers, CustomerTransactions, SupplierTransactions, Purchases, Payments, PurchaseReturns, and Inventory.

Customer balance is maintained as `totalUdhaar - totalJama`.
Supplier payable balance is maintained from opening balance + purchase remaining - supplier payments - purchase returns.

## EmailJS
The existing frontend EmailJS module is preserved. Keep its Service ID, Template ID and Public Key in the existing Settings UI. The EmailJS template should use `{{recipient_email}}` for To Email and `{{to_name}}`, `{{previous_balance}}`, `{{current_balance}}`, etc. for the transaction values.
