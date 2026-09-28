# Deployment Guide

## Overview

Academic Compass is a full-stack app with two parts:
- **Frontend**: React + Vite static site — deploy to **Vercel**
- **Backend**: Express API server — deploy to **Railway**, **Render**, or **Fly.io**

## Prerequisites

- Vercel account: https://vercel.com
- Railway/Render account: https://railway.app or https://render.com
- PostgreSQL database (Vercel Postgres, Railway Postgres, or Supabase)
- GitHub repository connected to Vercel and your chosen backend host

## 1. Deploy Frontend to Vercel

### Option A: Vercel Dashboard
1. Go to https://vercel.com/new
2. Import your GitHub repository (`scar001-tech/academic_compass`)
3. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `pnpm --filter @workspace/academic-compass run build`
   - **Output Directory**: `artifacts/academic-compass/dist/public`
   - **Install Command**: `pnpm install`
4. Add Environment Variables:
   - `VITE_API_ORIGIN` = `https://your-backend-url.com` (your deployed backend URL)
5. Click **Deploy**

### Option B: Vercel CLI
```bash
npm i -g vercel
vercel login
vercel
```

### Environment Variables (Vercel)
| Variable | Description |
|----------|-------------|
| `VITE_API_ORIGIN` | Backend URL (e.g. `https://academic-compass-api.railway.app`) |

## 2. Deploy Backend

### Option A: Railway
1. Go to https://railway.app/new
2. Select your GitHub repository
3. Select the `artifacts/api-server` folder as the root
4. Add Environment Variables:
   - `DATABASE_URL` = your PostgreSQL connection string
   - `SESSION_SECRET` = a secure random string
   - `PORT` = `8080`
   - `CORS_ORIGINS` = your Vercel frontend URL (e.g. `https://academic-compass.vercel.app`)
   - `NODE_ENV` = `production`
5. Deploy

Railway will detect the `package.json` and run:
```bash
pnpm install
pnpm run build
pnpm start
```

### Option B: Render
1. Go to https://dashboard.render.com/create
2. Select **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Root Directory**: `artifacts/api-server`
   - **Build Command**: `pnpm install && pnpm run build`
   - **Start Command**: `pnpm start`
5. Add Environment Variables:
   - `DATABASE_URL` = your PostgreSQL connection string
   - `SESSION_SECRET` = a secure random string
   - `PORT` = `8080`
   - `CORS_ORIGINS` = your Vercel frontend URL
   - `NODE_ENV` = `production`
6. Deploy

## 3. Database Setup

### Vercel Postgres
1. In your Vercel project, go to **Storage** → **Create Database** → **Postgres**
2. Copy the `DATABASE_URL` connection string
3. Add it to your backend environment variables

### Railway Postgres
1. In your Railway project, go to **New** → **Database** → **PostgreSQL**
2. Copy the `DATABASE_URL` connection string
3. Add it to your backend environment variables

### Supabase
1. Go to https://supabase.com and create a new project
2. Go to **Settings** → **Database** → **Connection string**
3. Copy the `DATABASE_URL` (use the `pooled` connection string for production)
4. Add it to your backend environment variables

**Important**: The backend currently uses SQLite for local development. For production, you must use PostgreSQL. Update `DATABASE_URL` to a PostgreSQL connection string.

## 4. CORS Configuration

Update `CORS_ORIGINS` in your backend to include your Vercel domain:
```
CORS_ORIGINS=https://academic-compass.vercel.app,https://your-custom-domain.com
```

## 5. Verify Deployment

1. Visit your Vercel frontend URL.
2. No login is required — authentication has been disabled, so every visitor has full principal access.
3. Verify the API calls work (check browser DevTools → Network tab).

## Troubleshooting

- **CORS errors**: Ensure `CORS_ORIGINS` includes your Vercel domain
- **Database errors**: Ensure `DATABASE_URL` is a valid PostgreSQL connection string
- **Build failures**: Ensure `pnpm install` runs successfully on Vercel
- **API not found**: Ensure `VITE_API_ORIGIN` is set correctly in Vercel

## Local Development

```bash
# Frontend
pnpm --filter @workspace/academic-compass run dev

# Backend
pnpm --filter @workspace/api-server run dev
```
