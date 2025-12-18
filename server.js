const express = require('express');
const multer = require('multer');
const OpenAI = require('openai');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const WebSocket = require('ws');
const crypto = require('crypto');
const http = require('http');

require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// WebSocket Server
const wss = new WebSocket.Server({ server });

// Store active connections
const clients = new Map();

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

// WebSocket Connection Handler
wss.on('connection', (ws, req) => {
  const clientId = crypto.randomUUID();
  const clientInfo = {
    id: clientId,
    ws: ws,
    isRecording: false,
    audioChunks: [],
    connectedAt: new Date()
  };
  
  clients.set(clientId, clientInfo);
  console.log(`🔌 Client connected: ${clientId} (Total: ${clients.size})`);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection',
    clientId: clientId,
    message: 'Connected to Voice Chat AI WebSocket server'
  }));

  // Handle incoming messages
  ws.on('message', async (data) => {
    try {
      console.log(`📨 Raw message from ${clientId}:`, data instanceof Buffer ? 'Binary data' : 'Text data');
      await handleWebSocketMessage(clientId, data);
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: error.message
      }));
    }
  });

  // Handle connection close
  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`🔌 Client disconnected: ${clientId} (Total: ${clients.size})`);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
    clients.delete(clientId);
  });
});

// WebSocket Message Handler
async function handleWebSocketMessage(clientId, data) {
  const client = clients.get(clientId);
  if (!client) return;

  // Handle different message types
  if (data instanceof Buffer) {
    // Binary data - audio chunk
    await handleAudioChunk(clientId, data);
  } else {
    // Text data - JSON message
    const message = JSON.parse(data.toString());
    await handleTextMessage(clientId, message);
  }
}

// Handle audio chunks (streaming)
async function handleAudioChunk(clientId, audioData) {
  const client = clients.get(clientId);
  if (!client) return;

  console.log(`📨 Received audio data from ${clientId}: ${audioData.length} bytes`);

  // If recording is active, collect chunks
  if (client.isRecording) {
    client.audioChunks.push(audioData);
    
    // Send progress update
    client.ws.send(JSON.stringify({
      type: 'audio_chunk_received',
      chunkSize: audioData.length,
      totalChunks: client.audioChunks.length
    }));
  } else {
    // If recording stopped, this is the complete audio data
    console.log(`🎵 Processing complete audio data: ${audioData.length} bytes`);
    await processAudioBuffer(clientId, audioData);
  }
}

// Handle text messages
async function handleTextMessage(clientId, message) {
  const client = clients.get(clientId);
  if (!client) return;

  console.log(`📨 Text message from ${clientId}:`, message.type);

  switch (message.type) {
    case 'start_recording':
      await handleStartRecording(clientId);
      break;
      
    case 'stop_recording':
      await handleStopRecording(clientId);
      break;
      
    case 'process_audio':
      await handleProcessAudio(clientId, message.audioData, message.mimeType);
      break;
      
    case 'chat_message':
      await handleChatMessage(clientId, message.text);
      break;
      
    case 'ping':
      client.ws.send(JSON.stringify({ type: 'pong' }));
      break;
      
    default:
      console.log('Unknown message type:', message.type);
  }
}

// Start recording handler
async function handleStartRecording(clientId) {
  const client = clients.get(clientId);
  if (!client) return;

  client.isRecording = true;
  client.audioChunks = [];
  
  client.ws.send(JSON.stringify({
    type: 'recording_started',
    message: 'Recording started'
  }));
}

// Stop recording handler
async function handleStopRecording(clientId) {
  const client = clients.get(clientId);
  if (!client) return;

  client.isRecording = false;
  
  if (client.audioChunks.length > 0) {
    // Combine audio chunks
    const totalLength = client.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedAudio = Buffer.concat(client.audioChunks, totalLength);
    
    // Process the combined audio
    await processAudioBuffer(clientId, combinedAudio);
  }
  
  client.ws.send(JSON.stringify({
    type: 'recording_stopped',
    message: 'Recording stopped'
  }));
}

// Handle process audio (from base64 data)
async function handleProcessAudio(clientId, base64AudioData, mimeType) {
  const client = clients.get(clientId);
  if (!client) return;

  // Prevent multiple processing for the same client
  if (client.isProcessing) {
    console.log(`🎵 Client ${clientId} already processing audio, skipping...`);
    return;
  }

  try {
    client.isProcessing = true;
    console.log(`🎵 Processing audio from ${clientId}: ${base64AudioData.length} chars base64`);
    console.log(`🎵 MIME type: ${mimeType}`);
    console.log(`🎵 First 100 chars of base64: ${base64AudioData.substring(0, 100)}`);
    
    // Validate base64 data
    if (!base64AudioData || base64AudioData.length < 100) {
      throw new Error('Audio data too small or invalid');
    }
    
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(base64AudioData, 'base64');
    console.log(`🎵 Converted to buffer: ${audioBuffer.length} bytes`);
    
    // Process the audio buffer
    await processAudioBuffer(clientId, audioBuffer);
    
  } catch (error) {
    console.error('Process audio error:', error);
    client.ws.send(JSON.stringify({
      type: 'error',
      error: 'Failed to process audio: ' + error.message
    }));
  } finally {
    client.isProcessing = false;
  }
}

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

// Convert raw audio buffer to WAV format
function convertToWav(audioBuffer, sampleRate = 44100, channels = 1) {
  const length = audioBuffer.length;
  const arrayBuffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * 2, true);
  
  // Convert audio data to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, audioBuffer[i] || 0));
    view.setInt16(offset, sample * 0x7FFF, true);
    offset += 2;
  }
  
  return Buffer.from(arrayBuffer);
}

