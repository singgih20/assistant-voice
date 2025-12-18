# Voice Chat AI

Aplikasi fullstack Voice Chat AI yang memungkinkan user berbicara dengan AI menggunakan suara. Aplikasi ini menggunakan Speech-to-Text untuk mengkonversi suara menjadi teks, kemudian mengirimkannya ke OpenAI untuk mendapatkan respons AI.

## Fitur

- 🎤 **Speech-to-Text**: Konversi suara ke teks menggunakan OpenAI Whisper
- 🤖 **AI Chat**: Integrasi dengan OpenAI GPT untuk respons AI yang cerdas
- 🔊 **Text-to-Speech**: AI membalas dengan suara natural menggunakan OpenAI TTS
- 🎨 **UI Modern**: Interface React.js yang clean dan responsive
- 📱 **Mobile Friendly**: Mendukung touch events untuk perangkat mobile
- 🎵 **Audio Visualizer**: Indikator visual saat merekam
- ⏱️ **Countdown Timer**: Visual feedback untuk durasi minimum recording
- 🎛️ **TTS Controls**: Toggle suara AI dan kontrol audio playback

## Teknologi

### Backend
- Node.js + Express
- OpenAI API (Whisper + GPT + TTS)
- Multer untuk file upload
- CORS untuk cross-origin requests
- Audio streaming untuk TTS

### Frontend
- React.js
- Web Audio API
- MediaRecorder API
- CSS3 dengan animasi
- Component-based architecture

## Setup & Installation

### 1. Install Dependencies

Backend:
```bash
npm install
```

Frontend (React):
```bash
cd client && npm install
```

### 2. Konfigurasi Environment
```bash
cp .env.example .env
```

Edit file `.env` dan tambahkan OpenAI API key Anda:
```
OPENAI_API_KEY=sk-your-actual-openai-api-key
PORT=3001
```

### 3. Jalankan Aplikasi

**Development mode (Backend + Frontend):**
```bash
npm run dev:full
```

**Atau jalankan terpisah:**

Backend only:
```bash
npm run dev
```

Frontend only (terminal baru):
```bash
npm run client
```

**Production mode:**
```bash
npm run build
npm start
```

Aplikasi akan berjalan di:
- **Frontend**: `http://localhost:3000` (development)
- **Backend API**: `http://localhost:3001`

## Cara Penggunaan

1. Buka aplikasi di browser
2. Izinkan akses mikrofon ketika diminta
3. **Aktifkan "🔊 Suara AI"** jika ingin AI membalas dengan suara
4. **Tekan dan tahan** tombol "Tekan & Tahan untuk Bicara"
5. **Tunggu countdown** selesai (minimal 1 detik)
6. **Bicara dengan jelas**
7. **Lepas tombol** untuk mengirim audio
8. AI akan membalas dengan teks dan suara (jika TTS aktif)
9. Gunakan tombol "⏹️ Stop Audio" untuk menghentikan suara AI

## API Endpoints

### `POST /api/speech-to-text`
Mengkonversi file audio menjadi teks
- **Input**: File audio (multipart/form-data)
- **Output**: `{ text: string, success: boolean }`

### `POST /api/chat`
Mengirim pesan ke AI dan mendapatkan respons
- **Input**: `{ message: string }`
- **Output**: `{ response: string, success: boolean }`

### `POST /api/text-to-speech`
Mengkonversi teks menjadi audio
- **Input**: `{ text: string }`
- **Output**: Audio file (MP3 stream)

### `GET /api/health`
Health check endpoint
- **Output**: `{ status: string, timestamp: string, openai_configured: boolean }`

## Struktur Project

```
voice-chat-ai/
├── server.js                 # Backend Express server
├── package.json              # Backend dependencies
├── .env                      # Environment config
├── TROUBLESHOOTING.md       # Troubleshooting guide
└── client/                   # React frontend
    ├── src/
    │   ├── components/       # React components
    │   │   ├── VoiceChatAI.js
    │   │   ├── ChatMessages.js
    │   │   ├── RecordButton.js
    │   │   └── AudioVisualizer.js
    │   ├── App.js           # Root component
    │   └── App.css          # Global styles
    ├── public/              # Static files
    └── package.json         # Frontend dependencies
```

## Browser Support

- Chrome/Chromium 60+
- Firefox 55+
- Safari 11+
- Edge 79+

**Note**: Fitur perekaman audio memerlukan HTTPS di production atau localhost untuk development.

## Troubleshooting

### Dokumentasi Tambahan

- [TTS_GUIDE.md](./TTS_GUIDE.md) - Panduan lengkap fitur Text-to-Speech
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Panduan mengatasi masalah umum
- [QUICK_START.md](./QUICK_START.md) - Panduan cepat memulai

### Troubleshooting

Lihat [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) untuk panduan lengkap mengatasi masalah umum:

- Audio recording issues
- "Audio file is too short" error
- Microphone permission problems
- Browser compatibility
- Server connection issues

### Tips Singkat

**Audio terlalu pendek:**
- Tahan tombol minimal 1 detik penuh
- Tunggu countdown selesai sebelum berbicara
- Bicara dengan volume yang cukup

**Mikrofon tidak berfungsi:**
- Periksa browser permission
- Test mikrofon di system settings
- Reload halaman setelah memberikan permission

**Server error:**
- Periksa OpenAI API key di `.env`
- Pastikan API key memiliki credit
- Restart server dengan `npm run dev`

## Development

Untuk development, gunakan:
```bash
npm run dev:full
```

Ini akan menjalankan:
- Backend server (port 3001) dengan nodemon
- React development server (port 3000) dengan hot reload

## Production Deployment

1. Build React app:
```bash
npm run build
```

2. Set environment variable:
```bash
export NODE_ENV=production
```

3. Start server:
```bash
npm start
```

Server akan serve React build files dari `client/build`.

## License

MIT License