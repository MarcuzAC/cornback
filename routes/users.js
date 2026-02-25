const express = require('express');
const router = express.Router();
const User = require('../models/user');
const auth = require('../middleware/auth');

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('-password')
      .populate('scanHistory', 'diseaseName confidence timestamp imageUrl')
      .populate('chatHistory', 'messages createdAt');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, profileImage, preferences } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (profileImage) updateData.profileImage = profileImage;
    if (preferences) updateData.preferences = preferences;

    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('scanHistory')
      .populate('chatHistory');

    const stats = {
      totalScans: user.scanHistory.length,
      totalChats: user.chatHistory.length,
      recentScans: user.scanHistory.slice(-5),
      commonDiseases: {}
    };

    // Calculate common diseases
    user.scanHistory.forEach(scan => {
      const disease = scan.diseaseName;
      stats.commonDiseases[disease] = (stats.commonDiseases[disease] || 0) + 1;
    });

    res.json({ stats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;