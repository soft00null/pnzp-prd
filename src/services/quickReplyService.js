const logger = require('../utils/logger');

class QuickReplyService {
  constructor() {
    this.categoryQuestions = {
      'education': {
        en: [
          'How to get school admission?',
          'School scholarship schemes',
          'Mid-day meal program info',
          'Teacher transfer process'
        ],
        mr: [
          'शाळेत प्रवेश कसा घ्यावा?',
          'शिष्यवृत्ती योजना',
          'मध्यान्ह भोजन योजना माहिती',
          'शिक्षक बदली प्रक्रिया'
        ]
      },
      'health': {
        en: [
          'Vaccination schedule',
          'Primary health centers',
          'Maternal health services',
          'Health insurance schemes'
        ],
        mr: [
          'लसीकरण वेळापत्रक',
          'प्राथमिक आरोग्य केंद्रे',
          'मातृत्व आरोग्य सेवा',
          'आरोग्य विमा योजना'
        ]
      },
      'housing': {
        en: [
          'PM Awas Yojana application',
          'Housing scheme eligibility',
          'Construction subsidy info',
          'Housing loan details'
        ],
        mr: [
          'पीएम आवास योजना अर्ज',
          'गृहनिर्माण योजना पात्रता',
          'बांधकाम अनुदान माहिती',
          'घर कर्ज तपशील'
        ]
      },
      'employment': {
        en: [
          'MGNREGA job card',
          'Skill development programs',
          'Employment opportunities',
          'Self-employment schemes'
        ],
        mr: [
          'मनरेगा जॉब कार्ड',
          'कौशल्य विकास कार्यक्रम',
          'रोजगार संधी',
          'स्वयंरोजगार योजना'
        ]
      },
      'agriculture': {
        en: [
          'Crop insurance scheme',
          'Kisan credit card',
          'Agricultural subsidies',
          'Farmer training programs'
        ],
        mr: [
          'पीक विमा योजना',
          'किसान क्रेडिट कार्ड',
          'कृषी अनुदान',
          'शेतकरी प्रशिक्षण कार्यक्रम'
        ]
      },
      'welfare': {
        en: [
          'Pension schemes',
          'Scholarship programs',
          'Widow assistance',
          'Disability benefits'
        ],
        mr: [
          'पेन्शन योजना',
          'शिष्यवृत्ती कार्यक्रम',
          'विधवा सहाय्य',
          'अपंगत्व लाभ'
        ]
      },
      'certificates': {
        en: [
          'Birth certificate',
          'Death certificate',
          'Marriage registration',
          'Caste certificate'
        ],
        mr: [
          'जन्म दाखला',
          'मृत्यू दाखला',
          'विवाह नोंदणी',
          'जात दाखला'
        ]
      }
    };

    this.followUpSuggestions = {
      'document_required': {
        en: ['Required documents list', 'Application process', 'Processing time'],
        mr: ['आवश्यक कागदपत्रे', 'अर्ज प्रक्रिया', 'प्रक्रिया वेळ']
      },
      'scheme_info': {
        en: ['Eligibility criteria', 'How to apply', 'Benefits details'],
        mr: ['पात्रता निकष', 'अर्ज कसा करावा', 'लाभ तपशील']
      },
      'contact_info': {
        en: ['Office hours', 'Phone numbers', 'Online services'],
        mr: ['कार्यालयीन वेळा', 'फोन नंबर', 'ऑनलाइन सेवा']
      }
    };

    this.welcomeQuickReplies = {
      en: [
        '🏛️ ZP Services Overview',
        '📋 Apply for Certificate',
        '💰 Government Schemes'
      ],
      mr: [
        '🏛️ जिप सेवा माहिती',
        '📋 दाखला मिळवा',
        '💰 सरकारी योजना'
      ]
    };

    this.generalQuickReplies = {
      en: [
        '🏛️ Gov Schemes',
        '📋 Certificates',
        '📞 Contact Info'
      ],
      mr: [
        '🏛️ सरकारी योजना',
        '📋 दाखले',
        '📞 संपर्क माहिती'
      ]
    };
  }

