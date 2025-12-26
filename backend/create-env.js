/**
 * Script to generate .env file with a random JWT_SECRET
 * Run: node create-env.js
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// Generate a random JWT secret
const jwtSecret = crypto.randomBytes(32).toString('base64');

// .env file content
const envContent = `PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/e2ee-email?retryWrites=true&w=majority
JWT_SECRET=${jwtSecret}
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
`;

const envPath = path.join(__dirname, '.env');

// Check if .env already exists
if (fs.existsSync(envPath)) {
  console.log('⚠️  .env file already exists!');
  console.log('   Delete it first if you want to regenerate.');
  process.exit(1);
}

// Write .env file
fs.writeFileSync(envPath, envContent);

console.log('✅ .env file created successfully!');
console.log('');
console.log('📝 Next steps:');
console.log('   1. Update MONGODB_URI with your MongoDB Atlas connection string');
console.log('   2. JWT_SECRET has been auto-generated:', jwtSecret.substring(0, 20) + '...');
console.log('   3. Other values are set to defaults (you can change if needed)');
console.log('');
console.log('🔒 Security: Make sure .env is in .gitignore (it should be)');




