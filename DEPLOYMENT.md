# Deployment Guide

This guide will walk you through deploying the E2EE Email Client to production.

## Prerequisites

- GitHub account
- MongoDB Atlas account
- Vercel account (for frontend)
- Render account (for backend)

## Step 1: MongoDB Atlas Setup

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new account or sign in
3. Create a new cluster (free tier is fine)
4. Create a database user:
   - Go to Database Access
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Create a username and strong password
   - Save credentials securely
5. Whitelist IP addresses:
   - Go to Network Access
   - Click "Add IP Address"
   - For Render: Use `0.0.0.0/0` (allow all IPs) or add Render's IP ranges
   - Click "Confirm"
6. Get your connection string:
   - Go to Clusters
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with `e2ee-email` (or your preferred database name)

## Step 2: Backend Deployment (Render)

1. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. Go to [Render](https://render.com) and sign up/login

3. Create a new Web Service:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository

4. Configure the service:
   - **Name**: `e2ee-email-backend` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Root Directory**: Leave empty (or set to `backend` if needed)

5. Set Environment Variables:
   - `PORT`: Leave as default (Render sets this automatically)
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `JWT_SECRET`: Generate a strong random string (use `openssl rand -base64 32` or similar)
   - `NODE_ENV`: `production`
   - `FRONTEND_URL`: Will be your Vercel URL (set this after frontend deployment)

6. Click "Create Web Service"

7. Wait for deployment to complete

8. Copy your Render service URL (e.g., `https://e2ee-email-backend.onrender.com`)

## Step 3: Frontend Deployment (Vercel)

1. Go to [Vercel](https://vercel.com) and sign up/login

2. Import your GitHub repository:
   - Click "Add New..." → "Project"
   - Import your GitHub repository
   - Select the repository

3. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (should auto-detect)
   - **Output Directory**: `dist` (should auto-detect)
   - **Install Command**: `npm install` (should auto-detect)

4. Set Environment Variables:
   - `VITE_API_URL`: Your Render backend URL + `/api`
     - Example: `https://e2ee-email-backend.onrender.com/api`

5. Click "Deploy"

6. Wait for deployment to complete

7. Copy your Vercel URL (e.g., `https://e2ee-email-app.vercel.app`)

## Step 4: Update Environment Variables

### Update Backend (Render)

1. Go back to Render dashboard
2. Select your backend service
3. Go to "Environment" tab
4. Update `FRONTEND_URL` to your Vercel URL:
   - Example: `https://e2ee-email-app.vercel.app`
5. Save changes (this will trigger a redeploy)

### Update Frontend (Vercel) - Optional

If you need to change the API URL:
1. Go to Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Update `VITE_API_URL` if needed
5. Redeploy

## Step 5: Test Your Deployment

1. Visit your Vercel frontend URL
2. Register a new account
3. Try sending an email to yourself
4. Verify encryption is working (check that server only stores encrypted data)

## Troubleshooting

### Backend Issues

- **Connection to MongoDB fails**: 
  - Check MongoDB Atlas IP whitelist includes Render IPs
  - Verify connection string is correct
  - Check database user credentials

- **CORS errors**:
  - Verify `FRONTEND_URL` in backend matches your Vercel URL exactly
  - Check that CORS middleware is configured correctly

- **JWT errors**:
  - Verify `JWT_SECRET` is set and is a strong random string
  - Ensure same secret is used consistently

### Frontend Issues

- **API calls fail**:
  - Check `VITE_API_URL` is set correctly
  - Verify backend is running and accessible
  - Check browser console for CORS errors

- **Build fails**:
  - Check Node.js version (Vercel should auto-detect)
  - Verify all dependencies are in package.json
  - Check build logs for specific errors

## Security Checklist

- [ ] MongoDB Atlas IP whitelist is configured
- [ ] Strong JWT_SECRET is set (not the default)
- [ ] HTTPS is enabled (automatic on Vercel and Render)
- [ ] Environment variables are set (not hardcoded)
- [ ] `.env` files are in `.gitignore`
- [ ] Database user has appropriate permissions

## Custom Domain (Optional)

### Vercel Custom Domain
1. Go to Vercel project settings
2. Navigate to "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

### Render Custom Domain
1. Go to Render service settings
2. Navigate to "Custom Domains"
3. Add your custom domain
4. Update DNS records as instructed
5. Update `FRONTEND_URL` in backend to match

## Monitoring

- **Render**: Check service logs in Render dashboard
- **Vercel**: Check deployment logs and analytics
- **MongoDB Atlas**: Monitor database usage and performance

## Backup and Recovery

- **Database**: MongoDB Atlas provides automatic backups (paid plans)
- **Code**: Your code is in GitHub (source of truth)
- **Environment Variables**: Document all env vars securely (use password manager)

## Cost Estimation

- **MongoDB Atlas**: Free tier available (512MB storage)
- **Vercel**: Free tier available (hobby plan)
- **Render**: Free tier available (with limitations, may sleep after inactivity)

For production use, consider paid plans for better performance and reliability.

