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

// Serve React build files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
} else {
  // Development mode - serve public folder for fallback
  app.get('/', (req, res) => {
    res.json({ 
      message: 'Voice Chat AI Server is running!',
      frontend: 'Run React client with: cd client && npm start',
      fallback: 'Or access public folder at /public'
    });
  });
}

// Speech-to-Text endpoint
app.post('/api/speech-to-text', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // buat file sementara
    const tempFilePath = path.join(
      os.tmpdir(),
      `recording-${Date.now()}.webm`
    );

    fs.writeFileSync(tempFilePath, req.file.buffer);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
      language: 'id'
    });

    // hapus file sementara
    fs.unlinkSync(tempFilePath);

    res.json({
      text: transcription.text,
      success: true
    });

  } catch (error) {
    console.error('STT error:', error);
    
    // More specific error handling
    let errorMessage = 'Speech-to-text failed';
    if (error.message.includes('too short')) {
      errorMessage = 'Audio file is too short. Please record for at least 1 second.';
    } else if (error.message.includes('invalid')) {
      errorMessage = 'Invalid audio format. Please try again.';
    }
    
    res.status(500).json({
      error: errorMessage,
      details: error.message
    });
  }
});




// Intent detection function
const detectIntent = (message) => {
  const lowerMessage = message.toLowerCase();
  
  // Define intent patterns with navigation actions
  const intents = {
    menu: {
      keywords: ['menu', 'makanan', 'makan', 'restoran', 'kuliner', 'food court', 'mau makan', 'lapar'],
      type: 'request_data',
      request: 'get_menu',
      message: 'Oke, tunggu sebentar ya. Saya akan carikan informasi menu untuk Anda.',
      action: 'navigate_to_menu' // Mobile navigation action
    },
    store: {
      keywords: ['toko', 'shop', 'belanja', 'beli', 'store', 'tenant', 'brand'],
      type: 'request_data',
      request: 'get_stores',
      message: 'Baik, saya akan carikan informasi toko yang tersedia di mall ini.',
      action: 'navigate_to_stores' // Mobile navigation action
    },
    event: {
      keywords: ['event', 'acara', 'kegiatan', 'promo', 'diskon', 'sale'],
      type: 'request_data',
      request: 'get_events',
      message: 'Tunggu sebentar, saya akan cek event dan promo yang sedang berlangsung.',
      action: 'navigate_to_events' // Mobile navigation action
    },
    location: {
      keywords: ['dimana', 'lokasi', 'tempat', 'alamat', 'arah', 'petunjuk', 'map', 'peta'],
      type: 'request_data',
      request: 'get_location',
      message: 'Saya akan bantu Anda menemukan lokasi yang dicari.',
      action: 'navigate_to_map' // Mobile navigation action
    },
    parking: {
      keywords: ['parkir', 'parking', 'mobil', 'motor', 'kendaraan'],
      type: 'request_data',
      request: 'get_parking',
      message: 'Baik, saya akan cek informasi parkir untuk Anda.',
      action: 'navigate_to_parking' // Mobile navigation action
    },
    hours: {
      keywords: ['jam', 'buka', 'tutup', 'operasional', 'waktu', 'kapan'],
      type: 'request_data',
      request: 'get_hours',
      message: 'Saya akan cek jam operasional mall untuk Anda.',
      action: 'navigate_to_info' // Mobile navigation action
    },
    greeting: {
      keywords: ['halo', 'hai', 'hello', 'selamat', 'pagi', 'siang', 'sore', 'malam'],
      type: 'general_response',
      request: null,
      message: 'Halo! Selamat datang di mall kami. Ada yang bisa saya bantu hari ini?',
      action: null // No navigation needed
    },
    thanks: {
      keywords: ['terima kasih', 'thanks', 'makasih', 'thank you'],
      type: 'general_response',
      request: null,
      message: 'Sama-sama! Senang bisa membantu Anda. Ada lagi yang bisa saya bantu?',
      action: null // No navigation needed
    }
  };

  // Check for intent matches
  for (const [intentName, intentData] of Object.entries(intents)) {
    const hasMatch = intentData.keywords.some(keyword => 
      lowerMessage.includes(keyword)
    );
    
    if (hasMatch) {
      return {
        intent: intentName,
        ...intentData
      };
    }
  }

  // Default fallback
  return {
    intent: 'unknown',
    type: 'general_response',
    request: null,
    message: 'Maaf, saya kurang memahami maksud Anda. Bisa dijelaskan lebih detail? Saya bisa membantu informasi tentang menu, toko, event, atau fasilitas mall lainnya.',
    action: null
  };
};

