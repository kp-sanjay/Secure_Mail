const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const argon2 = require('argon2');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  /** ISRO-style centre / department (display + access context) */
  department: {
    type: String,
    enum: ['SAC', 'URSC', 'VSSC', 'LPSC', 'IIRS', 'NRSC', 'ISAC', 'MCC', 'OTHER'],
    default: 'SAC',
  },
  jobRole: {
    type: String,
    default: 'Analyst',
    trim: true,
    maxlength: 80,
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // Don't return password by default
  },
  passwordHashMethod: {
    type: String,
    enum: ['bcrypt', 'argon2'],
    default: 'argon2', // Use Argon2 by default for new users
  },
  publicKey: {
    type: String,
    default: null,
  },
  eccPublicKey: {
    type: String,
    default: null,
  },
  ecdsaPublicKey: {
    type: String,
    default: null,
  },
  // ML-KEM (Kyber) public key for post-quantum key establishment (Level 4)
  mlkemPublicKey: {
    type: String,
    default: null,
  },
  // Declared cryptographic capabilities for negotiation / UI
  keyCapabilities: {
    type: [String],
    default: [],
  },
  keyUpdatedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
    default: null,
  },
  loginLocation: {
    type: String,
    default: null,
  },
});

// Hash password before saving (supports both bcrypt and Argon2)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  // Use Argon2 by default, or bcrypt if specified
  if (this.passwordHashMethod === 'bcrypt' || !this.passwordHashMethod) {
    // For existing users or explicit bcrypt
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordHashMethod = 'bcrypt';
  } else {
    // Use Argon2 (more secure)
    try {
      this.password = await argon2.hash(this.password, {
        type: argon2.argon2id,
        memoryCost: 65536, // 64 MB
        timeCost: 3,
        parallelism: 4,
      });
      this.passwordHashMethod = 'argon2';
    } catch (error) {
      // Fallback to bcrypt if Argon2 fails
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
      this.passwordHashMethod = 'bcrypt';
    }
  }
  next();
});

// Method to compare password (supports both methods)
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (this.passwordHashMethod === 'argon2') {
    try {
      return await argon2.verify(this.password, enteredPassword);
    } catch (error) {
      return false;
    }
  } else {
    // Default to bcrypt for backward compatibility
    return await bcrypt.compare(enteredPassword, this.password);
  }
};

module.exports = mongoose.model('User', userSchema);

