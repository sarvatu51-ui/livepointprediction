# ⚡ LivePointPredict

Real-time cricket prediction platform with virtual points, session markets, deposit/withdrawal system, and WhatsApp support.

---

## 🚀 First Time Setup (Local)

### Requirements
- Node.js v18+ → https://nodejs.org
- MongoDB → https://mongodb.com/atlas (free cloud) OR local install

### Step 1 — Backend
```bash
cd server
cp .env.example .env
# Edit .env with your values (see below)
npm install
npm run dev
```

### Step 2 — Frontend
```bash
cd client
npm install
npm start
```

App runs at → http://localhost:3000
Admin login → admin@livepointpredict.com / admin123

---

## ⚙️ Environment Variables (server/.env)

```
PORT=5000
MONGO_URI=mongodb+srv://YOUR_ATLAS_URI
JWT_SECRET=any_long_random_secret_here
CLIENT_URL=https://your-frontend.vercel.app
CRICAPI_KEY=your_cricapi_key_here
```

---

## 🌐 Deploy on Railway + Vercel

### Backend → Railway
1. railway.app → New Project → GitHub repo
2. Root directory: `server`
3. Add all env variables from above
4. Deploy → copy the Railway URL

### Frontend → Vercel
1. vercel.com → New Project → GitHub repo
2. Root directory: `client`
3. Add env variable: `REACT_APP_API_URL=https://your-railway-url.up.railway.app`
4. Deploy

---

## 📱 WhatsApp Button
Edit this file to set your number:
`client/src/components/WhatsAppButton.js`

Change line:
```js
const WHATSAPP_NUMBER = '919999999999'; // Your number with country code
```
India example: +91 98765 43210 → `919876543210`

---

## 🏏 Cricket Sessions (Admin Guide)
1. Create a match → set sport to Cricket
2. Go to Admin → Matches → click **+ Add Session**
3. Choose: Toss / 6-Over / 10-Over / 15-Over / 20-Over / Next Over
4. Set the line (e.g. 48.5 runs) and odds
5. Users can now bet on that session
6. After the session plays out → click **Settle** → choose Over/Under → all bets auto-resolved

## 💰 Deposit & Withdrawal (Admin Guide)
- User clicks **Deposit** → submits request with point amount
- Admin sees it in **Admin → Transactions** tab
- Admin clicks **Approve** → points added to user instantly
- For **Redeem** requests → points locked on user submission → Admin approves (you pay outside app) or rejects (points refunded)