  // Generate quick replies based on message context with improved logic
  generateContextualQuickReplies(messageText, language = 'en', userHistory = []) {
    try {
      const detectedCategory = this.detectCategory(messageText);
      
      if (detectedCategory) {
        const categoryQuickReplies = this.getCategoryQuickReplies(detectedCategory, language);
        
        // Only return if we have relevant questions for this category
        if (categoryQuickReplies && categoryQuickReplies.action.buttons.length > 0) {
          return categoryQuickReplies;
        }
      }
      
      // Fallback to general quick replies
      return this.getGeneralQuickReplies(language);
      
    } catch (error) {
      logger.error('Error generating contextual quick replies:', error);
      return this.getGeneralQuickReplies(language);
    }
  }

  // Detect category from user message with improved keywords
  detectCategory(messageText) {
    const text = messageText.toLowerCase();
    
    // Enhanced category keywords mapping
    const categoryKeywords = {
      'education': [
        'school', 'शाळा', 'education', 'शिक्षण', 'admission', 'प्रवेश', 
        'scholarship', 'शिष्यवृत्ती', 'teacher', 'शिक्षक', 'student', 'विद्यार्थी',
        'मिड डे मील', 'mid day meal', 'uniform', 'गणवेश'
      ],
      'health': [
        'health', 'आरोग्य', 'hospital', 'रुग्णालय', 'doctor', 'डॉक्टर', 
        'medicine', 'औषध', 'vaccination', 'लसीकरण', 'pregnancy', 'गर्भावस्था',
        'phc', 'प्राथमिक आरोग्य केंद्र'
      ],
      'housing': [
        'house', 'घर', 'housing', 'आवास', 'awas', 'home', 'construction', 'बांधकाम',
        'pmay', 'प्रधानमंत्री आवास', 'toilet', 'शौचालय', 'subsidy', 'अनुदान'
      ],
      'employment': [
        'job', 'नोकरी', 'employment', 'रोजगार', 'mgnrega', 'मनरेगा', 'work', 'काम',
        'skill', 'कौशल्य', 'training', 'प्रशिक्षण', 'unemployment', 'बेरोजगारी'
      ],
      'agriculture': [
        'farm', 'शेत', 'agriculture', 'कृषी', 'crop', 'पीक', 'farmer', 'शेतकरी',
        'kisan', 'किसान', 'fertilizer', 'खत', 'insurance', 'विमा', 'subsidy', 'अनुदान'
      ],
      'welfare': [
        'pension', 'पेन्शन', 'welfare', 'कल्याण', 'widow', 'विधवा', 
        'disability', 'अपंगत्व', 'elderly', 'वृद्ध', 'social', 'सामाजिक'
      ],
      'certificates': [
        'certificate', 'दाखला', 'birth', 'जन्म', 'death', 'मृत्यू', 
        'marriage', 'विवाह', 'caste', 'जात', 'income', 'उत्पन्न', 'domicile', 'अधिवास'
      ]
    };

    // Find the category with the highest keyword match score
    let bestCategory = null;
    let maxScore = 0;

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const score = keywords.filter(keyword => text.includes(keyword)).length;
      if (score > maxScore) {
        maxScore = score;
        bestCategory = category;
      }
    }

