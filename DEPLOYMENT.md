# Gravity Gauntlet Deployment Guide

## Environment Variables Configuration

### Backend (Render)

Set these environment variables in your Render dashboard:

```
CLIENT_URL=https://gravity-gauntlet-delta.vercel.app
NODE_ENV=production
```

**Note:** `PORT` is automatically set by Render - you don't need to configure it.

### Frontend (Vercel)

Set this environment variable in your Vercel dashboard:

```
VITE_API_URL=https://gravitygauntlet.onrender.com
```

## Local Development

### Backend (.env in `server/`)

```env
PORT=10000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

### Frontend (.env in `client/`)

```env
VITE_API_URL=http://localhost:10000
```

## Changes Made

### Backend (`server/src/index.js`)

1. ✅ CORS now uses `CLIENT_URL` from environment variable
2. ✅ Socket.io CORS configured with `CLIENT_URL` for production
3. ✅ Default port changed to 10000 for local development
4. ✅ dotenv already configured at the top

### Frontend (`client/src/socket.ts`)

1. ✅ Changed from `VITE_SERVER_URL` to `VITE_API_URL`
2. ✅ Default URL changed to `http://localhost:10000`
3. ✅ Socket.io client already uses `transports: ['websocket']`

## Deployment Steps

1. **Set environment variables in Render:**
   - Go to your Render service dashboard
   - Navigate to Environment tab
   - Add `CLIENT_URL=https://gravity-gauntlet-delta.vercel.app`
   - Add `NODE_ENV=production`
   - Save and redeploy

2. **Set environment variable in Vercel:**
   - Go to your Vercel project dashboard
   - Navigate to Settings > Environment Variables
   - Add `VITE_API_URL=https://gravitygauntlet.onrender.com`
   - Save and redeploy

3. **Test the connection:**
   - Open your Vercel frontend URL
   - Check browser console for WebSocket connection
   - Should connect successfully to Render backend

## Troubleshooting

- **WebSocket connection fails:** Verify `CLIENT_URL` in Render matches your Vercel URL exactly
- **CORS errors:** Ensure `CLIENT_URL` includes the protocol (`https://`)
- **Connection timeout:** Check that Render service is running and accessible
- **Local dev not working:** Verify `.env` files exist in both `server/` and `client/` directories

