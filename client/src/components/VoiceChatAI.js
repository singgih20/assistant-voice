import React, { useState, useEffect, useRef } from 'react';
import ChatMessages from './ChatMessages';
import RecordButton from './RecordButton';
import AudioVisualizer from './AudioVisualizer';
import './VoiceChatAI.css';

const VoiceChatAI = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      content: 'Halo! Saya siap membantu Anda. Tekan dan tahan tombol mikrofon minimal 1 detik, lalu bicara dengan jelas. Saya juga bisa membalas dengan suara!',
      type: 'ai',
      timestamp: new Date()
    }
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [isReady, setIsReady] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [enableTTS, setEnableTTS] = useState(true);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingStartTimeRef = useRef(null);
  const currentAudioRef = useRef(null);
  const minRecordingDuration = 1000; // 1 second

  useEffect(() => {
    initializeApp();
    return () => {
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const initializeApp = async () => {
    try {
      // Check if browser supports required APIs
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser tidak mendukung perekaman audio');
      }

      // Request microphone permission
      await requestMicrophonePermission();
      
      setStatus('Ready to chat!');
      setIsReady(true);
      
    } catch (error) {
      console.error('Initialization error:', error);
      setStatus(`Error: ${error.message}`);
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
    if (isRecording || !streamRef.current || !isReady) return;

    try {
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();
      
      // Try different MIME types for better compatibility
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Use default
          }
        }
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

      // Start recording with timeslice for consistent data chunks
      mediaRecorderRef.current.start(100); // Collect data every 100ms
      setIsRecording(true);
      setStatus('Sedang merekam... Tahan minimal 1 detik');
      
      // Show countdown feedback
      let countdown = Math.ceil(minRecordingDuration / 1000);
      const countdownInterval = setInterval(() => {
        if (!isRecording) {
          clearInterval(countdownInterval);
          return;
        }
        
        countdown--;
        if (countdown > 0) {
          setStatus(`Sedang merekam... ${countdown} detik lagi`);
        } else {
          setStatus('Sedang merekam... Lepas tombol untuk berhenti');
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
    setStatus('Processing audio...');
  };

  const processRecording = async () => {
    try {
      if (audioChunksRef.current.length === 0) {
        throw new Error('Tidak ada audio yang direkam');
      }

      // Create audio blob
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // Check if audio blob has sufficient size
      if (audioBlob.size < 2000) { // Less than 2KB is likely too short
        throw new Error('Audio terlalu pendek atau kosong. Pastikan Anda berbicara minimal 1 detik.');
      }
      
      // Additional check for recording duration
      const actualDuration = Date.now() - recordingStartTimeRef.current;
      if (actualDuration < minRecordingDuration) {
        throw new Error('Durasi perekaman terlalu pendek. Tahan tombol minimal 1 detik.');
      }
      
      console.log(`Audio blob size: ${audioBlob.size} bytes`);
      
      // Send to speech-to-text
      setStatus('Converting speech to text...');
      setIsProcessing(true);
      
      const transcriptionText = await speechToText(audioBlob);
      
      // Add user message
      addMessage(transcriptionText, 'user');
      
      // Get AI response
      setStatus('AI is thinking...');
      const aiResponse = await chatWithAI(transcriptionText);
      
      // Handle different response types
      if (aiResponse.needsFollowUp) {
        // Add initial AI message (e.g., "tunggu sebentar")
        addMessage(aiResponse.message, 'ai');
        
        // Convert initial response to speech if TTS is enabled
        if (enableTTS) {
          setStatus('Converting text to speech...');
          setIsSpeaking(true);
          
          // Create audio for initial response
          const response = await fetch('http://localhost:3001/api/text-to-speech', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: aiResponse.message })
          });

          if (response.ok) {
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = document.createElement('audio');
            audio.src = audioUrl;
            currentAudioRef.current = audio;

            // Set up audio event listeners
            audio.onloadstart = () => {
              setStatus('Loading audio...');
            };

            audio.oncanplay = () => {
              setStatus('Playing AI voice...');
            };

            audio.onended = async () => {
              setIsSpeaking(false);
              URL.revokeObjectURL(audioUrl);
              currentAudioRef.current = null;
              
              // After initial message is spoken, handle follow-up
              await handleFollowUpResponse(aiResponse.originalMessage, aiResponse.requestType);
            };

            audio.onerror = async () => {
              setIsSpeaking(false);
              URL.revokeObjectURL(audioUrl);
              currentAudioRef.current = null;
              
              // Even if audio fails, continue with follow-up
              await handleFollowUpResponse(aiResponse.originalMessage, aiResponse.requestType);
            };

            // Play the initial audio
            await audio.play();
          } else {
            // If TTS fails, continue with follow-up
            setIsSpeaking(false);
            await handleFollowUpResponse(aiResponse.originalMessage, aiResponse.requestType);
          }
        } else {
          // If TTS is disabled, immediately handle follow-up
          await handleFollowUpResponse(aiResponse.originalMessage, aiResponse.requestType);
        }
      } else {
        // Regular response without follow-up
        addMessage(aiResponse.message, 'ai');
        
        // Convert AI response to speech if TTS is enabled
        if (enableTTS) {
          setStatus('Converting text to speech...');
          setIsSpeaking(true);
          await textToSpeech(aiResponse.message);
        } else {
          setIsProcessing(false);
          setStatus('Ready to chat!');
        }
      }
      
      // Convert AI response to speech if TTS is enabled
      if (enableTTS) {
        setStatus('Converting text to speech...');
        setIsSpeaking(true);
        await textToSpeech(aiResponse);
      } else {
        setIsProcessing(false);
        setStatus('Ready to chat!');
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
    }
  };

  const speechToText = async (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    const response = await fetch('http://localhost:3001/api/speech-to-text', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Speech-to-text failed');
    }

    const data = await response.json();
    return data.text;
  };

  const chatWithAI = async (message) => {
    // Step 1: Send message to detect intent
    setStatus('AI is analyzing your request...');
    const response = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'AI chat failed');
    }

    const data = await response.json();
    
    // If it's a data request, handle the 2-step flow like real case
    if (data.type === 'request_data') {
      // Step 1: AI says "tunggu sebentar" and speak it first
      const initialMessage = data.response;
      
      // Return the initial message first, let it be spoken
      return {
        message: initialMessage,
        needsFollowUp: true,
        originalMessage: message,
        requestType: data.request
      };
    }
    
    // For general responses, return the response directly
    return {
      message: data.response,
      needsFollowUp: false
    };
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
      const audio = document.createElement('audio');
      audio.src = audioUrl;
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

  const handleFollowUpResponse = async (originalMessage, requestType) => {
    try {
      // Step 2a: Fetch data from external service (dummy endpoints for testing)
      // In real case, these would be actual backend services
      setStatus('Fetching latest information...');
      let fetchedData;
      
      if (requestType === 'get_menu') {
        const dataResponse = await fetch('http://localhost:3001/api/dummy/menu');
        fetchedData = await dataResponse.json();
      } else if (requestType === 'get_stores') {
        const dataResponse = await fetch('http://localhost:3001/api/dummy/stores');
        fetchedData = await dataResponse.json();
      } else if (requestType === 'get_events') {
        const dataResponse = await fetch('http://localhost:3001/api/dummy/events');
        fetchedData = await dataResponse.json();
      } else if (requestType === 'get_rewards') {
        const dataResponse = await fetch('http://localhost:3001/api/dummy/rewards');
        fetchedData = await dataResponse.json();
      } else if (requestType === 'get_location') {
        const dataResponse = await fetch('http://localhost:3001/api/dummy/location');
        fetchedData = await dataResponse.json();
      } else if (requestType === 'get_parking') {
        const dataResponse = await fetch('http://localhost:3001/api/dummy/parking');
        fetchedData = await dataResponse.json();
      } else if (requestType === 'get_hours') {
        const dataResponse = await fetch('http://localhost:3001/api/dummy/hours');
        fetchedData = await dataResponse.json();
      }

      // Step 2b: Send data to AI for final response
      if (fetchedData) {
        setStatus('AI is preparing your information...');
        const finalResponse = await fetch('http://localhost:3001/api/chat-with-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            originalMessage: originalMessage,
            dataType: requestType,
            data: fetchedData
          })
        });

        if (finalResponse.ok) {
          const finalData = await finalResponse.json();
          
          // Add the final AI response
          addMessage(finalData.response, 'ai');
          
          // Handle action if exists (for mobile redirect)
          if (finalData.action) {
            console.log('Final response action:', finalData.action);
            // Mobile app can handle this action for navigation
            // Example: handleMobileAction(finalData.action);
          }
          
          // Convert final response to speech if TTS is enabled
          if (enableTTS) {
            setStatus('Converting text to speech...');
            setIsSpeaking(true);
            await textToSpeech(finalData.response);
          } else {
            setIsProcessing(false);
            setStatus('Ready to chat!');
          }
          
          return;
        }
      }
      
      // Fallback if data fetch fails
      const fallbackMessage = 'Maaf, terjadi kesalahan saat mengambil data. Silakan coba lagi.';
      addMessage(fallbackMessage, 'ai');
      
      if (enableTTS) {
        setStatus('Converting text to speech...');
        setIsSpeaking(true);
        await textToSpeech(fallbackMessage);
      } else {
        setIsProcessing(false);
        setStatus('Ready to chat!');
      }
      
    } catch (error) {
      console.error('Follow-up error:', error);
      const errorMessage = 'Maaf, terjadi kesalahan. Silakan coba lagi.';
      addMessage(errorMessage, 'ai');
      
      if (enableTTS) {
        await textToSpeech(errorMessage);
      }
      
      setIsProcessing(false);
      setStatus('Ready to chat!');
    }
  };

  // Example function to handle mobile actions (for React Native implementation)
  const handleMobileAction = (action) => {
    if (!action) return;
    
    const { type, target, params } = action;
    
    console.log('Handling mobile action:', { type, target, params });
    
    // In React Native, you would use navigation here:
    // switch(type) {
    //   case 'navigate':
    //     navigation.navigate(target, params);
    //     break;
    //   case 'navigate_detail':
    //     navigation.navigate(target, params);
    //     break;
    //   case 'show_popup':
    //     showPopup(params);
    //     break;
    // }
    
    // For web demo, just log the action
    console.log(`Would navigate to: ${target} with params:`, params);
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
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
      setIsSpeaking(false);
      setIsProcessing(false);
      setStatus('Ready to chat!');
    }
  };

  return (
    <div className="voice-chat-container">
      <header className="header">
        <h1>🎤 Voice Chat AI</h1>
        <p>Bicara dengan AI menggunakan suara Anda</p>
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
            
            {isSpeaking && (
              <button className="stop-audio-btn" onClick={stopCurrentAudio}>
                ⏹️ Stop Audio
              </button>
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