// Process audio buffer
async function processAudioBuffer(clientId, audioBuffer) {
  const client = clients.get(clientId);
  if (!client) return;

  let tempFilePath = null;

  try {
    // Send processing status
    client.ws.send(JSON.stringify({
      type: 'processing_audio',
      message: 'Converting speech to text...'
    }));

    console.log(`🎵 Processing audio buffer: ${audioBuffer.length} bytes`);
    
    // Check minimum size
    if (audioBuffer.length < 1000) {
      throw new Error('Audio file too small (less than 1KB)');
    }
    
    // Log first few bytes to understand the format
    const header = audioBuffer.slice(0, 16);
    const headerHex = header.toString('hex');
    console.log(`🎵 Audio header: ${headerHex}`);

    // Always save as WebM since that's what most browsers produce
    let fileExtension = 'webm';
    
    // Check if it's a WAV file
    if (headerHex.startsWith('52494646') && headerHex.includes('57415645')) {
      console.log('🎵 Detected WAV format');
      fileExtension = 'wav';
    } else if (headerHex.startsWith('1a45dfa3')) {
      console.log('🎵 Detected WebM format');
      fileExtension = 'webm';
    } else if (headerHex.startsWith('000000')) {
      console.log('🎵 Detected MP4/M4A format');
      fileExtension = 'm4a';
    } else {
      console.log('🎵 Unknown format, trying as WebM');
      fileExtension = 'webm';
    }

    // Create temporary file with appropriate extension
    tempFilePath = path.join(os.tmpdir(), `recording-${clientId}-${Date.now()}.${fileExtension}`);
    fs.writeFileSync(tempFilePath, audioBuffer);

    console.log(`🎵 Temp file created: ${tempFilePath} (${audioBuffer.length} bytes)`);

    // Simple approach - just try to process the file as-is
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
      language: 'id'
    });

    console.log(`🎵 Transcription successful: "${transcription.text}"`);

    // Send transcription result
    client.ws.send(JSON.stringify({
      type: 'transcription_complete',
      text: transcription.text
    }));

    // Process with AI
    await handleChatMessage(clientId, transcription.text);

  } catch (error) {
    console.error('Audio processing error:', error);
    console.error('Error details:', error.response?.data || error.message);
    
    let errorMessage = '';
    console.log({error})
    if (error.message.includes('Invalid file format') || error.message.includes('invalid_request_error')) {
      errorMessage = 'Format audio tidak valid. Browser Anda mungkin menggunakan format yang tidak kompatibel. Coba refresh halaman atau gunakan browser Chrome/Firefox.';
    } else if (error.message.includes('too short')) {
      errorMessage = 'Audio terlalu pendek. Bicara lebih lama (minimal 1 detik).';
    } else if (error.message.includes('no audio')) {
      errorMessage = 'Tidak ada audio yang terdeteksi. Periksa mikrofon Anda.';
    } else {
        errorMessage = 'Gagal memproses audio';
    }
    
    if (errorMessage) {
        client.ws.send(JSON.stringify({
          type: 'error',
          error: errorMessage
        }));
    }
  } finally {
    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`🎵 Temp file cleaned up: ${tempFilePath}`);
      } catch (cleanupError) {
        console.error('Failed to cleanup temp file:', cleanupError);
      }
    }
  }
}

// Handle chat message
async function handleChatMessage(clientId, text) {
  const client = clients.get(clientId);
  if (!client) return;

  try {
    // Send processing status
    client.ws.send(JSON.stringify({
      type: 'ai_thinking',
      message: 'AI is thinking...'
    }));

    // Get AI response
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `Anda adalah asisten AI yang membantu dalam bahasa Indonesia. 
          Berikan jawaban yang informatif dan ramah. 
          Serta gunakan bahasa gaul yang tidak terlalu formal.
          Gunakan kata gue dan lo untuk kata ganti saya dan anda.
          Gunakan intonasi nada semanusiawi mungkin, bahkan boleh memberikan jeda seperti "hmm" atau "jadi gini.." atau apapun
          `
        },
        {
          role: 'user',
          content: text
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const aiResponse = completion.choices[0].message.content;

    // Send AI response
    client.ws.send(JSON.stringify({
      type: 'ai_response',
      text: aiResponse
    }));

    // Convert to speech
    await handleTextToSpeech(clientId, aiResponse);

  } catch (error) {
    console.error('Chat error:', error);
    client.ws.send(JSON.stringify({
      type: 'error',
      error: 'Failed to get AI response: ' + error.message
    }));
  }
}

// Handle Text-to-Speech
async function handleTextToSpeech(clientId, text) {
  const client = clients.get(clientId);
  if (!client) return;

  try {
    // Send TTS processing status
    client.ws.send(JSON.stringify({
      type: 'tts_processing',
      message: 'Converting text to speech...'
    }));

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: text,
      speed: 1.0
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    // Send audio data as base64
    const audioBase64 = buffer.toString('base64');
    
    client.ws.send(JSON.stringify({
      type: 'tts_complete',
      audioData: audioBase64,
      mimeType: 'audio/mpeg'
    }));

  } catch (error) {
    console.error('TTS error:', error);
    client.ws.send(JSON.stringify({
      type: 'error',
      error: 'Failed to convert text to speech: ' + error.message
    }));
  }
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

server.listen(PORT, () => {
  console.log(`🚀 Voice Chat AI Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket Server running on ws://localhost:${PORT}`);
  console.log(`📝 OpenAI API Key configured: ${!!process.env.OPENAI_API_KEY}`);
});