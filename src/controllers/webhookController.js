const whatsappService = require('../services/whatsappService');
const citizenService = require('../services/citizenService');
const openaiService = require('../services/openaiService');
const knowledgeBaseService = require('../services/knowledgeBaseService');
const languageDetector = require('../utils/languageDetector');
const quickReplyService = require('../services/quickReplyService');
const logger = require('../utils/logger');

// Verify webhook
const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      logger.info('Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      logger.warn('Webhook verification failed');
      res.sendStatus(403);
    }
  }
};

// Handle incoming webhook
const handleWebhook = async (req, res) => {
  try {
    // Return 200 OK early to acknowledge receipt
    res.status(200).send('OK');
    
    if (req.body.object === 'whatsapp_business_account') {
      if (req.body.entry && req.body.entry.length > 0) {
        const entry = req.body.entry[0];
        
        if (entry.changes && entry.changes.length > 0) {
          const change = entry.changes[0];
          
          if (change.value && change.value.messages && change.value.messages.length > 0) {
            await processMessage(change.value.messages[0], change.value.metadata, change.value.contacts);
          }
        }
      }
    }
  } catch (error) {
    logger.error('Error handling webhook:', error);
  }
};

// Enhanced message processing with intelligent quick reply management
const processMessage = async (message, metadata, contacts = []) => {
  const startTime = Date.now();
  
  try {
    const phoneNumberId = metadata.phone_number_id;
    const from = message.from;
    
    // Extract WhatsApp profile information
    const profileInfo = contacts && contacts.length > 0 ? {
      displayName: contacts[0].profile?.name || null,
      whatsappId: contacts[0].wa_id || from
    } : null;

    // Handle different message types including interactive responses
    let messageText = '';
    let messageType = message.type;
    let isQuickReply = false;
    
    switch (messageType) {
      case 'text':
        messageText = message.text.body;
        break;
        
      case 'interactive':
        const interactiveData = message.interactive;
        messageText = getInteractiveResponseText(interactiveData);
        isQuickReply = true;
        break;
        
      case 'button':
        messageText = message.button.text || message.button.payload;
        isQuickReply = true;
        break;
        
      default:
        const unsupportedMessage = profileInfo?.displayName 
          ? `Dear ${profileInfo.displayName}, I can only process text messages. Please send your query in text format. / प्रिय ${profileInfo.displayName}, मी फक्त मजकूर संदेश प्रक्रिया करू शकतो. कृपया आपला प्रश्न मजकूर स्वरूपात पाठवा.`
          : 'I can only process text messages. Please send your query in text format. / मी फक्त मजकूर संदेश प्रक्रिया करू शकतो. कृपया आपला प्रश्न मजकूर स्वरूपात पाठवा.';
        
        await whatsappService.sendMessage(phoneNumberId, from, unsupportedMessage);
        return;
    }

    if (!messageText) {
      logger.warn(`Empty message received from ${from}`);
      return;
    }

    // Process quick reply selection if applicable
    if (isQuickReply && message.interactive?.button_reply?.id) {
      const replyId = message.interactive.button_reply.id;
      const processedText = quickReplyService.processQuickReplySelection(replyId, 'en');
      if (processedText) {
        messageText = processedText;
      }
    }

    // Detect language with AI
    const messageLanguage = await languageDetector.detectLanguage(messageText);
    logger.info(`Detected language: ${messageLanguage} for message: ${messageText}`);

    // Get or create citizen record
    const citizenData = await citizenService.getOrCreateCitizen(from, profileInfo);
    
    // Enhanced message data with function calling context
    const messageData = {
      messageId: message.id,
      messageType: messageType,
      isQuickReply: isQuickReply,
      senderWhatsappId: profileInfo?.whatsappId,
      senderDisplayName: profileInfo?.displayName,
      receiverWhatsappId: process.env.PHONE_NUMBER_ID,
      receiverDisplayName: 'ZP Pune Assistant',
      processingTime: Date.now() - startTime,
      sessionId: `${from}_${new Date().getDate()}`,
      language: messageLanguage,
      timestamp: new Date().toISOString(),
      currentDateTime: '2025-06-01 12:17:51',
      currentUser: 'soft00null'
    };
    
    // Save user message
    await citizenService.saveChatMessage(from, 'user', messageText, messageLanguage, messageData);
    
    // Process based on registration status with smart quick replies
    if (!citizenData.isRegistered) {
      let registrationResult;
      
      logger.info(`User not registered. Processing with simplified Function Calling system (Name + Village only).`);
      
      // Process with simplified Function Calling (only name and village)
      registrationResult = await citizenService.processRegistrationWithFunctionCalling(
        from,
        messageText,
        messageLanguage,
        phoneNumberId,
        citizenData
      );
      
      // Send registration response
      if (registrationResult.response) {
        await whatsappService.sendMessage(phoneNumberId, from, registrationResult.response);
        
        // If registration is complete, send welcome quick replies (only once)
        if (registrationResult.registrationComplete) {
          const welcomeQuickReplies = quickReplyService.getWelcomeQuickReplies(messageLanguage);
          setTimeout(async () => {
            try {
              await whatsappService.sendInteractiveMessage(phoneNumberId, from, welcomeQuickReplies);
            } catch (error) {
              logger.error('Error sending welcome quick replies:', error);
            }
          }, 1000);
        }
        
        // Enhanced message data with function call results
        const botMessageData = { 
          ...messageData, 
          receiverWhatsappId: from, 
          senderWhatsappId: process.env.PHONE_NUMBER_ID,
          functionCallResults: registrationResult.functionCallResults,
          confidence: registrationResult.functionCallResults?.confidence || null
        };
        
        // Save bot response
        await citizenService.saveChatMessage(
          from, 
          'assistant', 
          registrationResult.response, 
          messageLanguage,
          botMessageData
        );
      }
      
      // Continue if registration complete
      if (!registrationResult.shouldContinue) {
        return;
      }
    }

    // Handle regular conversation for registered users with intelligent quick replies
    logger.info(`User registered. Processing regular conversation with Function Calling and Smart Quick Replies.`);
    
    // Get conversation history for context
    const chatHistory = await citizenService.getChatHistory(from, 8);
    const conversationHistory = chatHistory.map(chat => ({
      role: chat.role,
      content: chat.content
    }));

    // Search knowledge base with Function Calling if needed
    let relevantInfo = '';
    const knowledgeSearchResult = await citizenService.searchKnowledgeBaseWithFunctions(messageText, messageLanguage);
    
    if (knowledgeSearchResult) {
      // Use enhanced file search
      const fileSearchResult = await knowledgeBaseService.searchWithFileSearch(
        knowledgeSearchResult.query, 
        messageLanguage,
        {
          category: knowledgeSearchResult.category,
          maxResults: 3
        }
      );
      
      relevantInfo = fileSearchResult.response || '';
      logger.info(`Knowledge base search completed: ${fileSearchResult.method}, confidence: ${fileSearchResult.confidence}`);
    }
    
    // Generate AI response with Function Calling
    const aiResponse = await openaiService.generateResponseWithFunctions(
      messageText,
      conversationHistory,
      messageLanguage,
      relevantInfo,
      citizenData,
      {
        knowledgeSearchResult,
        userState: 'registered',
        sessionInfo: {
          sessionId: messageData.sessionId,
          messageCount: chatHistory.length
        },
        currentDateTime: '2025-06-01 12:17:51',
        currentUser: 'soft00null'
      }
    );
    
    // Send main response
    await whatsappService.sendMessage(phoneNumberId, from, aiResponse);
    
    // Send ONLY the most relevant quick replies (avoid duplicates)
    await sendOptimalQuickReplies(phoneNumberId, from, messageText, aiResponse, messageLanguage, chatHistory, isQuickReply);
    
    // Enhanced bot response data
    const botResponseData = {
      ...messageData,
      receiverWhatsappId: profileInfo?.whatsappId,
      receiverDisplayName: profileInfo?.displayName,
      senderWhatsappId: process.env.PHONE_NUMBER_ID,
      senderDisplayName: 'ZP Pune Assistant',
      knowledgeSearchUsed: !!relevantInfo,
      functionCallingUsed: true,
      knowledgeSearchResult: knowledgeSearchResult,
      quickRepliesSent: true
    };
    
    // Save bot response
    await citizenService.saveChatMessage(
      from, 
      'assistant', 
      aiResponse, 
      messageLanguage,
      botResponseData
    );
    
  } catch (error) {
    logger.error('Error processing message:', error);
    
    // Send enhanced fallback message with basic quick replies
    try {
      const fallbackMessage = generateFallbackMessage(error, profileInfo?.displayName);
      await whatsappService.sendMessage(
        metadata.phone_number_id,
        message.from,
        fallbackMessage
      );
      
      // Send basic quick replies only on error (single set)
      const basicQuickReplies = quickReplyService.getWelcomeQuickReplies('en');
      setTimeout(async () => {
        try {
          await whatsappService.sendInteractiveMessage(metadata.phone_number_id, message.from, basicQuickReplies);
        } catch (quickReplyError) {
          logger.error('Error sending fallback quick replies:', quickReplyError);
        }
      }, 1000);
      
    } catch (sendError) {
      logger.error('Failed to send fallback message:', sendError);
    }
  }
};

