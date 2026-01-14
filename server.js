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

// AI-powered intent detection using OpenAI
const detectIntentWithActions = async (message) => {
  try {
    console.log('🤖 AI analyzing intent for:', message);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `
            Kamu adalah AI classifier untuk customer service mall. Analisis pesan user dan tentukan intent yang tepat.
            
            AVAILABLE INTENTS:
            AVAILABLE INTENTS:
            1. "get_stores" - User menanyakan tentang toko, belanja, shopping, tenant, brand, infostore, info store, daftar toko
            2. "get_rewards" - User menanyakan tentang poin, reward, membership, voucher, cashback, hadiah
            3. "general" - Pertanyaan umum, sapaan, atau topik lain selain toko dan reward
            4. "end" - User mengakhiri percakapan, berterima kasih, atau mengucapkan salam perpisahan

            RULES:
            - Jika ada kata toko/tenant/store/infostore → "get_stores"
            - Jika ada kata reward/poin/hadiah/voucher → "get_rewards"  
            - Jika sapaan/pertanyaan umum → "general"
            - Jika terima kasih/selamat tinggal/bye → "end"

            RESPONSE FORMAT (JSON only):
            {
              "intent": "get_menu",
              "confidence": 0.95,
              "reasoning": "User menanyakan tentang makanan di mall",
              "extracted_item": null
            }

            RULES:
            - Jawab HANYA dengan JSON, tidak ada text lain
            - confidence: 0.0-1.0 (seberapa yakin)
            - extracted_item: isi jika intent = "get_item_detail"
            - Gunakan bahasa Indonesia untuk reasoning
          `
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: 200,
      temperature: 0.1 // Low temperature for consistent classification
    });

    const aiResponse = completion.choices[0].message.content.trim();
    console.log('🤖 AI raw response:', aiResponse);

    // Parse AI response
    let aiIntent;
    try {
      aiIntent = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      // Return error response instead of fallback
      return {
        intent: 'error',
        type: 'general_response',
        message: 'Maaf, ada masalah teknis. Coba ulangi lagi ya.',
        action: null
      };
    }

    console.log('✅ AI detected intent:', aiIntent);

    // Handle AI intent directly (simplified for rewards only)
    const { intent, confidence, reasoning } = aiIntent;

    // If confidence is too low, use general response
    if (confidence < 0.6) {
      console.log('⚠️ Low confidence, using general response');
      return {
        intent: 'general',
        type: 'general_response',
        message: 'Maaf, saya kurang memahami maksud Anda. Bisa dijelaskan lebih detail?',
        action: null
      };
    }

    // Handle all 4 intents
    if (intent === 'get_rewards') {
      console.log('🧠 AI reasoning:', reasoning);
      console.log('📊 Confidence:', confidence);
      
      return {
        type: 'request_data',
        request: 'get_rewards',
        message: 'Tunggu sebentar, saya akan cek reward dan poin Anda.',
        action: { type: 'navigate', target: 'REWARDS_SCREEN', params: null },
        intent: 'reward'
      };
    }

    if (intent === 'get_stores') {
      console.log('🧠 AI reasoning:', reasoning);
      console.log('📊 Confidence:', confidence);
      
      return {
        type: 'request_data',
        request: 'get_stores',
        message: 'Baik, saya akan carikan informasi toko yang tersedia.',
        action: { type: 'navigate', target: 'DIRECTORY_SCREEN', params: null },
        intent: 'store'
      };
    }

    if (intent === 'general') {
      console.log('🧠 AI reasoning:', reasoning);
      console.log('📊 Confidence:', confidence);
      
      return {
        type: 'general_ai_response', // Special type untuk AI processing
        message: 'Processing general response...',
        action: null,
        intent: 'general'
      };
    }

    if (intent === 'end') {
      console.log('🧠 AI reasoning:', reasoning);
      console.log('📊 Confidence:', confidence);
      
      return {
        type: 'end_response',
        message: 'Terima kasih sudah menggunakan layanan kami.',
        action: null,
        intent: 'end'
      };
    }

    // Fallback (shouldn't happen with good AI prompt)
    return {
      intent: 'general',
      type: 'general_response', 
      message: 'Maaf, saya kurang memahami. Bisa dijelaskan lebih detail?',
      action: null
    };

  } catch (error) {
    console.error('❌ AI intent detection error:', error);
    // Return error response instead of fallback
    return {
      intent: 'error',
      type: 'general_response',
      message: 'Maaf, ada masalah teknis. Coba ulangi lagi ya.',
      action: null
    };
  }
};

// Helper function to get action for data type (for final response after data fetch)
const getActionForDataType = (dataType) => {
  const actionMap = {
    'get_stores': {
      type: 'navigate', 
      target: 'DIRECTORY_SCREEN',
      params: null
    },
    'get_rewards': {
      type: 'navigate',
      target: 'REWARDS_SCREEN',
      params: null
    },
  };
  
  return actionMap[dataType] || null;
};

