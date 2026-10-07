import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import ShopSettings from './models/ShopSettings.js';
import api from './routes/api.js';

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    // Vercel preview URLs can be allowed explicitly through CLIENT_ORIGIN.
    return callback(new Error('CORS origin is not allowed'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'HisabKitab API', timestamp: new Date().toISOString() });
});

app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
}));

let initializationPromise;

async function initializeApplication() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await connectDB();

      let owner = await User.findOne({ role: 'owner' });
      if (!owner) {
        owner = await User.create({
          ownerName: process.env.DEFAULT_OWNER_NAME || 'Muhammad Ali',
          shopName: process.env.DEFAULT_SHOP_NAME || 'Alam Garments',
          phone: process.env.DEFAULT_OWNER_PHONE || '+92 0300-1234567',
          email: process.env.DEFAULT_OWNER_EMAIL || '',
          pinHash: await bcrypt.hash(process.env.DEFAULT_OWNER_PIN || '1234', 12),
          role: 'owner',
        });
      }

      let settings = await ShopSettings.findOne({ userId: owner._id });
      if (!settings) {
        await ShopSettings.create({
          userId: owner._id,
          name: owner.shopName,
          owner: owner.ownerName,
          phone: owner.phone,
          email: owner.email,
          currency: 'Rs.',
          category: 'Garments & Clothing',
          creditLimit: 50000,
          whatsappReceipts: true,
          smsReminders: true,
          autoBackup: true,
        });
      }
    })().catch((error) => {
      initializationPromise = undefined;
      throw error;
    });
  }
  return initializationPromise;
}

// Every API request gets a DB connection before reaching protected routes.
// This makes the same Express app work locally and as a Vercel serverless function.
app.use('/api', async (req, res, next) => {
  if (req.path === '/health') return next();
  try {
    await initializeApplication();
    next();
  } catch (error) {
    console.error('Application initialization failed:', error);
    res.status(503).json({ message: 'Database is temporarily unavailable.' });
  }
});

app.use('/api', api);

app.use((err, req, res, next) => {
  console.error(err);
  if (err?.code === 11000) {
    return res.status(409).json({ message: 'A record with this unique value already exists.' });
  }
  if (err?.message === 'CORS origin is not allowed') {
    return res.status(403).json({ message: err.message });
  }
  res.status(500).json({ message: err.message || 'Internal server error' });
});

export { app, initializeApplication };

const port = process.env.PORT || 5000;

if (process.env.VERCEL !== '1') {
  initializeApplication()
    .then(() => app.listen(port, () => console.log(`HisabKitab API running on http://localhost:${port}`)))
    .catch((error) => {
      console.error('Failed to start HisabKitab API:', error);
      process.exit(1);
    });
}

export default app;