// Send optimal quick replies - only the most relevant one
const sendOptimalQuickReplies = async (phoneNumberId, from, userMessage, botResponse, language, chatHistory, isQuickReply) => {
  try {
    // Don't send quick replies if the user just used one (avoid loops)
    if (isQuickReply) {
      logger.info('User just used quick reply, skipping additional quick replies to avoid loops');
      return;
    }

    // Determine the best quick reply strategy
    const quickReplyStrategy = determineQuickReplyStrategy(userMessage, botResponse, chatHistory);
    
    let quickReplies = null;
    
    switch (quickReplyStrategy.type) {
      case 'contextual':
        quickReplies = quickReplyService.generateContextualQuickReplies(userMessage, language, chatHistory);
        break;
        
      case 'followup':
        quickReplies = quickReplyService.generateFollowUpSuggestions(botResponse, language);
        break;
        
      case 'smart':
        quickReplies = quickReplyService.getSmartSuggestions(chatHistory, language);
        break;
        
      case 'general':
        quickReplies = quickReplyService.getGeneralQuickReplies(language);
        break;
        
      case 'none':
      default:
        logger.info('No quick replies needed for this interaction');
        return;
    }
    
    if (quickReplies) {
      // Single delay to ensure main message is delivered first
      setTimeout(async () => {
        try {
          await whatsappService.sendInteractiveMessage(phoneNumberId, from, quickReplies);
          logger.info(`Sent ${quickReplyStrategy.type} quick replies to ${from}`);
        } catch (error) {
          logger.error('Error sending optimal quick replies:', error);
        }
      }, 1200); // Slightly longer delay to ensure proper message order
    }
    
  } catch (error) {
    logger.error('Error in sendOptimalQuickReplies:', error);
  }
};

