const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  profileImage: {
    type: String
  },
  scanHistory: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scan'
  }],
  chatHistory: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat'
  }],
  preferences: {
    notifications: { type: Boolean, default: true },
    language: { type: String, default: 'en' },
    darkMode: { type: Boolean, default: false }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving - FIXED VERSION
userSchema.pre('save', async function(next) {
  try {
    // Only hash if password is modified or new
    if (!this.isModified('password')) {
      return next();
    }
    
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

module.exports = mongoose.model('User', userSchema);