// Enhanced intent detection with comprehensive mobile actions
const detectIntentWithActions = (message) => {
  const lowerMessage = message.toLowerCase();
  
  // Check for specific action intents
  const specificIntents = [
    // Navigation Actions
    {
      keywords: ['menu', 'makanan', 'makan', 'restoran', 'kuliner', 'food court'],
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
    
    // Filter Actions
    {
      keywords: ['menu murah', 'makanan murah', 'harga terjangkau', 'budget'],
      type: 'request_data',
      request: 'get_menu',
      message: 'Baik, saya akan carikan menu dengan harga terjangkau untuk Anda.',
      action: {
        type: 'filter',
        target: 'menu_screen',
        params: { filter: 'price_low', category: 'budget' }
      },
      intent: 'menu_filter'
    },
    
    {
      keywords: ['fast food', 'makanan cepat', 'mcdonald', 'kfc'],
      type: 'request_data',
      request: 'get_menu',
      message: 'Saya akan carikan pilihan fast food untuk Anda.',
      action: {
        type: 'filter',
        target: 'menu_screen', 
        params: { filter: 'category', value: 'fast_food' }
      },
      intent: 'menu_filter'
    },
    
    // Detail Actions - with follow-up questions
    {
      keywords: ['detail menu', 'info lengkap menu', 'lihat detail', 'menu lengkap'],
      type: 'follow_up_question',
      request: 'get_menu_options',
      message: 'Baik, saya akan tampilkan pilihan menu. Detail menu mana yang ingin Anda lihat?',
      action: {
        type: 'show_options',
        target: 'menu_options',
        params: { 
          question: 'Pilih restoran untuk melihat detail menu:',
          options: [
            { id: 'mcdonalds', label: 'McDonald\'s', action: 'navigate_detail' },
            { id: 'kfc', label: 'KFC', action: 'navigate_detail' },
            { id: 'pizzahut', label: 'Pizza Hut', action: 'navigate_detail' },
            { id: 'starbucks', label: 'Starbucks', action: 'navigate_detail' }
          ]
        }
      },
      intent: 'menu_detail_options'
    },
    
    // Specific detail requests
    {
      keywords: ['detail menu mcdonald', 'info mcdonald', 'menu mcdonald lengkap'],
      type: 'request_data',
      request: 'get_menu_detail',
      message: 'Saya akan tampilkan detail menu McDonald\'s untuk Anda.',
      action: {
        type: 'navigate_detail',
        target: 'menu_detail_screen',
        params: { restaurant: 'mcdonalds', view: 'detailed' }
      },
      intent: 'menu_detail_specific'
    },
    
    {
      keywords: ['detail menu kfc', 'info kfc', 'menu kfc lengkap'],
      type: 'request_data',
      request: 'get_menu_detail',
      message: 'Saya akan tampilkan detail menu KFC untuk Anda.',
      action: {
        type: 'navigate_detail',
        target: 'menu_detail_screen',
        params: { restaurant: 'kfc', view: 'detailed' }
      },
      intent: 'menu_detail_specific'
    },
    
    // Store detail with options
    {
      keywords: ['detail toko', 'info toko lengkap', 'lihat detail toko'],
      type: 'follow_up_question',
      request: 'get_store_options',
      message: 'Baik, detail toko mana yang ingin Anda lihat?',
      action: {
        type: 'show_options',
        target: 'store_options',
        params: {
          question: 'Pilih toko untuk melihat detail:',
          options: [
            { id: 'zara', label: 'Zara - Fashion', action: 'navigate_detail' },
            { id: 'hm', label: 'H&M - Fashion', action: 'navigate_detail' },
            { id: 'uniqlo', label: 'Uniqlo - Casual Wear', action: 'navigate_detail' },
            { id: 'electronic_city', label: 'Electronic City - Electronics', action: 'navigate_detail' }
          ]
        }
      },
      intent: 'store_detail_options'
    },
    
    // Event detail with options
    {
      keywords: ['detail event', 'info event lengkap', 'lihat detail acara'],
      type: 'follow_up_question',
      request: 'get_event_options',
      message: 'Event mana yang ingin Anda ketahui detailnya?',
      action: {
        type: 'show_options',
        target: 'event_options',
        params: {
          question: 'Pilih event untuk melihat detail:',
          options: [
            { id: 'weekend_sale', label: 'Weekend Sale - Diskon 70%', action: 'navigate_detail' },
            { id: 'food_festival', label: 'Food Festival - Kuliner Nusantara', action: 'navigate_detail' },
            { id: 'tech_expo', label: 'Tech Expo - Pameran Teknologi', action: 'navigate_detail' }
          ]
        }
      },
      intent: 'event_detail_options'
    },
    
    // Booking with confirmation and options
    {
      keywords: ['booking', 'reservasi', 'pesan tempat', 'book'],
      type: 'follow_up_question',
      request: 'booking_options',
      message: 'Reservasi untuk apa yang Anda butuhkan?',
      action: {
        type: 'show_options',
        target: 'booking_options',
        params: {
          question: 'Pilih jenis reservasi:',
          options: [
            { id: 'restaurant', label: 'Reservasi Restoran', action: 'show_popup' },
            { id: 'parking', label: 'Reservasi Parkir', action: 'show_popup' },
            { id: 'event', label: 'Daftar Event', action: 'show_popup' }
          ]
        }
      },
      intent: 'booking_options'
    },
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
    
    {
      keywords: ['toko fashion', 'baju', 'pakaian', 'fashion'],
      type: 'request_data',
      request: 'get_stores',
      message: 'Saya akan carikan toko fashion untuk Anda.',
      action: {
        type: 'filter',
        target: 'stores_screen',
        params: { filter: 'category', value: 'fashion' }
      },
      intent: 'store_filter'
    },
    
    // Confirmation Actions
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
    },
    
    {
      keywords: ['beli', 'beli sekarang', 'order', 'pesan'],
      type: 'confirmation_request',
      request: 'purchase_confirmation',
      message: 'Apakah Anda ingin melanjutkan pembelian?',
      action: {
        type: 'show_popup',
        target: 'purchase_popup',
        params: {
          title: 'Konfirmasi Pembelian',
          message: 'Lanjutkan ke pembayaran?',
          buttons: ['Lanjutkan', 'Batal']
        }
      },
      intent: 'purchase'
    },
    
    // Event Actions
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
    
    {
      keywords: ['promo hari ini', 'diskon hari ini', 'sale today'],
      type: 'request_data',
      request: 'get_events',
      message: 'Saya akan carikan promo yang berlaku hari ini.',
      action: {
        type: 'filter',
        target: 'events_screen',
        params: { filter: 'date', value: 'today' }
      },
      intent: 'event_filter'
    },
    
    // Location/Map Actions
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
    
    {
      keywords: ['arah ke', 'rute ke', 'navigasi ke', 'petunjuk ke'],
      type: 'request_data',
      request: 'get_directions',
      message: 'Saya akan berikan petunjuk arah untuk Anda.',
      action: {
        type: 'open_navigation',
        target: 'external_maps',
        params: { mode: 'directions' }
      },
      intent: 'directions'
    },
    
    // Parking Actions
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
    
    // Special Actions
    {
      keywords: ['panggil security', 'bantuan', 'emergency', 'darurat'],
      type: 'emergency_request',
      request: 'emergency_call',
      message: 'Saya akan menghubungkan Anda dengan security.',
      action: {
        type: 'emergency_call',
        target: 'security_contact',
        params: { priority: 'high' }
      },
      intent: 'emergency'
    },
    
    {
      keywords: ['feedback', 'komplain', 'saran', 'kritik'],
      type: 'feedback_request',
      request: 'feedback_form',
      message: 'Terima kasih, saya akan buka form feedback untuk Anda.',
      action: {
        type: 'open_form',
        target: 'feedback_form',
        params: { type: 'feedback' }
      },
      intent: 'feedback'
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
  
  // Fallback to general detection
  return detectIntent(message);
};

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
        action: intentResult.action, // Mobile navigation action
        success: true
      });
    }

    // For general responses or unknown intents, use OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `
            Kamu adalah asisten aplikasi mall yang ramah dan membantu.
            ATURAN WAJIB:
            - Selalu jaga konteks pembicaraan terakhir
            - Jika user bertanya ambigu, hubungkan ke topik sebelumnya
            - Jika masih ambigu, minta klarifikasi singkat
            - Fokus ke tenant, event, dan promo mall ini
            - Jangan mengubah topik tanpa alasan
            - Berikan jawaban yang singkat dan jelas
            - Gunakan bahasa Indonesia yang ramah
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
      voice: 'nova', // Options: alloy, echo, fable, onyx, nova, shimmer
      input: text,
      speed: 1.0
    });

    // Convert the response to a buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());

    // Set appropriate headers for audio streaming
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

