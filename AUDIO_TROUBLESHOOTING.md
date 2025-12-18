# Audio Processing Troubleshooting Guide

## Common Issues and Solutions

### 1. "Format audio tidak valid" Error

**Problem**: OpenAI Whisper API rejects the audio file format.

**Possible Causes**:
- Browser produces WebM format that OpenAI can't process
- Audio file is corrupted during base64 encoding/decoding
- Audio file is too small or empty

**Solutions**:
1. **Try different browsers**: Chrome and Firefox have better WebM support
2. **Check audio duration**: Ensure recording is at least 1 second long
3. **Refresh the page**: Sometimes MediaRecorder gets stuck

### 2. "Audio terlalu pendek" Error

**Problem**: Audio file is shorter than OpenAI's minimum requirement (0.1 seconds).

**Solutions**:
1. **Hold button longer**: Record for at least 1-2 seconds
2. **Speak clearly**: Ensure there's actual audio content
3. **Check microphone**: Make sure microphone is working

### 3. Multiple Processing Errors

**Problem**: Audio gets processed multiple times causing errors.

**Solutions**:
1. **Don't click rapidly**: Wait for processing to complete
2. **Check WebSocket connection**: Ensure stable connection
3. **Restart application**: Refresh browser if issues persist

## Browser Compatibility

### Recommended Browsers:
- ✅ **Chrome 80+**: Best WebM support
- ✅ **Firefox 75+**: Good WebM support
- ⚠️ **Safari**: Limited WebM support, may need fallback
- ❌ **Internet Explorer**: Not supported

### Audio Formats by Browser:
- **Chrome**: WebM with Opus codec
- **Firefox**: WebM with Opus codec
- **Safari**: MP4 with AAC codec

## Technical Details

### Supported Formats by OpenAI:
- WAV, MP3, MP4, MPEG, MPGA, M4A, OGG, WEBM, FLAC

### Current Implementation:
1. Browser records in WebM format
2. Client converts to base64
3. Server saves as temporary file
4. OpenAI Whisper processes the file

### Debug Information:
- Check browser console for client-side errors
- Check server logs for processing details
- Monitor WebSocket connection status

## Quick Fixes

1. **Refresh the page**
2. **Try a different browser**
3. **Check microphone permissions**
4. **Ensure stable internet connection**
5. **Record for at least 2 seconds**

## Advanced Troubleshooting

If issues persist, check:
1. Server logs for detailed error messages
2. Network tab in browser dev tools
3. WebSocket connection status
4. Audio file size and format in server logs