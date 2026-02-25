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

// ✅ Correct pre-save middleware
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);