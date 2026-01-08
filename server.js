const express = require('express');
const multer = require('multer');
const OpenAI = require('openai');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit
  }
});

// Simple intent detection with mobile actions
const detectIntentWithActions = (message) => {
  const lowerMessage = message.toLowerCase();
  
  // Check for specific detail requests first (user asking for specific item detail)
  if (lowerMessage.includes('detail') || lowerMessage.includes('tampilkan detail') || lowerMessage.includes('lihat detail')) {
    const extractedItem = extractItemFromMessage(message);
    if (extractedItem) {
      return {
        type: 'request_data',
        request: 'get_item_detail',
        message: `Baik, saya akan tampilkan detail ${extractedItem} untuk Anda.`,
        action: {
          type: 'navigate_detail',
          target: 'detail_screen',
          params: { item: extractedItem }
        },
        intent: 'detail_request'
      };
    }
  }
  
  // Check for basic intents
  const specificIntents = [
    // Basic menu request
    {
      keywords: ['menu', 'makanan', 'makan', 'restoran', 'kuliner', 'food court', 'info menu'],
      type: 'request_data',
      request: 'get_menu',
      message: 'Oke, tunggu sebentar ya. Saya akan carikan informasi menu untuk Anda.',
      action: {
        type: 'navigate',
        target: 'menu_screen',
        params: null
      },
      intent: 'menu'
    },
    
    // Store request
    {
      keywords: ['toko', 'shop', 'belanja', 'beli', 'store', 'tenant'],
      type: 'request_data',
      request: 'get_stores',
      message: 'Baik, saya akan carikan informasi toko yang tersedia.',
      action: {
        type: 'navigate',
        target: 'stores_screen',
        params: null
      },
      intent: 'store'
    },
    
    // Event request
    {
      keywords: ['event', 'acara', 'kegiatan', 'promo', 'diskon'],
      type: 'request_data',
      request: 'get_events',
      message: 'Tunggu sebentar, saya akan cek event yang sedang berlangsung.',
      action: {
        type: 'navigate',
        target: 'events_screen',
        params: null
      },
      intent: 'event'
    },
    
    // Location request
    {
      keywords: ['dimana', 'lokasi', 'tempat', 'alamat', 'arah', 'map'],
      type: 'request_data',
      request: 'get_location',
      message: 'Saya akan bantu Anda menemukan lokasi yang dicari.',
      action: {
        type: 'navigate',
        target: 'map_screen',
        params: null
      },
      intent: 'location'
    },
    
    // Parking request
    {
      keywords: ['parkir', 'parking', 'mobil', 'motor'],
      type: 'request_data',
      request: 'get_parking',
      message: 'Baik, saya akan cek informasi parkir untuk Anda.',
      action: {
        type: 'navigate',
        target: 'parking_screen',
        params: null
      },
      intent: 'parking'
    },
    
    // Reward/Hadiah request
    {
      keywords: ['reward', 'hadiah', 'poin', 'point', 'loyalty', 'member', 'membership', 'voucher', 'kupon', 'cashback'],
      type: 'request_data',
      request: 'get_rewards',
      message: 'Tunggu sebentar, saya akan cek reward dan poin Anda.',
      action: {
        type: 'navigate',
        target: 'rewards_screen',
        params: null
      },
      intent: 'reward'
    },
    
    // Booking request
    {
      keywords: ['booking', 'reservasi', 'pesan tempat', 'book'],
      type: 'confirmation_request',
      request: 'booking_confirmation',
      message: 'Apakah Anda ingin melakukan reservasi?',
      action: {
        type: 'show_popup',
        target: 'confirmation_popup',
        params: { 
          title: 'Konfirmasi Reservasi',
          message: 'Apakah Anda yakin ingin melakukan reservasi?',
          buttons: ['Ya', 'Tidak']
        }
      },
      intent: 'booking'
    }
  ];
  
  // Check for specific intent matches
  for (const intentData of specificIntents) {
    const hasMatch = intentData.keywords.some(keyword => 
      lowerMessage.includes(keyword)
    );
    
    if (hasMatch) {
      return intentData;
    }
  }
  
  // Fallback to general response
  return {
    intent: 'unknown',
    type: 'general_response',
    request: null,
    message: 'Maaf, saya kurang memahami maksud Anda. Bisa dijelaskan lebih detail?',
    action: null
  };
};

// Helper function to extract item name from detail request
const extractItemFromMessage = (message) => {
  const lowerMessage = message.toLowerCase();
  
  // Common items that can be detailed
  const items = [
    'burger', 'kentang', 'pecel lele', 'nasi goreng', 'mie ayam', 'bakso', 'soto', 'gado-gado',
    'mcdonald', 'kfc', 'pizza hut', 'starbucks', 'burger king',
    'zara', 'h&m', 'uniqlo', 'electronic city', 'gramedia'
  ];
  
  for (const item of items) {
    if (lowerMessage.includes(item)) {
      return item;
    }
  }
  
  // Try to extract word after "detail"
  const detailMatch = lowerMessage.match(/detail\s+(\w+)/);
  if (detailMatch) {
    return detailMatch[1];
  }
  
  // Try to extract word after "tampilkan detail"
  const tampilkanMatch = lowerMessage.match(/tampilkan detail\s+(\w+)/);
  if (tampilkanMatch) {
    return tampilkanMatch[1];
  }
  
  return null;
};

