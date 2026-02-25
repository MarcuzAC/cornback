const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const User = require('../models/user');
const auth = require('../middleware/auth');

// Save a new chat message
router.post('/', auth, async (req, res) => {
  try {
    const { message, response } = req.body;

    if (!message || !response) {
      return res.status(400).json({ message: 'Message and response are required' });
    }

    // Find or create chat session for user
    let chat = await Chat.findOne({ 
      userId: req.userId,
      // You might want to add session tracking here
    });

    if (!chat) {
      // Create new chat session
      chat = new Chat({
        userId: req.userId,
        messages: []
      });
    }

    // Add user message
    chat.messages.push({
      text: message,
      isUser: true,
      timestamp: new Date()
    });

    // Add AI response
    chat.messages.push({
      text: response,
      isUser: false,
      timestamp: new Date()
    });

    await chat.save();

    // Add chat to user's history if not already there
    await User.findByIdAndUpdate(req.userId, {
      $addToSet: { chatHistory: chat._id }
    });

    res.status(201).json({ 
      success: true,
      chat: {
        _id: chat._id,
        messages: chat.messages.slice(-2) // Return only the last two messages
      }
    });
  } catch (error) {
    console.error('Error saving chat:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all chats for a user
router.get('/user', auth, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(20);

    // Format chats for response
    const formattedChats = chats.map(chat => ({
      _id: chat._id,
      messages: chat.messages,
      createdAt: chat.createdAt,
      messageCount: chat.messages.length,
      lastMessage: chat.messages.length > 0 
        ? chat.messages[chat.messages.length - 1] 
        : null
    }));

    res.json({ 
      success: true,
      chats: formattedChats 
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific chat by ID
router.get('/:chatId', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      userId: req.userId
    });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    res.json({ 
      success: true,
      chat: {
        _id: chat._id,
        messages: chat.messages,
        createdAt: chat.createdAt
      }
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get recent chat messages (for quick preview)
router.get('/recent/preview', auth, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('messages createdAt');

    const previews = chats.map(chat => {
      const lastMessage = chat.messages.length > 0 
        ? chat.messages[chat.messages.length - 1] 
        : null;
      
      return {
        chatId: chat._id,
        lastMessage: lastMessage ? {
          text: lastMessage.text.length > 50 
            ? lastMessage.text.substring(0, 50) + '...' 
            : lastMessage.text,
          timestamp: lastMessage.timestamp,
          isUser: lastMessage.isUser
        } : null,
        createdAt: chat.createdAt,
        messageCount: chat.messages.length
      };
    });

    res.json({ 
      success: true,
      recentChats: previews 
    });
  } catch (error) {
    console.error('Error fetching chat previews:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get chat statistics for a user
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.userId });
    
    let totalMessages = 0;
    let totalChats = chats.length;
    let commonQuestions = {};
    let dailyActivity = {};

    chats.forEach(chat => {
      totalMessages += chat.messages.length;
      
      // Track daily activity
      const date = chat.createdAt.toISOString().split('T')[0];
      dailyActivity[date] = (dailyActivity[date] || 0) + 1;

      // Track common questions (user messages)
      chat.messages.forEach(msg => {
        if (msg.isUser) {
          // Simple keyword extraction
          const words = msg.text.toLowerCase().split(' ');
          words.forEach(word => {
            if (word.length > 3) { // Ignore short words
              commonQuestions[word] = (commonQuestions[word] || 0) + 1;
            }
          });
        }
      });
    });

    // Get top 10 common keywords
    const topKeywords = Object.entries(commonQuestions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    res.json({
      success: true,
      stats: {
        totalChats,
        totalMessages,
        averageMessagesPerChat: totalChats > 0 
          ? (totalMessages / totalChats).toFixed(1) 
          : 0,
        topKeywords,
        dailyActivity: Object.entries(dailyActivity)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 7) // Last 7 days
      }
    });
  } catch (error) {
    console.error('Error fetching chat stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search within user's chats
router.get('/search/:query', auth, async (req, res) => {
  try {
    const searchQuery = req.params.query.toLowerCase();
    const chats = await Chat.find({ userId: req.userId });

    const results = [];

    chats.forEach(chat => {
      const matchingMessages = chat.messages.filter(msg => 
        msg.text.toLowerCase().includes(searchQuery)
      );

      if (matchingMessages.length > 0) {
        results.push({
          chatId: chat._id,
          createdAt: chat.createdAt,
          matches: matchingMessages.map(msg => ({
            text: msg.text.length > 100 
              ? msg.text.substring(0, 100) + '...' 
              : msg.text,
            timestamp: msg.timestamp,
            isUser: msg.isUser
          }))
        });
      }
    });

    res.json({
      success: true,
      query: searchQuery,
      results: results.slice(0, 10) // Limit to 10 results
    });
  } catch (error) {
    console.error('Error searching chats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a specific chat
router.delete('/:chatId', auth, async (req, res) => {
  try {
    const chat = await Chat.findOneAndDelete({
      _id: req.params.chatId,
      userId: req.userId
    });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Remove chat from user's history
    await User.findByIdAndUpdate(req.userId, {
      $pull: { chatHistory: req.params.chatId }
    });

    res.json({ 
      success: true, 
      message: 'Chat deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Clear all chats for a user
router.delete('/clear/all', auth, async (req, res) => {
  try {
    await Chat.deleteMany({ userId: req.userId });

    // Clear chat history from user
    await User.findByIdAndUpdate(req.userId, {
      $set: { chatHistory: [] }
    });

    res.json({ 
      success: true, 
      message: 'All chats cleared successfully' 
    });
  } catch (error) {
    console.error('Error clearing chats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Export chat history
router.get('/export/all', auth, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.userId })
      .sort({ createdAt: 1 });

    const exportData = {
      userId: req.userId,
      exportDate: new Date().toISOString(),
      totalChats: chats.length,
      chats: chats.map(chat => ({
        chatId: chat._id,
        startedAt: chat.createdAt,
        messages: chat.messages.map(msg => ({
          text: msg.text,
          isUser: msg.isUser,
          timestamp: msg.timestamp
        }))
      }))
    };

    res.json({
      success: true,
      exportData
    });
  } catch (error) {
    console.error('Error exporting chats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get chat topics/categories
router.get('/topics/categories', auth, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.userId });
    
    const categories = {
      disease: 0,
      treatment: 0,
      prevention: 0,
      fertilizer: 0,
      irrigation: 0,
      pest: 0,
      general: 0
    };

    const keywords = {
      disease: ['blight', 'rust', 'spot', 'rot', 'mildew', 'fungus', 'infection'],
      treatment: ['treatment', 'cure', 'fungicide', 'pesticide', 'spray', 'apply'],
      prevention: ['prevent', 'avoid', 'protect', 'resistant', 'rotation'],
      fertilizer: ['fertilizer', 'nitrogen', 'phosphorus', 'potassium', 'npk', 'nutrient'],
      irrigation: ['water', 'irrigation', 'moisture', 'drought', 'rain'],
      pest: ['pest', 'insect', 'bug', 'worm', 'caterpillar', 'beetle']
    };

    chats.forEach(chat => {
      chat.messages.forEach(msg => {
        if (msg.isUser) {
          const text = msg.text.toLowerCase();
          let categorized = false;

          Object.entries(keywords).forEach(([category, words]) => {
            if (words.some(word => text.includes(word))) {
              categories[category] = (categories[category] || 0) + 1;
              categorized = true;
            }
          });

          if (!categorized) {
            categories.general++;
          }
        }
      });
    });

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Error getting chat categories:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;