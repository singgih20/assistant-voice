# Troubleshooting Guide

## Audio Recording Issues

### Error: "Audio file is too short"

**Penyebab:**
- Tombol mikrofon tidak ditahan cukup lama
- Audio tidak terekam dengan benar
- Browser tidak mendukung format audio yang digunakan

**Solusi:**
1. **Tahan tombol mikrofon minimal 1 detik penuh**
   - Tunggu hingga countdown selesai (0 detik)
   - Baru lepas tombol setelah melihat pesan "Lepas tombol untuk berhenti"

2. **Bicara dengan jelas saat merekam**
   - Pastikan mikrofon aktif dan tidak di-mute
   - Bicara dengan volume yang cukup
   - Hindari background noise yang terlalu besar

3. **Periksa browser compatibility**
   - Gunakan Chrome/Chromium 60+ (recommended)
   - Firefox 55+
   - Safari 11+
   - Edge 79+

4. **Periksa permission mikrofon**
   - Pastikan browser memiliki akses ke mikrofon
   - Cek settings browser untuk permission
   - Reload halaman setelah memberikan permission

### Error: "Speech-to-text failed"

**Penyebab:**
- OpenAI API key tidak valid atau expired
- Audio quality terlalu rendah
- Network connection issues

**Solusi:**
1. **Periksa OpenAI API Key**
   ```bash
   # Edit .env file
   OPENAI_API_KEY=sk-your-valid-key-here
   ```
   - Pastikan API key valid dan memiliki credit
   - Cek di https://platform.openai.com/account/api-keys

2. **Periksa audio quality**
   - Gunakan mikrofon yang baik
   - Hindari background noise
   - Bicara dengan jelas dan tidak terlalu cepat

3. **Periksa network connection**
   - Pastikan koneksi internet stabil
   - Cek firewall tidak memblokir request ke OpenAI

### Error: "Tidak dapat mendeteksi suara"

**Penyebab:**
- Tidak ada suara yang terekam
- Volume mikrofon terlalu rendah
- Mikrofon tidak berfungsi

**Solusi:**
1. **Test mikrofon**
   - Buka browser settings dan test mikrofon
   - Pastikan level audio terdeteksi saat berbicara
   - Coba mikrofon di aplikasi lain untuk memastikan berfungsi

2. **Tingkatkan volume mikrofon**
   - Buka system settings
   - Tingkatkan input volume mikrofon
   - Pastikan tidak di-mute

3. **Gunakan mikrofon eksternal**
   - Jika built-in mic bermasalah, gunakan headset/mic eksternal
   - Pastikan device yang benar dipilih di browser

## Tips untuk Recording yang Baik

1. **Durasi Recording**
   - Minimal: 1 detik
   - Optimal: 2-5 detik
   - Maksimal: 30 detik (untuk performa terbaik)

2. **Kualitas Audio**
   - Bicara dengan jelas dan tidak terlalu cepat
   - Jarak mikrofon 10-30 cm dari mulut
   - Hindari background noise
   - Gunakan ruangan yang relatif tenang

3. **Teknik Recording**
   - Tekan dan tahan tombol mikrofon
   - Tunggu countdown selesai (1 detik)
   - Mulai berbicara
   - Lepas tombol setelah selesai berbicara

4. **Browser Settings**
   - Gunakan HTTPS atau localhost
   - Allow microphone permission
   - Disable browser extensions yang mungkin interfere
   - Clear cache jika ada masalah

## Server Issues

### Proxy Error (React Development)

**Error:** `Proxy error: Could not proxy request /api/health from localhost:3000 to http://localhost:3000`

**Penyebab:**
- Backend server tidak berjalan
- Proxy configuration salah
- Port conflict

**Solusi:**
1. **Pastikan backend server berjalan di port 3001:**
   ```bash
   npm run dev
   # Should show: Voice Chat AI Server running on http://localhost:3001
   ```

2. **Periksa proxy configuration di `client/package.json`:**
   ```json
   "proxy": "http://localhost:3001"
   ```

3. **Restart React dev server setelah mengubah proxy:**
   ```bash
   cd client
   npm start
   ```

4. **Jika masih error, restart kedua server:**
   ```bash
   # Stop semua process dengan Ctrl+C
   # Lalu jalankan ulang
   npm run dev:full
   ```

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3001`

**Solusi:**
```bash
# Cari process yang menggunakan port
lsof -i :3001

# Kill process (ganti PID dengan process ID yang sebenarnya)
kill -9 <PID>

# Restart server
npm run dev
```

### Server tidak dapat diakses

**Solusi:**
```bash
# Restart server
npm run dev

# Periksa port
lsof -i :3001

# Kill process jika port sudah digunakan
kill -9 <PID>
```

### OpenAI API Error

**Solusi:**
1. Periksa API key di `.env`
2. Periksa credit balance di OpenAI dashboard
3. Periksa rate limits
4. Tunggu beberapa saat jika ada temporary issues

## Browser Console Debugging

Buka browser console (F12) untuk melihat error details:

```javascript
// Check if MediaRecorder is supported
console.log('MediaRecorder supported:', typeof MediaRecorder !== 'undefined');

// Check supported MIME types
console.log('WebM Opus:', MediaRecorder.isTypeSupported('audio/webm;codecs=opus'));
console.log('WebM:', MediaRecorder.isTypeSupported('audio/webm'));
console.log('MP4:', MediaRecorder.isTypeSupported('audio/mp4'));

// Check microphone permission
navigator.permissions.query({ name: 'microphone' })
  .then(result => console.log('Mic permission:', result.state));
```

## Kontak Support

Jika masalah masih berlanjut:
1. Cek logs di browser console
2. Cek logs di server terminal
3. Pastikan semua dependencies terinstall dengan benar
4. Coba restart browser dan server