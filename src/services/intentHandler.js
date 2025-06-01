const logger = require('../utils/logger');

// Core intents based on knowledgebase.txt
const CITIZEN_INTENTS = {
  // Certificates
  birth_certificate: ['birth', 'जन्म', 'birth certificate', 'जन्म प्रमाणपत्र'],
  death_certificate: ['death', 'मृत्यू', 'death certificate', 'मृत्यू प्रमाणपत्र'],
  income_certificate: ['income', 'उत्पन्न', 'income certificate', 'उत्पन्न प्रमाणपत्र'],
  caste_certificate: ['caste', 'जात', 'caste certificate', 'जात प्रमाणपत्र'],
  marriage_certificate: ['marriage', 'लग्न', 'marriage certificate', 'विवाह प्रमाणपत्र'],
  
  // Major Schemes
  mgnrega: ['mgnrega', 'नरेगा', 'employment', 'रोजगार', 'job card'],
  pm_awas: ['awas', 'आवास', 'housing', 'house', 'pm awas'],
  pm_kisan: ['pm kisan', 'किसान', 'farmer', 'kisan samman'],
  swachh_bharat: ['toilet', 'शौचालय', 'swachh', 'स्वच्छ'],
  ladki_bahin: ['ladki bahin', 'लाडकी बहीण'],
  
  // Departments
  education: ['education', 'शिक्षण', 'school', 'शाळा', 'teacher'],
  health: ['health', 'आरोग्य', 'hospital', 'हॉस्पिटल', 'medical'],
  agriculture: ['agriculture', 'कृषी', 'farming', 'शेती', 'crop'],
  water_supply: ['water', 'पाणी', 'water supply', 'पाणी पुरवठा'],
  women_child: ['anganwadi', 'अंगणवाडी', 'women', 'महिला', 'child', 'बाल'],
  
  // Contact & Info
  contact: ['contact', 'संपर्क', 'phone', 'address', 'office'],
  complaint: ['complaint', 'तक्रार', 'grievance', 'problem'],
  
  // General
  help: ['help', 'मदत', 'assist', 'guide'],
  greeting: ['hello', 'hi', 'नमस्कार', 'namaste', 'good morning']
};

// Simple intent detection
const detectIntent = (message) => {
  const lowerMessage = message.toLowerCase();
  
  for (const [intent, keywords] of Object.entries(CITIZEN_INTENTS)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()))) {
      return intent;
    }
  }
  
  return 'general';
};

// Response templates based on knowledgebase.txt
const getIntentResponse = (intent, language, citizenData) => {
  const responses = {
    birth_certificate: {
      mr: `📋 जन्म प्रमाणपत्र:

📍 कुठे अर्ज करावा: जवळच्या ग्रामपंचायत कार्यालयात
📄 आवश्यक कागदपत्रे:
• हॉस्पिटल जन्म प्रमाणपत्र
• पालकांचा आधार कार्ड
• राहण्याचा पुरावा

💰 फी: सामान्य ₹50, तातडी ₹100
⏰ वेळ: 15 कामकाजाचे दिवस

📞 अधिक माहितीसाठी: 020-25536255`,
      en: `📋 Birth Certificate:

📍 Where to apply: Nearest Gram Panchayat office
📄 Required documents:
• Hospital birth certificate
• Parents' Aadhaar card
• Address proof

💰 Fees: Normal ₹50, Urgent ₹100
⏰ Time: 15 working days

📞 For more info: 020-25536255`
    },

    mgnrega: {
      mr: `🏗️ महात्मा गांधी नरेगा:

💼 लाभ: दरवर्षी 100 दिवसांची हमीची रोजगार
💰 वेतन: दिवसाला ₹309 (2024)
👥 पात्रता: ग्रामीण भागातील कुटुंब

📝 अर्ज कसे करावे:
• जवळच्या ग्रामपंचायत कार्यालयात जा
• जॉब कार्डसाठी अर्ज भरा
• आधार कार्ड आणि फोटो आणा

📞 मदतीसाठी: ग्रामपंचायत कार्यालय`,
      en: `🏗️ MGNREGA:

💼 Benefit: 100 days guaranteed employment per year
💰 Wage: ₹309 per day (2024)
👥 Eligibility: Rural households

📝 How to apply:
• Visit nearest Gram Panchayat office
• Fill job card application
• Bring Aadhaar card and photo

📞 For help: Gram Panchayat office`
    },

    pm_awas: {
      mr: `🏠 प्रधानमंत्री आवास योजना:

💰 लाभ: पक्का घर बांधण्यासाठी ₹1.20 लाख
👥 पात्रता: गरीब कुटुंबे, महिलांना प्राधान्य
🚽 अतिरिक्त: शौचालयासह घर

📝 अर्ज प्रक्रिया:
• ग्रामपंचायत/पंचायत समिती कार्यालयात अर्ज
• आधार कार्ड, उत्पन्न प्रमाणपत्र आवश्यक
• ऑनलाइन: pmayg.nic.in

📞 मदतीसाठी: 020-25536255`,
      en: `🏠 PM Awas Yojana:

💰 Benefit: ₹1.20 lakh for pucca house construction
👥 Eligibility: Poor families, priority to women
🚽 Additional: House with toilet

📝 Application process:
• Apply at Gram Panchayat/Panchayat Samiti office
• Aadhaar card, income certificate required
• Online: pmayg.nic.in

📞 For help: 020-25536255`
    },

    contact: {
      mr: `📞 पुणे जिल्हा परिषद संपर्क:

🏢 मुख्य कार्यालय:
📍 जिल्हा परिषद भवन, शिवाजीनगर, पुणे - 411005
📞 020-25536255, 25536256
📧 ceopunezp@gmail.com
🌐 www.punezp.gov.in

🕘 कार्यालयीन वेळ:
सोमवार ते शुक्रवार: 10:00 ते 18:00

🗓️ मासिक जनता दरबार:
दर महिन्याच्या पहिल्या सोमवारी 11:00 ते 14:00`,
      en: `📞 Pune Zilla Parishad Contact:

🏢 Main Office:
📍 Zilla Parishad Bhavan, Shivajinagar, Pune - 411005
📞 020-25536255, 25536256
📧 ceopunezp@gmail.com
🌐 www.punezp.gov.in

🕘 Office Hours:
Monday to Friday: 10:00 AM to 6:00 PM

🗓️ Monthly Public Meeting:
First Monday of every month 11:00 AM to 2:00 PM`
    },

    help: {
      mr: `🙏 मी आपली मदत करू शकतो:

📋 प्रमाणपत्रे:
• जन्म प्रमाणपत्र
• मृत्यू प्रमाणपत्र
• उत्पन्न प्रमाणपत्र
• जात प्रमाणपत्र

🏛️ सरकारी योजना:
• नरेगा
• आवास योजना
• पीएम किसान योजना
• स्वच्छ भारत मिशन

📞 संपर्क माहिती
❓ तक्रार निवारण

फक्त लिहा जे हवे!`,
      en: `🙏 I can help you with:

📋 Certificates:
• Birth Certificate
• Death Certificate
• Income Certificate
• Caste Certificate

🏛️ Government Schemes:
• MGNREGA
• Housing Scheme
• PM Kisan Yojana
• Swachh Bharat Mission

📞 Contact Information
❓ Complaint Resolution

Just type what you need!`
    }
  };

  return responses[intent]?.[language] || responses['help'][language];
};

module.exports = {
  detectIntent,
  getIntentResponse,
  CITIZEN_INTENTS
};