const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Scan = require('../models/Scan');
const User = require('../models/user');
const auth = require('../middleware/auth');

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'scan-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function(req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

// Save scan
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { diseaseName, confidence, prediction, notes } = req.body;
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    const scan = new Scan({
      userId: req.userId,
      imageUrl,
      imagePath: req.file.path,
      diseaseName,
      confidence: parseFloat(confidence),
      prediction: JSON.parse(prediction),
      notes
    });

    await scan.save();

    // Add scan to user's history
    await User.findByIdAndUpdate(req.userId, {
      $push: { scanHistory: scan._id }
    });

    res.status(201).json({ scan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user scans
router.get('/user', auth, async (req, res) => {
  try {
    const scans = await Scan.find({ userId: req.userId })
      .sort({ timestamp: -1 })
      .limit(50);
    
    res.json({ scans });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single scan
router.get('/:id', auth, async (req, res) => {
  try {
    const scan = await Scan.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!scan) {
      return res.status(404).json({ message: 'Scan not found' });
    }

    res.json({ scan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;