// Direct Voice-to-AI endpoint (for mobile)
app.post('/api/voice-to-ai', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('📱 Direct voice-to-AI request:');
    console.log('- File size:', req.file.size, 'bytes');
    console.log('- MIME type:', req.file.mimetype);

    // Check if audio file is too small
    if (req.file.size < 1000) {
      console.log('⚠️ Audio file too small');
      return res.status(400).json({ 
        error: 'Audio file too small. Please record longer audio.',
        size: req.file.size 
      });
    }

    // Step 1: Speech-to-Text
    const tempFilePath = path.join(os.tmpdir(), `recording-${Date.now()}.webm`);
    fs.writeFileSync(tempFilePath, req.file.buffer);

    console.log('🎤 Converting speech to text...');
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
      language: 'id'
    });

    const transcriptionText = transcription.text;
    console.log('✅ Transcription:', transcriptionText);

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    // Step 2: Process with AI (same logic as /api/chat)
    console.log('🤖 Processing with AI...');
    
    // Detect user intent with mobile actions
    const intentResult = await detectIntentWithActions(transcriptionText);
    console.log('🎯 Detected intent:', intentResult);

    // If it's a data request, return structured response for mobile to handle
    if (intentResult.type === 'request_data') {
      return res.json({
        response: intentResult.message,
        type: intentResult.type,
        request: intentResult.request,
        intent: intentResult.intent,
        action: intentResult.action,
        transcription: transcriptionText, // Include for debugging (optional)
        success: true
      });
    }

    // If it's general response that needs AI processing
    if (intentResult.type === 'general_ai_response') {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `
              Kamu adalah customer service mall yang ramah dan natural.
              Berikan jawaban yang singkat dan jelas menggunakan bahasa Indonesia yang hangat dan friendly.
              Bicara seperti customer service sungguhan, bukan robot.
              Jika user menyapa (halo, selamat pagi, dll), balas dengan sapaan yang sesuai.
            `
          },
          {
            role: 'user',
            content: transcriptionText
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const aiResponse = completion.choices[0].message.content;
      console.log('✅ AI General Response:', aiResponse);

      return res.json({
        response: aiResponse,
        type: 'general_response',
        intent: intentResult.intent,
        action: intentResult.action,
        transcription: transcriptionText,
        success: true
      });
    }

    // For other responses (end, etc), return directly
    res.json({
      response: intentResult.message,
      type: intentResult.type,
      intent: intentResult.intent,
      action: intentResult.action,
      transcription: transcriptionText, // Include for debugging (optional)
      success: true
    });

  } catch (error) {
    console.error('❌ Voice-to-AI error:', error);
    res.status(500).json({
      error: 'Voice-to-AI processing failed',
      details: error.message
    });
  }
});

// Speech-to-Text endpoint (keep for web version)
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

// Mobile voice-to-AI with data endpoint
app.post('/api/voice-to-ai-with-data', async (req, res) => {
  try {
    const { originalMessage, dataType, data } = req.body;

    if (!originalMessage || !dataType || !data) {
      return res.status(400).json({ error: 'Missing required fields: originalMessage, dataType, data' });
    }

    console.log('📱 Voice-to-AI with data:', { originalMessage, dataType, data });

    // Create context-aware prompt based on data type (same logic as /api/chat-with-data)
    let systemPrompt = '';
    let dataContext = '';

    switch (dataType) {
      case 'get_rewards':
        systemPrompt = `
          Kamu adalah customer service mall yang ramah dan informatif.
          Sampaikan informasi reward dengan bahasa yang santai, sopan, dan mudah dipahami.
          Jangan pakai tanda baca seperti *[]/\ dan sebagainya
          Tugasmu:
          - Sebutkan poin yang dimiliki pelanggan saat ini.
          - Rekomendasikan maksimal 3 reward yang bisa ditukar.
          - Urutkan reward dari poin tertinggi ke terendah.
          - Jika reward yang didapatkan lebih dari 3, sarankan untuk melihat ke halaman reward.

          Gunakan format kalimat natural seperti customer service sungguhan.
          Contoh:
          "Saat ini ada beberapa reward menarik yang bisa Anda tukarkan antara lain Voucher Belanja 50.000 poin, Diskon Parkir 30.000 poin, dan Minuman Gratis 20.000 poin. Untuk reward lainnya silahkan kunjungi halaman reward"
        `;

        dataContext = `Data: ${JSON.stringify(data)}`;
        break;
      
      case 'get_stores': 
        systemPrompt = `
          Kamu adalah customer service mall yang ramah dan singkat.
          Tugasmu:
          - Langsung sebutkan 3 toko pertama dari data
          - Format: "nama toko di lantai X"
          - Jangan pakai pembukaan panjang
          - Akhiri dengan "Semoga informasi ini membantu"
          
          Contoh response:
          "Saat ini ada toko yang menarik antara lain Auntie Anne's di lantai LG, Biyan di Ground Floor, dan Dough Lab di lantai 2. Semoga informasi ini membantu!"
        `;

        dataContext = `Data: ${JSON.stringify(data)}`;
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
    console.log('✅ AI Response with data:', aiResponse);

    res.json({
      response: aiResponse,
      type: 'data_response',
      dataType: dataType,
      action: getActionForDataType(dataType), // Add action for mobile redirect
      success: true
    });

  } catch (error) {
    console.error('❌ Voice-to-AI with data error:', error);
    res.status(500).json({
      error: 'Failed to get AI response with data',
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