// Dummy data endpoints for testing - replace your external service APIs
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

app.get('/api/dummy/location', (req, res) => {
  res.json({
    address: 'Jl. Mall Indah No. 123, Jakarta Selatan 12345',
    coordinates: { lat: -6.2088, lng: 106.8456 },
    landmarks: ['Dekat Stasiun MRT Blok M', 'Seberang Bank BCA', 'Samping Hotel Grand Mahkota'],
    transportation: ['MRT: Stasiun Blok M (5 menit jalan kaki)', 'Bus: Halte Blok M', 'Ojek Online: Tersedia']
  });
});

app.get('/api/dummy/parking', (req, res) => {
  res.json({
    available_spots: 150,
    total_spots: 500,
    rates: { 
      hourly: 'Rp 5.000/jam', 
      daily: 'Rp 25.000/hari',
      weekend: 'Rp 30.000/hari'
    },
    floors: ['B1 (Motor)', 'B2 (Mobil)', 'B3 (Mobil)'],
    status: 'Available'
  });
});

app.get('/api/dummy/hours', (req, res) => {
  res.json({
    weekdays: '10:00 - 22:00',
    weekends: '10:00 - 23:00',
    holidays: '10:00 - 23:00',
    special_notes: 'Beberapa restoran buka sampai 23:30 di weekend'
  });
});

