# How to Generate .env File

## Step 1: Create the .env file

Copy the example file:

**Windows PowerShell:**
```powershell
Copy-Item .env.example .env
```

**Windows CMD:**
```cmd
copy .env.example .env
```

**Linux/Mac:**
```bash
cp .env.example .env
```

## Step 2: Generate Each Value

### 1. PORT (Line 1)
```
PORT=5000
```
- **What it is**: The port your backend server will run on
- **How to generate**: Use any available port (5000 is default)
- **Keep as is**: `5000` is fine for development

### 2. MONGODB_URI (Line 2)
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/e2ee-email?retryWrites=true&w=majority
```

**How to get this:**

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up or log in
3. Create a new cluster (free tier works)
4. Go to **Database Access** → Create a database user:
   - Username: Choose any (e.g., `e2eeuser`)
   - Password: Generate a strong password (save it!)
   - Database User Privileges: Read and write to any database
5. Go to **Network Access** → Add IP Address:
   - For development: Add your current IP or use `0.0.0.0/0` (allows all IPs)
6. Go to **Clusters** → Click **Connect** → Choose **Connect your application**
7. Copy the connection string
8. Replace `<password>` with your database user password
9. Replace `<dbname>` with `e2ee-email` (or your preferred database name)

**Example:**
```
MONGODB_URI=mongodb+srv://e2eeuser:MyPassword123@cluster0.abc123.mongodb.net/e2ee-email?retryWrites=true&w=majority
```

### 3. JWT_SECRET (Line 3)
```
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

**How to generate a strong secret:**

**Option 1: Using Node.js (Recommended)**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Option 2: Using OpenSSL**
```bash
openssl rand -base64 32
```

**Option 3: Online Generator**
- Visit: https://randomkeygen.com/
- Use a "CodeIgniter Encryption Keys" (256-bit)
- Copy the generated key

**Option 4: Manual (Less Secure)**
- Use a long random string (at least 32 characters)
- Mix letters, numbers, and symbols
- Example: `MySuperSecretJWTKey2024!@#$%^&*()`

**Important**: Use a different secret for production!

### 4. NODE_ENV (Line 4)
```
NODE_ENV=development
```
- **What it is**: Environment mode
- **Development**: `development`
- **Production**: `production`
- **Keep as is**: `development` for local development

### 5. FRONTEND_URL (Line 5)
```
FRONTEND_URL=http://localhost:5173
```
- **What it is**: Your frontend URL for CORS
- **Development**: `http://localhost:5173` (Vite default)
- **Production**: Your Vercel/deployed frontend URL
- **Keep as is**: `http://localhost:5173` for local development

## Step 3: Verify Your .env File

Your final `.env` file should look like this:

```env
PORT=5000
MONGODB_URI=mongodb+srv://youruser:yourpassword@cluster0.abc123.mongodb.net/e2ee-email?retryWrites=true&w=majority
JWT_SECRET=your-generated-secret-key-here
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

## Quick Generation Script

**Windows PowerShell:**
```powershell
# Generate JWT_SECRET
$jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Host "JWT_SECRET=$jwtSecret"
```

**Linux/Mac:**
```bash
# Generate JWT_SECRET
echo "JWT_SECRET=$(openssl rand -base64 32)"
```

## Security Checklist

- [ ] MongoDB password is strong and saved securely
- [ ] JWT_SECRET is randomly generated (not the example value)
- [ ] .env file is in .gitignore (should not be committed)
- [ ] MongoDB IP whitelist is configured
- [ ] Different secrets for development and production

## Troubleshooting

**"Cannot connect to MongoDB"**
- Check your connection string is correct
- Verify password doesn't have special characters that need URL encoding
- Check IP whitelist in MongoDB Atlas includes your IP

**"JWT authentication failed"**
- Verify JWT_SECRET is set and not empty
- Make sure it's the same value if you restart the server

**"CORS error"**
- Check FRONTEND_URL matches your actual frontend URL
- For production, update to your deployed frontend URL



