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




// Chat with AI endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'No message provided' });
    }

    console.log('Processing chat message:', message);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `
            Kamu adalah asisten aplikasi mall.
                ATURAN WAJIB:
                - Selalu jaga konteks pembicaraan terakhir
                - Jika user bertanya ambigu, hubungkan ke topik sebelumnya
                - Jika masih ambigu, minta klarifikasi singkat
                - Fokus ke tenant, event, dan promo mall ini
                - Jangan mengubah topik tanpa alasan
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
      model: 'gpt-4o-mini-tts',
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