// Direct chat endpoint - AI responds immediately with data (no "tunggu sebentar")
app.post('/api/chat-direct', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'No message provided' });
    }

    console.log('Processing direct chat message:', message);

    // Step 1: Detect user intent
    const intentResult = detectIntent(message);
    console.log('Detected intent:', intentResult);

    // Step 2: If it's a data request, fetch data immediately and get AI response
    if (intentResult.type === 'request_data') {
      // Fetch data from dummy endpoint based on request type
      let fetchedData;
      try {
        if (intentResult.request === 'get_menu') {
          fetchedData = [
            { name: 'McDonald\'s', category: 'Fast Food', floor: 'Ground Floor', price: 'Rp 25.000 - 50.000' },
            { name: 'KFC', category: 'Fast Food', floor: 'Ground Floor', price: 'Rp 30.000 - 60.000' },
            { name: 'Pizza Hut', category: 'Pizza', floor: '1st Floor', price: 'Rp 80.000 - 150.000' },
            { name: 'Starbucks', category: 'Coffee & Beverages', floor: '2nd Floor', price: 'Rp 35.000 - 75.000' },
            { name: 'Sushi Tei', category: 'Japanese Food', floor: '2nd Floor', price: 'Rp 50.000 - 120.000' }
          ];
        } else if (intentResult.request === 'get_stores') {
          fetchedData = [
            { name: 'Zara', category: 'Fashion', floor: '1st Floor', description: 'International fashion brand' },
            { name: 'H&M', category: 'Fashion', floor: '1st Floor', description: 'Affordable trendy clothing' },
            { name: 'Uniqlo', category: 'Fashion', floor: '2nd Floor', description: 'Japanese casual wear' },
            { name: 'Electronic City', category: 'Electronics', floor: 'Ground Floor', description: 'Electronics and gadgets' },
            { name: 'Gramedia', category: 'Books & Stationery', floor: '2nd Floor', description: 'Books and educational materials' }
          ];
        } else if (intentResult.request === 'get_events') {
          fetchedData = [
            { name: 'Weekend Sale', description: 'Diskon hingga 70% untuk semua tenant fashion', date: '2026-01-11 - 2026-01-12', location: 'All Fashion Stores' },
            { name: 'Food Festival', description: 'Festival kuliner nusantara dengan berbagai makanan tradisional', date: '2026-01-15 - 2026-01-17', location: 'Food Court Area' },
            { name: 'Tech Expo', description: 'Pameran teknologi terbaru dan gadget', date: '2026-01-20 - 2026-01-22', location: 'Main Atrium' }
          ];
        } else if (intentResult.request === 'get_location') {
          fetchedData = {
            address: 'Jl. Mall Indah No. 123, Jakarta Selatan 12345',
            coordinates: { lat: -6.2088, lng: 106.8456 },
            landmarks: ['Dekat Stasiun MRT Blok M', 'Seberang Bank BCA', 'Samping Hotel Grand Mahkota'],
            transportation: ['MRT: Stasiun Blok M (5 menit jalan kaki)', 'Bus: Halte Blok M', 'Ojek Online: Tersedia']
          };
        } else if (intentResult.request === 'get_parking') {
          fetchedData = {
            available_spots: 150,
            total_spots: 500,
            rates: { 
              hourly: 'Rp 5.000/jam', 
              daily: 'Rp 25.000/hari',
              weekend: 'Rp 30.000/hari'
            },
            floors: ['B1 (Motor)', 'B2 (Mobil)', 'B3 (Mobil)'],
            status: 'Available'
          };
        } else if (intentResult.request === 'get_hours') {
          fetchedData = {
            weekdays: '10:00 - 22:00',
            weekends: '10:00 - 23:00',
            holidays: '10:00 - 23:00',
            special_notes: 'Beberapa restoran buka sampai 23:30 di weekend'
          };
        }

        // Generate AI response based on data
        if (fetchedData) {
          let systemPrompt = '';
          let dataContext = '';

          switch (intentResult.request) {
            case 'get_menu':
              systemPrompt = `Kamu adalah customer service mall yang ramah dan natural. 
              Bicara seperti customer service sungguhan yang sedang merekomendasikan tempat makan.
              Jangan gunakan format formal atau bullet point.
              Sebutkan restoran dengan cara yang conversational, seperti "Ada McDonald's sama KFC di lantai dasar kalau mau yang cepat, atau kalau mau pizza ada Pizza Hut di lantai 1".
              Gunakan bahasa sehari-hari yang hangat dan helpful.
              Berikan rekomendasi berdasarkan preferensi yang mungkin customer miliki.`;
              dataContext = `Data menu yang tersedia: ${JSON.stringify(fetchedData)}`;
              break;

            case 'get_stores':
              systemPrompt = `Kamu adalah customer service mall yang ramah dan natural. 
              Bicara seperti customer service sungguhan yang sedang membantu customer cari toko.
              Jangan gunakan format formal atau bullet point.
              Sebutkan toko dengan cara yang conversational, seperti "Kalau mau belanja baju ada Zara sama H&M di lantai 1, atau kalau cari yang lebih casual ada Uniqlo di lantai 2".
              Gunakan bahasa sehari-hari yang hangat dan helpful.`;
              dataContext = `Data toko yang tersedia: ${JSON.stringify(fetchedData)}`;
              break;

            case 'get_events':
              systemPrompt = `Kamu adalah customer service mall yang ramah dan natural. 
              Bicara seperti customer service sungguhan, bukan membaca daftar formal.
              Sebutkan event dengan cara yang conversational dan natural.
              Jangan gunakan format bullet point, struktur formal, atau kata-kata seperti "Deskripsi:", "Lokasi:", "Tanggal:".
              Bicara seperti sedang ngobrol dengan customer di telepon.
              Fokus pada event yang paling menarik dan relevan.
              Gunakan bahasa sehari-hari yang hangat dan friendly.
              Contoh: "Oh ada beberapa event menarik nih! Weekend ini ada sale besar-besaran di toko fashion, diskonnya sampai 70% lho!"`;
              dataContext = `Data event yang tersedia: ${JSON.stringify(fetchedData)}`;
              break;

            case 'get_location':
              systemPrompt = `Kamu adalah customer service mall yang ramah dan natural. 
              Bicara seperti customer service sungguhan yang sedang kasih petunjuk arah.
              Jangan gunakan format formal atau bullet point.
              Kasih info lokasi dengan cara yang conversational, seperti "Mall kita di Jalan Mall Indah, deket banget sama stasiun MRT Blok M, jalan kaki cuma 5 menit".
              Gunakan bahasa sehari-hari yang hangat dan helpful.`;
              dataContext = `Data lokasi: ${JSON.stringify(fetchedData)}`;
              break;

            case 'get_parking':
              systemPrompt = `Kamu adalah customer service mall yang ramah dan natural. 
              Bicara seperti customer service sungguhan yang sedang kasih info parkir.
              Jangan gunakan format formal atau bullet point.
              Kasih info parkir dengan cara yang conversational, seperti "Parkir masih banyak kok, ada 150 slot kosong. Tarif 5 ribu per jam, atau kalau seharian 25 ribu".
              Gunakan bahasa sehari-hari yang hangat dan helpful.`;
              dataContext = `Data parkir: ${JSON.stringify(fetchedData)}`;
              break;

            case 'get_hours':
              systemPrompt = `Kamu adalah customer service mall yang ramah dan natural. 
              Bicara seperti customer service sungguhan yang sedang kasih info jam buka.
              Jangan gunakan format formal atau bullet point.
              Kasih info jam operasional dengan cara yang conversational, seperti "Mall buka dari jam 10 pagi sampai 10 malam setiap hari, weekend sampai jam 11 malam".
              Gunakan bahasa sehari-hari yang hangat dan helpful.`;
              dataContext = `Data jam operasional: ${JSON.stringify(fetchedData)}`;
              break;

            default:
              systemPrompt = `Kamu adalah customer service mall yang ramah dan natural. Jawab berdasarkan data yang diberikan dengan bahasa sehari-hari yang hangat dan helpful.`;
              dataContext = `Data: ${JSON.stringify(fetchedData)}`;
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
                content: message
              }
            ],
            max_tokens: 500,
            temperature: 0.7
          });

          const aiResponse = completion.choices[0].message.content;

          return res.json({
            response: aiResponse,
            type: 'data_response',
            request: intentResult.request,
            intent: intentResult.intent,
            success: true
          });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        // Fallback to general response
      }
    }

    // For general responses or if data fetch fails, use OpenAI without data
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
      success: true
    });

  } catch (error) {
    console.error('Direct chat error:', error);
    res.status(500).json({
      error: 'Failed to process chat',
      details: error.message
    });
  }
});