// Helper function to get action for data type (for final response after data fetch)
const getActionForDataType = (dataType) => {
  const actionMap = {
    'get_menu': {
      type: 'navigate',
      target: 'menu_screen',
      params: null
    },
    'get_stores': {
      type: 'navigate', 
      target: 'stores_screen',
      params: null
    },
    'get_events': {
      type: 'navigate',
      target: 'events_screen', 
      params: null
    },
    'get_rewards': {
      type: 'navigate',
      target: 'rewards_screen',
      params: null
    },
    'get_location': {
      type: 'navigate',
      target: 'map_screen',
      params: null
    },
    'get_parking': {
      type: 'navigate',
      target: 'parking_screen',
      params: null
    },
    'get_item_detail': {
      type: 'navigate_detail',
      target: 'detail_screen',
      params: { item: 'from_context' }
    }
  };
  
  return actionMap[dataType] || null;
};

// Speech-to-Text endpoint
app.post('/api/speech-to-text', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const tempFilePath = path.join(os.tmpdir(), `recording-${Date.now()}.webm`);
    fs.writeFileSync(tempFilePath, req.file.buffer);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
      language: 'id'
    });

    fs.unlinkSync(tempFilePath);

    res.json({
      text: transcription.text,
      success: true
    });

  } catch (error) {
    console.error('STT error:', error);
    res.status(500).json({
      error: 'Speech-to-text failed',
      details: error.message
    });
  }
});

