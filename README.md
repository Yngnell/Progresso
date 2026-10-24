# Progresso — SK Project Monitoring System

A web-based project development and monitoring system for the Sangguniang Kabataan of
Barangay Salinas 1, Bacoor City, Cavite: project proposals with Barangay Chairman approval,
automatic progress, receipt-backed expenses, calendar and attendance, notifications (in-app
and Gmail), accomplishment reports, and a public transparency portal.

```
client/   React 18 + Vite + Tailwind CSS (frontend)
server/   Node.js + Express + Prisma + PostgreSQL (REST API)
```

## Run locally

Requirements: Node.js 18+ and a PostgreSQL database (local or Neon).

```bash
# 1. API
cd server
cp .env.example .env          # fill in DATABASE_URL, JWT_SECRET, admin login, Gmail (optional)
npm install                   # also runs `prisma generate`
npm run prisma:migrate        # create the tables
npm run prisma:seed           # admin + Barangay Chairman accounts, officials
npm run dev                   # http://localhost:5000

# 2. Frontend (second terminal)
cd client
npm install
npm run dev                   # http://localhost:5173 (proxies /api to the API)
```

## Deploy

**Database:** create a PostgreSQL database (e.g. Neon) and copy its connection string.

**API (e.g. Render, Railway, or a VPS)**
- Root directory: `server`
- Build command: `npm install && npm run prisma:deploy`
- Start command: `npm start`
- Environment variables: everything in `server/.env.example`. Set `APP_URL` to the
  frontend's public address so the links in notification emails work.
- Expense receipts are saved to `server/uploads/receipts`. Use a host with a persistent
  disk (or attach one); on hosts with a temporary disk, uploaded receipts are lost on
  every redeploy.

**Frontend (e.g. Vercel or Netlify)**
- Root directory: `client`
- Build command: `npm run build`, output directory: `dist`
- Environment variable: `VITE_API_URL` = the API's public address (no trailing `/api`)
- Add a rewrite of all paths to `/index.html` so links like `/projects/123` open directly
  (Vercel: a `vercel.json` rewrite; Netlify: a `public/_redirects` file with
  `/* /index.html 200`).

Never commit the `.env` files: they hold the database password, the JWT secret, and the
Gmail app password.