// Helper function to get action for data type (fallback for simple actions)
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
    'get_hours': {
      type: 'navigate',
      target: 'info_screen',
      params: null
    }
  };
  
  return actionMap[dataType] || null;
};

// Handle user selection from options
app.post('/api/handle-selection', async (req, res) => {
  try {
    const { optionId, optionType, originalIntent } = req.body;

    if (!optionId || !optionType) {
      return res.status(400).json({ error: 'Missing optionId or optionType' });
    }

    console.log('Processing user selection:', { optionId, optionType, originalIntent });

    let response = {};

    // Handle different option types
    switch (optionType) {
      case 'menu_options':
        response = {
          response: `Baik, saya akan tampilkan detail menu ${getRestaurantName(optionId)} untuk Anda.`,
          type: 'request_data',
          request: 'get_menu_detail',
          action: {
            type: 'navigate_detail',
            target: 'menu_detail_screen',
            params: { restaurant: optionId, view: 'detailed' }
          },
          intent: 'menu_detail_selected'
        };
        break;

      case 'store_options':
        response = {
          response: `Saya akan tampilkan informasi lengkap tentang ${getStoreName(optionId)}.`,
          type: 'request_data',
          request: 'get_store_detail',
          action: {
            type: 'navigate_detail',
            target: 'store_detail_screen',
            params: { store: optionId, view: 'detailed' }
          },
          intent: 'store_detail_selected'
        };
        break;

      case 'event_options':
        response = {
          response: `Baik, saya akan tampilkan detail lengkap ${getEventName(optionId)}.`,
          type: 'request_data',
          request: 'get_event_detail',
          action: {
            type: 'navigate_detail',
            target: 'event_detail_screen',
            params: { event: optionId, view: 'detailed' }
          },
          intent: 'event_detail_selected'
        };
        break;

      case 'booking_options':
        const bookingActions = {
          restaurant: {
            response: 'Apakah Anda yakin ingin melakukan reservasi restoran?',
            action: {
              type: 'show_popup',
              target: 'booking_confirmation',
              params: {
                title: 'Konfirmasi Reservasi Restoran',
                message: 'Lanjutkan ke form reservasi?',
                buttons: ['Ya, Lanjutkan', 'Batal']
              }
            }
          },
          parking: {
            response: 'Apakah Anda ingin reservasi tempat parkir?',
            action: {
              type: 'show_popup',
              target: 'parking_booking',
              params: {
                title: 'Reservasi Parkir',
                message: 'Pilih waktu dan durasi parkir',
                buttons: ['Pilih Waktu', 'Batal']
              }
            }
          },
          event: {
            response: 'Apakah Anda ingin mendaftar untuk event ini?',
            action: {
              type: 'show_popup',
              target: 'event_registration',
              params: {
                title: 'Daftar Event',
                message: 'Lanjutkan ke pendaftaran?',
                buttons: ['Daftar', 'Batal']
              }
            }
          }
        };

        const bookingAction = bookingActions[optionId];
        if (bookingAction) {
          response = {
            response: bookingAction.response,
            type: 'confirmation_request',
            request: `${optionId}_booking`,
            action: bookingAction.action,
            intent: 'booking_confirmation'
          };
        }
        break;

      default:
        response = {
          response: 'Maaf, pilihan tidak valid. Silakan coba lagi.',
          type: 'general_response',
          intent: 'error'
        };
    }

    res.json({
      ...response,
      success: true
    });

  } catch (error) {
    console.error('Selection handling error:', error);
    res.status(500).json({
      error: 'Failed to handle selection',
      details: error.message
    });
  }
});

