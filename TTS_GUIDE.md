# Text-to-Speech (TTS) Guide

## Fitur Baru: AI Membalas dengan Suara! 🔊

Aplikasi Voice Chat AI sekarang dilengkapi dengan fitur Text-to-Speech (TTS) yang memungkinkan AI membalas tidak hanya dengan teks, tetapi juga dengan suara yang natural.

## Cara Kerja

1. **User berbicara** → Speech-to-Text (STT) → Teks
2. **AI memproses** → Generate response text
3. **Text-to-Speech** → AI response menjadi audio
4. **Audio diputar** → User mendengar suara AI

## Fitur TTS

### Voice Model
- **Model**: OpenAI TTS-1
- **Voice**: Nova (suara wanita yang natural)
- **Kualitas**: High-quality audio dengan intonasi yang baik
- **Bahasa**: Mendukung bahasa Indonesia dengan baik

### Kontrol TTS
- **Toggle Switch**: Aktifkan/nonaktifkan suara AI
- **Stop Button**: Hentikan audio yang sedang diputar
- **Visual Feedback**: Indikator saat AI sedang bicara

## Cara Menggunakan

### 1. Aktivasi TTS
- Centang checkbox "🔊 Suara AI" untuk mengaktifkan
- Uncheck untuk menonaktifkan (hanya teks)

### 2. Interaksi Normal
1. Tekan dan tahan tombol mikrofon
2. Bicara dengan jelas
3. Lepas tombol
4. AI akan membalas dengan teks DAN suara (jika TTS aktif)

### 3. Kontrol Audio
- **Saat AI bicara**: Tombol mikrofon disabled
- **Stop audio**: Klik tombol "⏹️ Stop Audio"
- **Status**: Lihat status "AI Sedang Bicara..."

## Status Indicators

| Status | Deskripsi |
|--------|-----------|
| "Mengkonversi teks ke suara..." | TTS sedang memproses |
| "Memuat audio..." | Audio sedang di-load |
| "Memutar suara AI..." | Audio sedang diputar |
| "AI Sedang Bicara..." | Tombol dalam mode speaking |

## Keunggulan

### 1. Natural Voice
- Suara yang natural dan mudah dipahami
- Intonasi yang sesuai dengan konteks
- Pronunciation bahasa Indonesia yang baik

### 2. User Experience
- Hands-free listening
- Multitasking friendly
- Accessibility untuk visual impairment

### 3. Interactive
- Real-time audio streaming
- Kontrol penuh (play/stop)
- Visual feedback yang jelas

## Technical Details

### Backend (server.js)
```javascript
// TTS Endpoint
app.post('/api/text-to-speech', async (req, res) => {
  const mp3 = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',
    input: text,
    speed: 1.0
  });
  // Stream audio back to client
});
```

### Frontend (React)
```javascript
// TTS Function
const textToSpeech = async (text) => {
  const response = await fetch('/api/text-to-speech', {
    method: 'POST',
    body: JSON.stringify({ text })
  });
  
  const audioBlob = await response.blob();
  const audio = new Audio(URL.createObjectURL(audioBlob));
  await audio.play();
};
```

## Voice Options

OpenAI TTS menyediakan 6 pilihan suara:

| Voice | Karakteristik |
|-------|---------------|
| **nova** | ✅ Default - Suara wanita, natural |
| alloy | Suara netral, versatile |
| echo | Suara pria, clear |
| fable | Suara wanita, expressive |
| onyx | Suara pria, deep |
| shimmer | Suara wanita, soft |

### Mengganti Voice
Edit di `server.js`:
```javascript
const mp3 = await openai.audio.speech.create({
  model: 'tts-1',
  voice: 'echo', // Ganti dengan pilihan lain
  input: text,
  speed: 1.0
});
```

## Troubleshooting

### Audio Tidak Diputar
**Penyebab:**
- Browser tidak mendukung audio autoplay
- Network error saat download audio
- TTS API error

**Solusi:**
1. Pastikan browser mengizinkan autoplay
2. Cek network connection
3. Lihat browser console untuk error
4. Restart server jika perlu

### Audio Terpotong
**Penyebab:**
- User menekan stop terlalu cepat
- Network interruption

**Solusi:**
1. Tunggu audio selesai secara natural
2. Gunakan tombol stop hanya jika perlu
3. Cek koneksi internet

### TTS Lambat
**Penyebab:**
- OpenAI API latency
- Teks terlalu panjang
- Network slow

**Solusi:**
1. Tunggu proses selesai
2. Batasi panjang respons AI
3. Cek koneksi internet

### Error "Text-to-speech failed"
**Penyebab:**
- OpenAI API key tidak valid
- API quota exceeded
- Server error

**Solusi:**
1. Periksa API key di `.env`
2. Cek quota di OpenAI dashboard
3. Restart server
4. Lihat server logs untuk detail

## Performance Tips

### 1. Optimize Response Length
- Batasi max_tokens di chat completion
- Respons pendek = TTS lebih cepat

### 2. Network Optimization
- Gunakan koneksi internet yang stabil
- Avoid concurrent TTS requests

### 3. User Experience
- Berikan feedback visual yang jelas
- Allow user control (stop/pause)
- Handle errors gracefully

## Future Enhancements

### Possible Improvements
1. **Voice Selection**: UI untuk memilih voice
2. **Speed Control**: Slider untuk mengatur kecepatan
3. **Audio Caching**: Cache audio untuk respons yang sama
4. **Offline TTS**: Fallback ke browser TTS
5. **Audio Visualization**: Waveform saat audio diputar

### Advanced Features
1. **Emotion Detection**: Adjust voice tone based on content
2. **Multi-language**: Auto-detect language for TTS
3. **Voice Cloning**: Custom voice training
4. **Real-time TTS**: Stream audio while generating

## API Costs

### OpenAI TTS Pricing
- **Model**: TTS-1
- **Cost**: $0.015 per 1K characters
- **Example**: 100 kata ≈ 500 karakter ≈ $0.0075

### Cost Optimization
1. Limit response length
2. Cache common responses
3. Use TTS selectively
4. Monitor usage in OpenAI dashboard

## Conclusion

Fitur TTS membuat aplikasi Voice Chat AI menjadi lebih interaktif dan natural. User dapat berkomunikasi dengan AI layaknya percakapan manusia - bicara dan mendengar, bukan hanya membaca teks.

Kombinasi STT + AI Chat + TTS menciptakan pengalaman conversational AI yang lengkap dan immersive! 🎉