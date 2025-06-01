const admin = require('firebase-admin');
const logger = require('../utils/logger');

const db = admin.firestore();

class QuickReplyAnalytics {
  constructor() {
    this.analyticsCollection = 'quick_reply_analytics';
  }

  // Track quick reply usage
  async trackQuickReplyUsage(userId, replyId, category, language, timestamp = new Date()) {
    try {
      await db.collection(this.analyticsCollection).add({
        userId: userId,
        replyId: replyId,
        category: category,
        language: language,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        date: timestamp.toISOString().split('T')[0], // YYYY-MM-DD format
        hour: timestamp.getHours()
      });
      
      logger.info(`Quick reply usage tracked: ${replyId} for user ${userId}`);
    } catch (error) {
      logger.error('Error tracking quick reply usage:', error);
    }
  }

  // Get most popular quick replies
  async getMostPopularQuickReplies(timeframe = 7, limit = 10) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - timeframe);
      
      const snapshot = await db.collection(this.analyticsCollection)
        .where('timestamp', '>=', cutoffDate)
        .get();
      
      const replyCount = {};
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const key = `${data.replyId}_${data.category}`;
        replyCount[key] = (replyCount[key] || 0) + 1;
      });
      
      return Object.entries(replyCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, limit)
        .map(([key, count]) => {
          const [replyId, category] = key.split('_');
          return { replyId, category, count };
        });
        
    } catch (error) {
      logger.error('Error getting popular quick replies:', error);
      return [];
    }
  }

  // Get user's preferred categories
  async getUserPreferences(userId, limit = 5) {
    try {
      const snapshot = await db.collection(this.analyticsCollection)
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();
      
      const categoryCount = {};
      
      snapshot.forEach(doc => {
        const data = doc.data();
        categoryCount[data.category] = (categoryCount[data.category] || 0) + 1;
      });
      
      return Object.entries(categoryCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, limit)
        .map(([category, count]) => ({ category, count }));
        
    } catch (error) {
      logger.error('Error getting user preferences:', error);
      return [];
    }
  }

  // Generate daily analytics report
  async getDailyAnalytics(date = new Date().toISOString().split('T')[0]) {
    try {
      const snapshot = await db.collection(this.analyticsCollection)
        .where('date', '==', date)
        .get();
      
      const analytics = {
        totalInteractions: 0,
        byCategory: {},
        byLanguage: {},
        byHour: {},
        uniqueUsers: new Set()
      };
      
      snapshot.forEach(doc => {
        const data = doc.data();
        analytics.totalInteractions++;
        analytics.byCategory[data.category] = (analytics.byCategory[data.category] || 0) + 1;
        analytics.byLanguage[data.language] = (analytics.byLanguage[data.language] || 0) + 1;
        analytics.byHour[data.hour] = (analytics.byHour[data.hour] || 0) + 1;
        analytics.uniqueUsers.add(data.userId);
      });
      
      analytics.uniqueUsers = analytics.uniqueUsers.size;
      
      return analytics;
      
    } catch (error) {
      logger.error('Error generating daily analytics:', error);
      return null;
    }
  }
}

module.exports = new QuickReplyAnalytics();