// Helper functions for option names
const getRestaurantName = (id) => {
  const names = {
    'mcdonalds': 'McDonald\'s',
    'kfc': 'KFC',
    'pizzahut': 'Pizza Hut',
    'starbucks': 'Starbucks'
  };
  return names[id] || id;
};

const getStoreName = (id) => {
  const names = {
    'zara': 'Zara',
    'hm': 'H&M',
    'uniqlo': 'Uniqlo',
    'electronic_city': 'Electronic City'
  };
  return names[id] || id;
};

const getEventName = (id) => {
  const names = {
    'weekend_sale': 'Weekend Sale',
    'food_festival': 'Food Festival',
    'tech_expo': 'Tech Expo'
  };
  return names[id] || id;
};

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
        systemPrompt = `Kamu adalah customer service mall yang ramah dan natural. 
        Bicara seperti customer service sungguhan yang sedang merekomendasikan tempat makan.
        Jangan gunakan format formal atau bullet point.
        Sebutkan restoran dengan cara yang conversational, seperti "Ada McDonald's sama KFC di lantai dasar kalau mau yang cepat, atau kalau mau pizza ada Pizza Hut di lantai 1".
        Gunakan bahasa sehari-hari yang hangat dan helpful.
        Berikan rekomendasi berdasarkan preferensi yang mungkin customer miliki.`;
        dataContext = `Data menu yang tersedia: ${JSON.stringify(data)}`;
        break;

      case 'get_stores':
        systemPrompt = `Kamu adalah customer service mall yang ramah dan natural. 
        Bicara seperti customer service sungguhan yang sedang membantu customer cari toko.
        Jangan gunakan format formal atau bullet point.
        Sebutkan toko dengan cara yang conversational, seperti "Kalau mau belanja baju ada Zara sama H&M di lantai 1, atau kalau cari yang lebih casual ada Uniqlo di lantai 2".
        Gunakan bahasa sehari-hari yang hangat dan helpful.`;
        dataContext = `Data toko yang tersedia: ${JSON.stringify(data)}`;
        break;

      case 'get_events':
        systemPrompt = `Kamu adalah customer service mall yang ramah dan natural. 
        Bicara seperti customer service sungguhan, bukan membaca daftar formal.
        Sebutkan event dengan cara yang conversational dan natural.
        Jangan gunakan format bullet point, struktur formal, atau kata-kata seperti "Deskripsi:", "Lokasi:", "Tanggal:".
        Bicara seperti sedang ngobrol dengan customer di telepon.
        Fokus pada event yang paling menarik dan relevan.
        Gunakan bahasa sehari-hari yang hangat dan friendly.
        Contoh: "Oh ada beberapa event menarik nih! Weekend ini ada sale besar-besaran di toko fashion, diskonnya sampai 70% lho!"`;
        dataContext = `Data event yang tersedia: ${JSON.stringify(data)}`;
        break;

      case 'get_location':
        systemPrompt = `Kamu adalah customer service mall yang ramah dan natural. 
        Bicara seperti customer service sungguhan yang sedang kasih petunjuk arah.
        Jangan gunakan format formal atau bullet point.
        Kasih info lokasi dengan cara yang conversational, seperti "Mall kita di Jalan Mall Indah, deket banget sama stasiun MRT Blok M, jalan kaki cuma 5 menit".
        Gunakan bahasa sehari-hari yang hangat dan helpful.`;
        dataContext = `Data lokasi: ${JSON.stringify(data)}`;
        break;

      case 'get_parking':
        systemPrompt = `Kamu adalah customer service mall yang ramah dan natural. 
        Bicara seperti customer service sungguhan yang sedang kasih info parkir.
        Jangan gunakan format formal atau bullet point.
        Kasih info parkir dengan cara yang conversational, seperti "Parkir masih banyak kok, ada 150 slot kosong. Tarif 5 ribu per jam, atau kalau seharian 25 ribu".
        Gunakan bahasa sehari-hari yang hangat dan helpful.`;
        dataContext = `Data parkir: ${JSON.stringify(data)}`;
        break;

      case 'get_hours':
        systemPrompt = `Kamu adalah customer service mall yang ramah dan natural. 
        Bicara seperti customer service sungguhan yang sedang kasih info jam buka.
        Jangan gunakan format formal atau bullet point.
        Kasih info jam operasional dengan cara yang conversational, seperti "Mall buka dari jam 10 pagi sampai 10 malam setiap hari, weekend sampai jam 11 malam".
        Gunakan bahasa sehari-hari yang hangat dan helpful.`;
        dataContext = `Data jam operasional: ${JSON.stringify(data)}`;
        break;

      default:
        systemPrompt = `Kamu adalah asisten mall yang membantu user. Jawab berdasarkan data yang diberikan dengan ramah dan informatif.`;
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
      action: getActionForDataType(dataType), // Mobile navigation action
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