// Chat with AI endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'No message provided' });
    }

    console.log('Processing chat message:', message);

    // Detect user intent with mobile actions
    const intentResult = detectIntentWithActions(message);
    console.log('Detected intent with actions:', intentResult);

    // If it's a data request, return structured response for frontend to handle
    if (intentResult.type === 'request_data') {
      return res.json({
        response: intentResult.message,
        type: intentResult.type,
        request: intentResult.request,
        intent: intentResult.intent,
        action: intentResult.action,
        success: true
      });
    }

    // For general responses, use OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `
            Kamu adalah customer service mall yang ramah dan natural.
            Berikan jawaban yang singkat dan jelas menggunakan bahasa Indonesia yang hangat dan friendly.
            Bicara seperti customer service sungguhan, bukan robot.
          `
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const aiResponse = completion.choices[0].message.content;

    res.json({
      response: aiResponse,
      type: 'general_response',
      intent: intentResult.intent,
      action: intentResult.action,
      success: true
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to get AI response',
      details: error.message
    });
  }
});

// Dummy data endpoints for testing
app.get('/api/dummy/menu', (req, res) => {
  res.json([
    { name: 'McDonald\'s', category: 'Fast Food', floor: 'Ground Floor', price: 'Rp 25.000 - 50.000' },
    { name: 'KFC', category: 'Fast Food', floor: 'Ground Floor', price: 'Rp 30.000 - 60.000' },
    { name: 'Pizza Hut', category: 'Pizza', floor: '1st Floor', price: 'Rp 80.000 - 150.000' },
    { name: 'Starbucks', category: 'Coffee & Beverages', floor: '2nd Floor', price: 'Rp 35.000 - 75.000' },
    { name: 'Sushi Tei', category: 'Japanese Food', floor: '2nd Floor', price: 'Rp 50.000 - 120.000' }
  ]);
});

app.get('/api/dummy/stores', (req, res) => {
  res.json([
    { name: 'Zara', category: 'Fashion', floor: '1st Floor', description: 'International fashion brand' },
    { name: 'H&M', category: 'Fashion', floor: '1st Floor', description: 'Affordable trendy clothing' },
    { name: 'Uniqlo', category: 'Fashion', floor: '2nd Floor', description: 'Japanese casual wear' },
    { name: 'Electronic City', category: 'Electronics', floor: 'Ground Floor', description: 'Electronics and gadgets' },
    { name: 'Gramedia', category: 'Books & Stationery', floor: '2nd Floor', description: 'Books and educational materials' }
  ]);
});

app.get('/api/dummy/events', (req, res) => {
  res.json([
    { name: 'Weekend Sale', description: 'Diskon hingga 70% untuk semua tenant fashion', date: '2026-01-11 - 2026-01-12', location: 'All Fashion Stores' },
    { name: 'Food Festival', description: 'Festival kuliner nusantara dengan berbagai makanan tradisional', date: '2026-01-15 - 2026-01-17', location: 'Food Court Area' },
    { name: 'Tech Expo', description: 'Pameran teknologi terbaru dan gadget', date: '2026-01-20 - 2026-01-22', location: 'Main Atrium' }
  ]);
});

app.get('/api/dummy/rewards', (req, res) => {
  res.json({
    user_points: 2450,
    membership_level: 'Gold',
    available_rewards: [
      { id: 1, name: 'Voucher Makan 50rb', points_required: 1000, category: 'Food', expires: '2026-02-28' },
      { id: 2, name: 'Diskon 20% Fashion', points_required: 1500, category: 'Fashion', expires: '2026-02-15' },
      { id: 3, name: 'Free Parking 1 Hari', points_required: 500, category: 'Parking', expires: '2026-01-31' },
      { id: 4, name: 'Cashback 100rb', points_required: 3000, category: 'Cashback', expires: '2026-03-31' }
    ],
    recent_transactions: [
      { date: '2026-01-07', description: 'Belanja di Zara', points_earned: 150 },
      { date: '2026-01-05', description: 'Makan di McDonald\'s', points_earned: 25 },
      { date: '2026-01-03', description: 'Redeem Voucher Parking', points_used: -500 }
    ],
    next_level_points: 550 // Points needed to reach Platinum
  });
});

// Chat with data endpoint - AI responds based on fetched data
app.post('/api/chat-with-data', async (req, res) => {
  try {
    const { originalMessage, dataType, data } = req.body;

    if (!originalMessage || !dataType || !data) {
      return res.status(400).json({ error: 'Missing required fields: originalMessage, dataType, data' });
    }

    console.log('Processing chat with data:', { originalMessage, dataType });

    // Create context-aware prompt based on data type
    let systemPrompt = '';
    let dataContext = '';

    switch (dataType) {
      case 'get_menu':
        systemPrompt = `Kamu adalah customer service mall yang ramah tapi singkat. 
        Berikan informasi menu dengan sangat ringkas dan to the point.
        Format: Nama restoran, lantai, harga. Tidak perlu penjelasan panjang.
        Contoh: "Ada McDonald's lantai dasar 25-50rb, KFC lantai dasar 30-60rb, Pizza Hut lantai 1 80-150rb."
        Maksimal 2-3 kalimat saja.`;
        dataContext = `Data menu yang tersedia: ${JSON.stringify(data)}`;
        break;

      case 'get_stores':
        systemPrompt = `Kamu adalah customer service mall yang ramah tapi singkat.
        Berikan informasi toko dengan sangat ringkas.
        Format: Nama toko, kategori, lantai. Maksimal 2-3 kalimat saja.
        Contoh: "Ada Zara dan H&M fashion di lantai 1, Uniqlo lantai 2."`;
        dataContext = `Data toko yang tersedia: ${JSON.stringify(data)}`;
        break;

      case 'get_events':
        systemPrompt = `Kamu adalah customer service mall yang ramah tapi singkat.
        Sebutkan event dengan sangat ringkas.
        Format: Nama event, tanggal, benefit utama. Maksimal 2-3 kalimat saja.
        Contoh: "Weekend ini ada sale fashion diskon 70%, Food Festival 15-17 Januari."`;
        dataContext = `Data event yang tersedia: ${JSON.stringify(data)}`;
        break;

      case 'get_rewards':
        systemPrompt = `Kamu adalah customer service mall yang ramah tapi singkat.
        Berikan info reward dan poin dengan ringkas.
        Format: Poin saat ini, level membership, reward yang bisa ditukar.
        Contoh: "Poin Anda 2450, level Gold. Bisa tukar voucher makan 50rb (1000 poin), diskon fashion 20% (1500 poin)."
        Maksimal 2-3 kalimat saja.`;
        dataContext = `Data reward user: ${JSON.stringify(data)}`;
        break;

      case 'get_item_detail':
        systemPrompt = `Kamu adalah customer service mall yang ramah tapi singkat.
        Berikan detail item dengan ringkas dan informatif.
        Fokus pada info penting saja: harga, lokasi, fitur utama.
        Maksimal 2-3 kalimat saja.`;
        dataContext = `Data detail item: ${JSON.stringify(data)}`;
        break;

      default:
        systemPrompt = `Kamu adalah customer service mall yang ramah tapi singkat. 
        Jawab dengan ringkas, maksimal 2-3 kalimat saja.`;
        dataContext = `Data: ${JSON.stringify(data)}`;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${systemPrompt}\n\n${dataContext}`
        },
        {
          role: 'user',
          content: originalMessage
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const aiResponse = completion.choices[0].message.content;

    res.json({
      response: aiResponse,
      type: 'data_response',
      dataType: dataType,
      action: getActionForDataType(dataType), // Add action for mobile redirect
      success: true
    });

  } catch (error) {
    console.error('Chat with data error:', error);
    res.status(500).json({
      error: 'Failed to get AI response with data',
      details: error.message
    });
  }
});

// Text-to-Speech endpoint
app.post('/api/text-to-speech', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    console.log('Converting text to speech:', text.substring(0, 50) + '...');

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: text,
      speed: 1.0
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache'
    });

    res.send(buffer);

  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({
      error: 'Text-to-speech failed',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    openai_configured: !!process.env.OPENAI_API_KEY
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Voice Chat AI Server running on http://localhost:${PORT}`);
  console.log(`📝 OpenAI API Key configured: ${!!process.env.OPENAI_API_KEY}`);
});