// Determine the best quick reply strategy based on context
const determineQuickReplyStrategy = (userMessage, botResponse, chatHistory) => {
  try {
    const userText = userMessage.toLowerCase();
    const botText = botResponse.toLowerCase();
    
    // Don't send quick replies for greetings if we already have conversation history
    if (chatHistory.length > 4 && (userText.includes('hello') || userText.includes('hi') || userText.includes('नमस्कार'))) {
      return { type: 'none', reason: 'greeting_with_history' };
    }
    
    // Don't send quick replies for thank you messages
    if (userText.includes('thank') || userText.includes('धन्यवाद') || userText.includes('thanks')) {
      return { type: 'none', reason: 'thankyou_message' };
    }
    
    // Don't send quick replies if the bot response is asking for specific information
    if (botText.includes('please provide') || botText.includes('कृपया द्या') || 
        botText.includes('what is your') || botText.includes('तुमचे काय आहे')) {
      return { type: 'none', reason: 'bot_requesting_info' };
    }
    
    // Send contextual replies for new category queries
    const detectedCategory = quickReplyService.detectCategory(userMessage);
    if (detectedCategory) {
      return { type: 'contextual', reason: 'category_detected', category: detectedCategory };
    }
    
    // Send follow-up suggestions if bot response mentions documents or processes
    if (botText.includes('document') || botText.includes('कागदपत्र') || 
        botText.includes('application') || botText.includes('अर्ज') ||
        botText.includes('process') || botText.includes('प्रक्रिया')) {
      return { type: 'followup', reason: 'process_mentioned' };
    }
    
    // Send smart suggestions for users with interaction history
    if (chatHistory.length >= 3) {
      return { type: 'smart', reason: 'user_has_history' };
    }
    
    // Send general quick replies for new users or unclear queries
    if (chatHistory.length <= 2) {
      return { type: 'general', reason: 'new_user' };
    }
    
    // Default: no quick replies needed
    return { type: 'none', reason: 'no_clear_strategy' };
    
  } catch (error) {
    logger.error('Error determining quick reply strategy:', error);
    return { type: 'general', reason: 'error_fallback' };
  }
};

// Extract text from interactive response
const getInteractiveResponseText = (interactiveData) => {
  if (interactiveData.type === 'button_reply') {
    return interactiveData.button_reply.title;
  } else if (interactiveData.type === 'list_reply') {
    return interactiveData.list_reply.title;
  }
  return '';
};

// Generate contextual fallback message
const generateFallbackMessage = (error, userName) => {
  const name = userName ? ` ${userName}` : '';
  
  if (error.message?.includes('rate limit')) {
    return `🙏 Dear${name}, I'm currently experiencing high traffic. Please try again in a few minutes. / प्रिय${name}, सध्या जास्त गर्दी आहे. कृपया काही मिनिटांनी पुन्हा प्रयत्न करा.`;
  }
  
  if (error.message?.includes('network') || error.message?.includes('timeout')) {
    return `🔌 Dear${name}, I'm experiencing network issues. Please try again shortly. / प्रिय${name}, नेटवर्क समस्या आहे. कृपया लवकरच पुन्हा प्रयत्न करा.`;
  }
  
  return `🤖 Dear${name}, I encountered a technical issue. Please try rephrasing your question or contact our support. / प्रिय${name}, तांत्रिक समस्या आली. कृपया आपला प्रश्न वेगळ्या पद्धतीने विचारा किंवा आमच्या सहाय्य टीमशी संपर्क साधा.`;
};

module.exports = {
  verifyWebhook,
  handleWebhook
};