/*
COMPREHENSIVE MOBILE ACTIONS SYSTEM:

Response structure dengan action objects untuk berbagai interaksi mobile:
{
  "response": "Saya akan carikan menu dengan harga terjangkau untuk Anda.",
  "type": "request_data",
  "request": "get_menu",
  "intent": "menu_filter",
  "action": {
    "type": "filter",
    "target": "menu_screen", 
    "params": { "filter": "price_low", "category": "budget" }
  },
  "success": true
}

ACTION TYPES:

1. NAVIGATION ACTIONS:
   - type: "navigate"
   - target: screen name
   - params: navigation parameters

2. FILTER ACTIONS:
   - type: "filter" 
   - target: screen to filter
   - params: { filter: "category", value: "fast_food" }

3. DETAIL ACTIONS:
   - type: "navigate_detail"
   - target: detail screen
   - params: { view: "detailed", id: "item_id" }

4. POPUP/CONFIRMATION ACTIONS:
   - type: "show_popup"
   - target: popup type
   - params: { title: "...", message: "...", buttons: [...] }

5. FORM ACTIONS:
   - type: "open_form"
   - target: form type
   - params: { type: "feedback", prefill: {...} }

6. EXTERNAL ACTIONS:
   - type: "open_navigation"
   - target: "external_maps"
   - params: { mode: "directions", destination: "..." }

7. OPTIONS/SELECTION ACTIONS:
   - type: "show_options"
   - target: options type
   - params: { question: "...", options: [...] }

EXAMPLE FLOWS WITH OPTIONS:

1. USER: "detail menu"
   AI: "Detail menu mana yang ingin Anda lihat?"
   ACTION: show_options with menu choices
   USER: selects "McDonald's"
   AI: "Baik, saya akan tampilkan detail menu McDonald's"
   ACTION: navigate_detail to McDonald's page

2. USER: "booking"
   AI: "Reservasi untuk apa yang Anda butuhkan?"
   ACTION: show_options with booking types
   USER: selects "Reservasi Restoran"
   AI: "Apakah Anda yakin ingin melakukan reservasi restoran?"
   ACTION: show_popup for confirmation

MOBILE IMPLEMENTATION FOR OPTIONS:

```javascript
const handleAIResponse = (response) => {
  // Play AI voice response
  playTTS(response.response);
  
  if (response.action) {
    const { type, target, params } = response.action;
    
    switch(type) {
      case 'show_options':
        showOptionsDialog({
          title: params.question,
          options: params.options,
          onSelect: (selectedOption) => {
            // Send selection back to backend
            handleUserSelection(selectedOption.id, target, response.intent);
          }
        });
        break;
        
      // ... other action types
    }
  }
};

const handleUserSelection = async (optionId, optionType, originalIntent) => {
  const response = await fetch('/api/handle-selection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      optionId: optionId,
      optionType: optionType,
      originalIntent: originalIntent
    })
  });
  
  const result = await response.json();
  handleAIResponse(result); // Handle the follow-up action
};
```

MOBILE IMPLEMENTATION EXAMPLES:

```javascript
const handleAIResponse = (response) => {
  // Play AI voice response
  playTTS(response.response);
  
  // Handle action if exists
  if (response.action) {
    const { type, target, params } = response.action;
    
    switch(type) {
      case 'navigate':
        navigation.navigate(target, params);
        break;
        
      case 'filter':
        navigation.navigate(target, { 
          applyFilter: params.filter,
          filterValue: params.value 
        });
        break;
        
      case 'navigate_detail':
        navigation.navigate(target, { 
          detailView: params.view,
          itemId: params.id 
        });
        break;
        
      case 'show_popup':
        showPopup({
          title: params.title,
          message: params.message,
          buttons: params.buttons,
          onConfirm: () => handleConfirmation(response.request)
        });
        break;
        
      case 'open_form':
        navigation.navigate('FormScreen', {
          formType: params.type,
          prefillData: params.prefill
        });
        break;
        
      case 'open_navigation':
        if (target === 'external_maps') {
          openExternalMaps(params);
        }
        break;
        
      case 'emergency_call':
        initiateEmergencyCall(params);
        break;
    }
  }
  
  // Continue with data fetching if needed
  if (response.type === 'request_data') {
    fetchDataAndGetFinalResponse(response.request);
  }
};
```

EXAMPLE USE CASES:

1. "menu murah" → Filter menu by price
2. "detail menu McDonald's" → Navigate to McDonald's detail page
3. "booking meja" → Show confirmation popup
4. "komplain" → Open feedback form
5. "panggil security" → Emergency call action
6. "arah ke mall" → Open external navigation

FLOW PENGGUNAAN DENGAN COMPREHENSIVE ACTIONS:

1. User: "saya mau lihat menu makanan"
   POST /api/chat
   Response: {
     "response": "Oke, tunggu sebentar ya...",
     "type": "request_data", 
     "request": "get_menu"
   }

2. Frontend fetch data dari dummy endpoint:
   let fetchedData;
   if (data.request === 'get_menu') {
     fetchedData = await fetch('http://localhost:3001/api/dummy/menu');
   } else if (data.request === 'get_stores') {
     fetchedData = await fetch('http://localhost:3001/api/dummy/stores');
   } else if (data.request === 'get_events') {
     fetchedData = await fetch('http://localhost:3001/api/dummy/events');
   } else if (data.request === 'get_location') {
     fetchedData = await fetch('http://localhost:3001/api/dummy/location');
   } else if (data.request === 'get_parking') {
     fetchedData = await fetch('http://localhost:3001/api/dummy/parking');
   } else if (data.request === 'get_hours') {
     fetchedData = await fetch('http://localhost:3001/api/dummy/hours');
   }

3. Frontend kirim data ke AI:
   POST /api/chat-with-data
   Body: {
     "originalMessage": "saya mau lihat menu makanan",
     "dataType": "get_menu",
     "data": fetchedData
   }
   Response: {
     "response": "Berikut menu yang tersedia di mall kami: McDonald's di Ground Floor untuk fast food...",
     "type": "data_response"
   }
*/

// Test intent detection endpoint

// Test intent detection endpoint
app.post('/api/test-intent', (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'No message provided' });
  }
  
  const intentResult = detectIntent(message);
  
  res.json({
    message: message,
    detected_intent: intentResult,
    success: true
  });
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