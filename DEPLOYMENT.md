# Deployment

This repo is ready for a split deployment:

- Frontend: Vercel project with root directory `frontend`
- Backend, worker, beat, Postgres, Redis: Render Blueprint using `render.yaml`

## 1. Put The Project On GitHub

```bash
cd /Users/sujalprakashsingh/projects/productivity-app
git init
git add .
git commit -m "Initial Momentum deployment"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

## 2. Deploy Backend On Render

1. Open Render Dashboard.
2. New > Blueprint.
3. Select the GitHub repo.
4. Render detects `render.yaml`.
5. Fill prompted secret values:
   - `FRONTEND_ORIGIN`: your Vercel URL, or temporary `http://localhost:3000` until frontend deploys.
   - `CORS_ORIGINS`: same as frontend origin.
   - `OPENAI_API_KEY`
   - `WHATSAPP_VERIFY_TOKEN`
   - `WHATSAPP_CLOUD_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`
6. Apply Blueprint.

The backend health URL will be:

```text
https://momentum-api.onrender.com/health
```

## 3. Deploy Frontend On Vercel

1. Open Vercel Dashboard.
2. Add New Project.
3. Import the same GitHub repo.
4. Set Root Directory to `frontend`.
5. Set environment variable:

```env
NEXT_PUBLIC_API_URL=https://momentum-api.onrender.com/api
```

6. Deploy.

## 4. Update CORS

After Vercel gives you the frontend URL, update Render env vars:

```env
FRONTEND_ORIGIN=https://your-app.vercel.app
CORS_ORIGINS=https://your-app.vercel.app
```

Redeploy `momentum-api`.

## 5. WhatsApp Webhook

In Meta WhatsApp Cloud API, set:

```text
Callback URL: https://momentum-api.onrender.com/api/whatsapp/webhook
Verify token: same value as WHATSAPP_VERIFY_TOKEN
```

Subscribe to message events.