    return maxScore > 0 ? bestCategory : null;
  }

  // Get category-specific quick replies with better formatting
  getCategoryQuickReplies(category, language) {
    const questions = this.categoryQuestions[category]?.[language] || this.categoryQuestions[category]?.['en'] || [];
    
    if (questions.length === 0) {
      return this.getGeneralQuickReplies(language);
    }
    
    return {
      type: 'button',
      body: {
        text: language === 'mr' 
          ? `${this.getCategoryName(category, language)} बद्दल सामान्य प्रश्न:`
          : `Common questions about ${this.getCategoryName(category, language)}:`
      },
      action: {
        buttons: questions.slice(0, 3).map((question, index) => ({
          type: 'reply',
          reply: {
            id: `quick_${category}_${index}`,
            title: question.length > 20 ? question.substring(0, 17) + '...' : question
          }
        }))
      }
    };
  }

  // Get general quick replies for unknown context
  getGeneralQuickReplies(language) {
    const replies = this.generalQuickReplies[language] || this.generalQuickReplies['en'];
    
    return {
      type: 'button',
      body: {
        text: language === 'mr' 
          ? 'आपण खालीलपैकी कोणत्या सेवेबद्दल जाणून घेऊ इच्छिता?'
          : 'Which service would you like to know about?'
      },
      action: {
        buttons: replies.map((reply, index) => ({
          type: 'reply',
          reply: {
            id: `general_${index}`,
            title: reply
          }
        }))
      }
    };
  }

  // Get welcome quick replies
  getWelcomeQuickReplies(language) {
    const replies = this.welcomeQuickReplies[language] || this.welcomeQuickReplies['en'];
    
    return {
      type: 'button',
      body: {
        text: language === 'mr' 
          ? '🙏 जिल्हा परिषद पुणे मध्ये आपले स्वागत आहे! आपण काय जाणून घेऊ इच्छिता?'
          : '🙏 Welcome to Zilla Panchayat Pune! What would you like to know?'
      },
      action: {
        buttons: replies.map((reply, index) => ({
          type: 'reply',
          reply: {
            id: `welcome_${index}`,
            title: reply
          }
        }))
      }
    };
  }

  // Generate follow-up suggestions with improved relevance check
  generateFollowUpSuggestions(responseContext, language) {
    try {
      const contextType = this.detectResponseContext(responseContext);
      
      // Only generate follow-up if the context is actually relevant
      if (!this.isFollowUpRelevant(responseContext)) {
        return null;
      }
      
      const suggestions = this.followUpSuggestions[contextType]?.[language] || 
                         this.followUpSuggestions[contextType]?.['en'] || [];

      if (suggestions.length === 0) {
        return null;
      }

      return {
        type: 'button',
        body: {
          text: language === 'mr' 
            ? 'अधिक माहितीसाठी:'
            : 'For more information:'
        },
        action: {
          buttons: suggestions.map((suggestion, index) => ({
            type: 'reply',
            reply: {
              id: `followup_${contextType}_${index}`,
              title: suggestion
            }
          }))
        }
      };

    } catch (error) {
      logger.error('Error generating follow-up suggestions:', error);
      return null;
    }
  }

  // Check if follow-up suggestions are relevant
  isFollowUpRelevant(responseText) {
    const text = responseText.toLowerCase();
    
    // Don't suggest follow-ups for simple answers or greetings
    if (text.length < 50) {
      return false;
    }
    
    // Don't suggest follow-ups if the response is asking for information
    if (text.includes('please provide') || text.includes('कृपया द्या') || 
        text.includes('what is your') || text.includes('तुमचे काय आहे')) {
      return false;
    }
    
    // Don't suggest follow-ups for thank you responses
    if (text.includes('thank you') || text.includes('धन्यवाद')) {
      return false;
    }
    
    return true;
  }

  // Detect response context for follow-up suggestions
  detectResponseContext(responseText) {
    const text = responseText.toLowerCase();
    
    if (text.includes('document') || text.includes('कागदपत्र') || 
        text.includes('application') || text.includes('अर्ज')) {
      return 'document_required';
    }
    
    if (text.includes('scheme') || text.includes('योजना') ||
        text.includes('benefit') || text.includes('लाभ')) {
      return 'scheme_info';
    }
    
    if (text.includes('contact') || text.includes('संपर्क') ||
        text.includes('office') || text.includes('कार्यालय')) {
      return 'contact_info';
    }
    
    return 'scheme_info'; // default
  }

  // Get category name in specified language
  getCategoryName(category, language) {
    const categoryNames = {
      'education': { en: 'Education', mr: 'शिक्षण' },
      'health': { en: 'Health', mr: 'आरोग्य' },
      'housing': { en: 'Housing', mr: 'आवास' },
      'employment': { en: 'Employment', mr: 'रोजगार' },
      'agriculture': { en: 'Agriculture', mr: 'कृषी' },
      'welfare': { en: 'Welfare', mr: 'कल्याण' },
      'certificates': { en: 'Certificates', mr: 'दाखले' }
    };
    
    return categoryNames[category]?.[language] || category;
  }

  // Process quick reply selection
  processQuickReplySelection(replyId, language) {
    try {
      const [prefix, category, index] = replyId.split('_');
      
      switch (prefix) {
        case 'quick':
          if (category && this.categoryQuestions[category]) {
            const questions = this.categoryQuestions[category][language] || 
                            this.categoryQuestions[category]['en'];
            return questions[parseInt(index)] || null;
          }
          break;
          
        case 'welcome':
          const welcomeReplies = this.welcomeQuickReplies[language] || 
                               this.welcomeQuickReplies['en'];
          return welcomeReplies[parseInt(index)] || null;
          
        case 'general':
          const generalReplies = this.generalQuickReplies[language] || 
                               this.generalQuickReplies['en'];
          return generalReplies[parseInt(index)] || null;
          
        case 'followup':
          const followupSuggestions = this.followUpSuggestions[category]?.[language] || 
                                    this.followUpSuggestions[category]?.['en'];
          return followupSuggestions?.[parseInt(index)] || null;
      }
      
      return null;
      
    } catch (error) {
      logger.error('Error processing quick reply selection:', error);
      return null;
    }
  }

  // Get smart suggestions based on user interaction history (improved)
  getSmartSuggestions(userHistory, language) {
    try {
      // Analyze user's most frequent queries from recent history
      const recentHistory = userHistory.slice(-10); // Last 10 messages
      const categoryFrequency = {};
      
      recentHistory.forEach(message => {
        const category = this.detectCategory(message.content);
        if (category) {
          categoryFrequency[category] = (categoryFrequency[category] || 0) + 1;
        }
      });
      
      // Get top 2 most frequent categories
      const topCategories = Object.entries(categoryFrequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 2)
        .map(([category]) => category);
      
      if (topCategories.length > 0) {
        const suggestions = [];
        
        topCategories.forEach(category => {
          const categoryQuestions = this.categoryQuestions[category]?.[language] || 
                                  this.categoryQuestions[category]?.['en'] || [];
          if (categoryQuestions.length > 0) {
            suggestions.push(categoryQuestions[0]); // Get first question from each category
          }
        });
        
        // Add one general suggestion
        const generalReplies = this.generalQuickReplies[language] || this.generalQuickReplies['en'];
        if (suggestions.length < 3 && generalReplies.length > 0) {
          suggestions.push(generalReplies[0]);
        }
        
        return {
          type: 'button',
          body: {
            text: language === 'mr' 
              ? 'आपल्या आवडीच्या सेवांवर आधारित सूचना:'
              : 'Suggestions based on your interests:'
          },
          action: {
            buttons: suggestions.slice(0, 3).map((suggestion, index) => ({
              type: 'reply',
              reply: {
                id: `smart_${index}`,
                title: suggestion.length > 20 ? suggestion.substring(0, 17) + '...' : suggestion
              }
            }))
          }
        };
      }
      
      return this.getGeneralQuickReplies(language);
      
    } catch (error) {
      logger.error('Error getting smart suggestions:', error);
      return this.getGeneralQuickReplies(language);
    }
  }
}

module.exports = new QuickReplyService();