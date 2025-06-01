const axios = require('axios');
const logger = require('../utils/logger');
const admin = require('firebase-admin');

// Initialize Firestore
const db = admin.firestore();

// WhatsApp API client
const whatsappClient = axios.create({
  baseURL: 'https://graph.facebook.com/v18.0',
  headers: {
    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Rate limiting configuration
const rateLimitConfig = {
  text: { limit: 80, window: 60000 }, // 80 messages per minute
  interactive: { limit: 20, window: 60000 }, // 20 interactive messages per minute
  template: { limit: 10, window: 60000 } // 10 template messages per minute
};

// Rate limiting cache
const rateLimitCache = new Map();

// Enhanced interactive message sending with validation
const sendInteractiveMessage = async (phoneNumberId, recipientNumber, interactiveData, options = {}) => {
  try {
    const startTime = Date.now();
    
    // Check rate limit for interactive messages
    if (!await checkRateLimit('interactive')) {
      logger.warn(`Interactive message rate limit exceeded for ${recipientNumber}`);
      throw new Error('Interactive message rate limit exceeded');
    }
    
    // Validate interactive data
    if (!validateInteractiveData(interactiveData)) {
      throw new Error('Invalid interactive message data');
    }
    
    const cleanRecipient = cleanPhoneNumber(recipientNumber);
    
    const messagePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanRecipient,
      type: 'interactive',
      interactive: {
        ...interactiveData,
        // Add metadata
        ...options.metadata && { metadata: options.metadata }
      }
    };
    
    // Add context if provided
    if (options.context) {
      messagePayload.context = {
        message_id: options.context.messageId
      };
    }
    
    const response = await whatsappClient.post(`/${phoneNumberId}/messages`, messagePayload);
    const endTime = Date.now();
    
    const messageResult = {
      messageId: response.data.messages?.[0]?.id,
      status: 'sent',
      type: 'interactive',
      interactiveType: interactiveData.type
    };
    
    // Log interactive message
    await logMessageSent(recipientNumber, JSON.stringify(interactiveData).length, 'outgoing', {
      messageResult,
      processingTime: endTime - startTime,
      interactiveType: interactiveData.type,
      options
    });
    
    logger.info(`Interactive message sent successfully to ${recipientNumber}`);
    return {
      success: true,
      messageResult,
      processingTime: endTime - startTime
    };
    
  } catch (error) {
    await logMessageError(recipientNumber, error.message || 'Unknown error', {
      messageType: 'interactive',
      errorCode: error.response?.data?.error?.code,
      errorType: error.response?.data?.error?.type
    });
    
    logger.error('Error sending interactive message:', error.response?.data || error.message);
    throw new Error(`Failed to send interactive message: ${error.message}`);
  }
};

// Enhanced text message sending
const sendMessage = async (phoneNumberId, recipientNumber, message, options = {}) => {
  try {
    const startTime = Date.now();
    
    // Check rate limit
    if (!await checkRateLimit('text')) {
      logger.warn(`Rate limit exceeded, message not sent to ${recipientNumber}`);
      throw new Error('Rate limit exceeded');
    }
    
    // Validate inputs
    if (!phoneNumberId || !recipientNumber || !message) {
      throw new Error('Missing required parameters for sending message');
    }
    
    // Clean and validate phone number
    const cleanRecipient = cleanPhoneNumber(recipientNumber);
    
    // Split long messages if needed
    const messages = splitLongMessage(message);
    const messageResults = [];
    
    // Send each part with appropriate delay
    for (let i = 0; i < messages.length; i++) {
      const messagePart = messages[i];
      
      const messagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanRecipient,
        type: 'text',
        text: {
          preview_url: options.previewUrl || false,
          body: messagePart
        }
      };
      
      // Add context if provided
      if (options.context && i === 0) {
        messagePayload.context = {
          message_id: options.context.messageId
        };
      }
      
      const response = await whatsappClient.post(`/${phoneNumberId}/messages`, messagePayload);
      
      messageResults.push({
        messageId: response.data.messages?.[0]?.id,
        status: 'sent',
        part: i + 1,
        totalParts: messages.length
      });
      
      // Small delay between parts to maintain order
      if (messages.length > 1 && i < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    const endTime = Date.now();
    
    // Log successful message delivery
    await logMessageSent(recipientNumber, message.length, 'outgoing', {
      messageResults,
      processingTime: endTime - startTime,
      parts: messages.length,
      options
    });
    
    logger.info(`Message sent successfully to ${recipientNumber} (${messages.length} parts)`);
    return {
      success: true,
      messageResults,
      totalParts: messages.length,
      processingTime: endTime - startTime
    };
    
  } catch (error) {
    // Log failed message attempt with detailed error info
    await logMessageError(recipientNumber, error.message || 'Unknown error', {
      errorCode: error.response?.data?.error?.code,
      errorType: error.response?.data?.error?.type,
      errorDetails: error.response?.data?.error?.error_data
    });
    
    logger.error('Error sending WhatsApp message:', error.response?.data || error.message);
    throw new Error(`Failed to send WhatsApp message: ${error.message}`);
  }
};

// Send quick reply list message
const sendQuickReplyList = async (phoneNumberId, recipientNumber, listData, options = {}) => {
  try {
    const interactiveData = {
      type: 'list',
      header: listData.header ? {
        type: 'text',
        text: listData.header
      } : undefined,
      body: {
        text: listData.body
      },
      footer: listData.footer ? {
        text: listData.footer
      } : undefined,
      action: {
        button: listData.buttonText || 'Select Option',
        sections: listData.sections
      }
    };
    
    return await sendInteractiveMessage(phoneNumberId, recipientNumber, interactiveData, options);
    
  } catch (error) {
    logger.error('Error sending quick reply list:', error);
    throw error;
  }
};

// Send quick reply buttons
const sendQuickReplyButtons = async (phoneNumberId, recipientNumber, buttonData, options = {}) => {
  try {
    const interactiveData = {
      type: 'button',
      header: buttonData.header ? {
        type: 'text',
        text: buttonData.header
      } : undefined,
      body: {
        text: buttonData.body
      },
      footer: buttonData.footer ? {
        text: buttonData.footer
      } : undefined,
      action: {
        buttons: buttonData.buttons
      }
    };
    
    return await sendInteractiveMessage(phoneNumberId, recipientNumber, interactiveData, options);
    
  } catch (error) {
    logger.error('Error sending quick reply buttons:', error);
    throw error;
  }
};

// Rate limiting check
const checkRateLimit = async (messageType) => {
  try {
    const config = rateLimitConfig[messageType];
    if (!config) return true;
    
    const now = Date.now();
    const windowStart = now - config.window;
    const key = `${messageType}_${Math.floor(now / config.window)}`;
    
    let count = rateLimitCache.get(key) || 0;
    
    if (count >= config.limit) {
      return false;
    }
    
    rateLimitCache.set(key, count + 1);
    
    // Clean old entries
    for (const [cacheKey] of rateLimitCache) {
      if (cacheKey.split('_')[1] < Math.floor(windowStart / config.window)) {
        rateLimitCache.delete(cacheKey);
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Error checking rate limit:', error);
    return true; // Allow on error
  }
};

// Validate interactive message data
const validateInteractiveData = (data) => {
  if (!data || !data.type) return false;
  
  switch (data.type) {
    case 'button':
      return data.body && data.action && data.action.buttons && Array.isArray(data.action.buttons) && data.action.buttons.length <= 3;
    case 'list':
      return data.body && data.action && data.action.sections && Array.isArray(data.action.sections);
    default:
      return false;
  }
};

// Clean phone number
const cleanPhoneNumber = (phoneNumber) => {
  return phoneNumber.replace(/[^\d]/g, '');
};

// Split long messages
const splitLongMessage = (message, maxLength = 4096) => {
  if (message.length <= maxLength) {
    return [message];
  }
  
  const messages = [];
  let currentMessage = '';
  const words = message.split(' ');
  
  for (const word of words) {
    if ((currentMessage + ' ' + word).length <= maxLength) {
      currentMessage += (currentMessage ? ' ' : '') + word;
    } else {
      if (currentMessage) {
        messages.push(currentMessage);
        currentMessage = word;
      } else {
        // Word itself is too long, split it
        messages.push(word.substring(0, maxLength));
        currentMessage = word.substring(maxLength);
      }
    }
  }
  
  if (currentMessage) {
    messages.push(currentMessage);
  }
  
  return messages;
};

// Log message sent
const logMessageSent = async (recipient, messageLength, direction, metadata = {}) => {
  try {
    await db.collection('message_logs').add({
      recipient: cleanPhoneNumber(recipient),
      messageLength,
      direction,
      status: 'sent',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata
    });
  } catch (error) {
    logger.error('Error logging message:', error);
  }
};

// Log message error
const logMessageError = async (recipient, errorMessage, metadata = {}) => {
  try {
    await db.collection('message_logs').add({
      recipient: cleanPhoneNumber(recipient),
      direction: 'outgoing',
      status: 'failed',
      errorMessage,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata
    });
  } catch (error) {
    logger.error('Error logging message error:', error);
  }
};

// Get WhatsApp profile information
const getWhatsAppProfile = async (phoneNumberId, userNumber) => {
  try {
    const cacheKey = `profile_${userNumber}`;
    const cached = await getCachedData(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const response = await whatsappClient.get(`/${phoneNumberId}?fields=name,profile_picture_url`);
    const profileData = response.data;
    
    await setCachedData(cacheKey, profileData);
    
    return profileData;
  } catch (error) {
    logger.error('Error fetching WhatsApp profile:', error.response?.data || error.message);
    return null;
  }
};

// Cache management
const getCachedData = async (key) => {
  try {
    const doc = await db.collection('cache').doc(key).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.expiresAt > Date.now()) {
        return data.value;
      } else {
        await doc.ref.delete();
      }
    }
    return null;
  } catch (error) {
    logger.error('Error getting cached data:', error);
    return null;
  }
};

const setCachedData = async (key, value, ttl = 3600000) => {
  try {
    await db.collection('cache').doc(key).set({
      value,
      expiresAt: Date.now() + ttl,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    logger.error('Error setting cached data:', error);
  }
};

module.exports = {
  sendMessage,
  sendInteractiveMessage,
  sendQuickReplyList,
  sendQuickReplyButtons,
  getWhatsAppProfile,
  cleanPhoneNumber,
  splitLongMessage
};