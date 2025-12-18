import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChatMessages from './ChatMessages';
import RecordButton from './RecordButton';
import AudioVisualizer from './AudioVisualizer';
import './VoiceChatAI.css';

const VoiceChatAI = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      content: 'Halo! Saya siap membantu Anda dengan WebSocket real-time connection. Tekan dan tahan tombol mikrofon minimal 1 detik, lalu bicara dengan jelas. Saya juga bisa membalas dengan suara!',
      type: 'ai',
      timestamp: new Date()
    }
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('Connecting...');
  const [isReady, setIsReady] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [enableTTS, setEnableTTS] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [clientId, setClientId] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingStartTimeRef = useRef(null);
  const currentAudioRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const minRecordingDuration = 1000; // 1 second

  useEffect(() => {
    initializeApp();
    return () => {
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeApp = async () => {
    try {
      // Check if browser supports required APIs
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser tidak mendukung perekaman audio');
      }

      // Initialize WebSocket connection
      await initializeWebSocket();
      
      // Request microphone permission
      await requestMicrophonePermission();
      
    } catch (error) {
      console.error('Initialization error:', error);
      setStatus(`Error: ${error.message}`);
    }
  };

  const initializeWebSocket = () => {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `ws://localhost:3001`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('🔌 WebSocket connected');
          setIsConnected(true);
          setStatus('Connected to server');
          resolve();
        };

        ws.onmessage = (event) => {
          handleWebSocketMessage(JSON.parse(event.data));
        };

        ws.onclose = () => {
          console.log('🔌 WebSocket disconnected');
          setIsConnected(false);
          setIsReady(false);
          setStatus('Disconnected from server');
          
          // Auto-reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            setStatus('Reconnecting...');
            initializeWebSocket();
          }, 3000);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setStatus('Connection error');
          reject(error);
        };

        // Connection timeout
        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  };

  const handleWebSocketMessage = useCallback((data) => {
    console.log('📨 WebSocket message received:', data.type || 'binary data');

    switch (data.type) {
      case 'connection':
        setClientId(data.clientId);
        setStatus('Connected - Ready to chat!');
        setIsReady(true);
        break;

      case 'recording_started':
        setStatus('Recording started...');
        break;

      case 'audio_chunk_received':
        setStatus(`Recording... (${data.totalChunks} chunks)`);
        break;

      case 'recording_stopped':
        setStatus('Processing audio...');
        break;

      case 'processing_audio':
        setStatus('Converting speech to text...');
        setIsProcessing(true);
        break;

      case 'transcription_complete':
        setStatus('Transcription complete');
        addMessage(data.text, 'user');
        break;

      case 'ai_thinking':
        setStatus('AI is thinking...');
        break;

      case 'ai_response':
        setStatus('AI response received');
        addMessage(data.text, 'ai');
        break;

      case 'tts_processing':
        setStatus('Converting text to speech...');
        setIsSpeaking(true);
        break;

      case 'tts_complete':
        setStatus('Playing AI voice...');
        if (enableTTS) {
          playAudioFromBase64(data.audioData, data.mimeType);
        } else {
          setIsSpeaking(false);
          setIsProcessing(false);
          setStatus('Ready to chat!');
        }
        break;

      case 'error':
        console.error('Server error:', data.error);
        setStatus(`Error: ${data.error}`);
        setIsProcessing(false);
        setIsSpeaking(false);
        
        // If WebSocket audio processing fails, we could fallback to REST API
        // But for now, just show the error
        break;

      case 'pong':
        // Heartbeat response
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  }, [enableTTS]);

  const sendWebSocketMessage = (message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.error('WebSocket not connected');
      setStatus('Not connected to server');
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      console.log('Microphone permission granted');
    } catch (error) {
      throw new Error('Akses mikrofon ditolak. Silakan izinkan akses mikrofon.');
    }
  };

  const startRecording = async () => {
    if (isRecording || !streamRef.current || !isReady || !isConnected) return;

    try {
      // Stop any currently playing AI audio
      stopAudioForRecording();

      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();
      
      // Use the most compatible format for OpenAI
      let mimeType = '';
      const supportedFormats = [
        'audio/wav',
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus'
      ];
      
      for (const format of supportedFormats) {
        if (MediaRecorder.isTypeSupported(format)) {
          mimeType = format;
          console.log(`🎤 Selected format: ${format}`);
          break;
        }
      }
      
      if (!mimeType) {
        console.log('🎤 No supported format found, using default');
      }
      
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000 // 128 kbps for better quality
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        processRecording();
      };

      // Start recording without timeslice to avoid multiple chunks
      mediaRecorderRef.current.start(); // Collect data only when stopped
      setIsRecording(true);
      
      // Notify server that recording started
      sendWebSocketMessage({ type: 'start_recording' });
      
      setStatus('🎤 Sedang merekam... (AI audio dihentikan)');
      
      // Show countdown feedback
      let countdown = Math.ceil(minRecordingDuration / 1000);
      const countdownInterval = setInterval(() => {
        if (!isRecording) {
          clearInterval(countdownInterval);
          return;
        }
        
        countdown--;
        if (countdown > 0) {
          setStatus(`🎤 Merekam... ${countdown} detik lagi`);
        } else {
          setStatus('🎤 Merekam... Lepas tombol untuk berhenti');
          clearInterval(countdownInterval);
        }
      }, 1000);
      
    } catch (error) {
      console.error('Recording start error:', error);
      setStatus('Error memulai perekaman');
    }
  };

  const stopRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return;

    const recordingDuration = Date.now() - recordingStartTimeRef.current;
    
    if (recordingDuration < minRecordingDuration) {
      // Recording too short, cancel it
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatus('Perekaman terlalu pendek. Tahan tombol minimal 1 detik');
      
      // Reset to ready state after showing warning
      setTimeout(() => {
        setStatus('Ready to chat!');
      }, 2000);
      return;
    }

    mediaRecorderRef.current.stop();
    setIsRecording(false);
    
    // Notify server that recording stopped
    sendWebSocketMessage({ type: 'stop_recording' });
    
    setStatus('Processing audio...');
  };

  // Convert audio blob to WAV format using Web Audio API
  const convertToWav = async (audioBlob) => {
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const fileReader = new FileReader();
      
      fileReader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Convert AudioBuffer to WAV
          const wavBuffer = audioBufferToWav(audioBuffer);
          const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
          
          resolve(wavBlob);
        } catch (error) {
          console.log('WAV conversion failed:', error);
          reject(error);
        }
      };
      
      fileReader.onerror = () => reject(new Error('Failed to read audio blob'));
      fileReader.readAsArrayBuffer(audioBlob);
    });
  };

  // Convert AudioBuffer to WAV format
  const audioBufferToWav = (buffer) => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;
    
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM format
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // 16-bit
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Convert audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return arrayBuffer;
  };

  const processRecording = async () => {
    // Prevent multiple processing
    if (isProcessing) {
      console.log('🎤 Already processing, skipping...');
      return;
    }

    console.log('🎤 Starting processRecording...');
    setIsProcessing(true);

    try {
      if (audioChunksRef.current.length === 0) {
        throw new Error('Tidak ada audio yang direkam');
      }

      // Get the MIME type from the MediaRecorder
      const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
      
      // Create audio blob with the correct MIME type
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      
      // Check if audio blob has sufficient size
      if (audioBlob.size < 2000) { // Less than 2KB is likely too short
        throw new Error('Audio terlalu pendek atau kosong. Pastikan Anda berbicara minimal 1 detik.');
      }
      
      // Additional check for recording duration
      const actualDuration = Date.now() - recordingStartTimeRef.current;
      if (actualDuration < minRecordingDuration) {
        throw new Error('Durasi perekaman terlalu pendek. Tahan tombol minimal 1 detik.');
      }
      
      console.log(`🎤 Audio blob created: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
      
      // Use original format without conversion for now
      // WAV conversion can sometimes create invalid files
      let finalBlob = audioBlob;
      let finalMimeType = mimeType;
      
      console.log(`🎤 Using original format: ${finalMimeType}, size: ${finalBlob.size} bytes`);
      
      // Convert blob to base64 and send via WebSocket
      const arrayBuffer = await finalBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to base64 in chunks to avoid stack overflow
      let base64Audio = '';
      const chunkSize = 32768; // 32KB chunks
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        base64Audio += btoa(String.fromCharCode(...chunk));
      }
      
      console.log(`🎤 Final audio format: ${finalMimeType}, size: ${finalBlob.size} bytes`);
      
      // Use REST API for audio processing (more stable than WebSocket)
      console.log(`📤 Sending audio data via REST API...`);
      setStatus('Processing audio via REST API...');
      
      // Create FormData with the audio blob
      const formData = new FormData();
      formData.append('audio', finalBlob, `recording.${finalMimeType.split('/')[1] || 'webm'}`);

      try {
        // Send to speech-to-text endpoint
        const response = await fetch('http://localhost:3001/api/speech-to-text', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Speech-to-text failed');
        }

        const data = await response.json();
        const transcriptionText = data.text;
        
        // Add user message
        addMessage(transcriptionText, 'user');
        
        // Get AI response via REST API
        setStatus('AI is thinking...');
        const chatResponse = await fetch('http://localhost:3001/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message: transcriptionText })
        });

        if (!chatResponse.ok) {
          const errorData = await chatResponse.json();
          throw new Error(errorData.error || 'AI chat failed');
        }

        const chatData = await chatResponse.json();
        const aiResponse = chatData.response;
        
        // Add AI message
        addMessage(aiResponse, 'ai');
        
        // Convert AI response to speech if TTS is enabled
        if (enableTTS) {
          setStatus('Converting text to speech...');
          setIsSpeaking(true);
          await textToSpeech(aiResponse);
        } else {
          setIsProcessing(false);
          setStatus('Ready to chat!');
        }
        
      } catch (restError) {
        console.error('REST API error:', restError);
        throw restError;
      }
      
    } catch (error) {
      console.error('Processing error:', error);
      
      // More specific error messages
      let errorMessage = error.message;
      if (error.message.includes('too short') || error.message.includes('0.1 seconds')) {
        errorMessage = 'Audio terlalu pendek. Tahan tombol minimal 1 detik dan bicara dengan jelas.';
      } else if (error.message.includes('kosong')) {
        errorMessage = 'Audio kosong atau terlalu pendek. Tahan tombol lebih lama saat berbicara.';
      }
      
      setStatus(`Error: ${errorMessage}`);
      setIsProcessing(false);
    } finally {
      console.log('🎤 processRecording completed');
    }
  };

  const textToSpeech = async (text) => {
    try {
      const response = await fetch('http://localhost:3001/api/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error('Text-to-speech failed');
      }

      // Get audio blob from response
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Create and play audio
      const audio = new window.Audio(audioUrl);
      currentAudioRef.current = audio;

      // Set up audio event listeners
      audio.onloadstart = () => {
        setStatus('Loading audio...');
      };

      audio.oncanplay = () => {
        setStatus('Playing AI voice...');
      };

      audio.onended = () => {
        setIsSpeaking(false);
        setIsProcessing(false);
        setStatus('Ready to chat!');
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        setIsProcessing(false);
        setStatus('Error playing audio');
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
      };

      // Play the audio
      await audio.play();

    } catch (error) {
      console.error('TTS error:', error);
      setIsSpeaking(false);
      setIsProcessing(false);
      setStatus('Error with text-to-speech');
    }
  };

  const playAudioFromBase64 = async (base64Data, mimeType) => {
    try {
      // Convert base64 to blob
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: mimeType });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Create and play audio
      const audio = new window.Audio(audioUrl);
      currentAudioRef.current = audio;

      // Set up audio event listeners
      audio.onloadstart = () => {
        setStatus('Loading audio...');
      };

      audio.oncanplay = () => {
        setStatus('Playing AI voice...');
      };

      audio.onended = () => {
        setIsSpeaking(false);
        setIsProcessing(false);
        setStatus('Ready to chat!');
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        setIsProcessing(false);
        setStatus('Error playing audio');
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
      };

      // Play the audio
      await audio.play();

    } catch (error) {
      console.error('Audio playback error:', error);
      setIsSpeaking(false);
      setIsProcessing(false);
      setStatus('Error playing audio');
    }
  };

  const addMessage = (content, type) => {
    const message = {
      id: Date.now() + Math.random(),
      content: content,
      type: type,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const stopCurrentAudio = () => {
    if (currentAudioRef.current) {
      console.log('🔇 Manually stopping AI audio...');
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
      setIsSpeaking(false);
      setIsProcessing(false);
      setStatus('Ready to chat!');
    }
  };

  // Function to stop AI audio when recording starts
  const stopAudioForRecording = () => {
    if (currentAudioRef.current) {
      console.log('🔇 Stopping AI audio for recording...');
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
      setIsSpeaking(false);
      // Don't reset isProcessing here as we're about to start recording
    }
  };

  return (
    <div className="voice-chat-container">
      <header className="header">
        <h1>🎤 Voice Chat AI</h1>
        <p>Bicara dengan AI menggunakan suara Anda</p>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          {clientId && <span className="client-id">ID: {clientId.substring(0, 8)}</span>}
        </div>
      </header>

      <main className="main-content">
        <ChatMessages messages={messages} />

        <div className="controls">
          <RecordButton
            isRecording={isRecording}
            isProcessing={isProcessing}
            isReady={isReady}
            isSpeaking={isSpeaking}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
          />
          
          <div className="tts-controls">
            <label className="tts-toggle">
              <input
                type="checkbox"
                checked={enableTTS}
                onChange={(e) => setEnableTTS(e.target.checked)}
              />
              <span>🔊 Suara AI</span>
            </label>
            
            {isSpeaking && !isRecording && (
              <button className="stop-audio-btn" onClick={stopCurrentAudio}>
                ⏹️ Stop Audio
              </button>
            )}
            
            {isRecording && (
              <div className="recording-info">
                🔇 AI audio dihentikan saat recording
              </div>
            )}
          </div>
          
          <div className="status">
            {status}
          </div>
        </div>

        <AudioVisualizer isVisible={isRecording} />
      </main>
    </div>
  );
};

export default VoiceChatAI;