const mongoose = require('mongoose');

const scanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  imagePath: {
    type: String,
    required: true
  },
  diseaseName: {
    type: String,
    required: true
  },
  confidence: {
    type: Number,
    required: true
  },
  prediction: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  notes: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Scan', scanSchema);