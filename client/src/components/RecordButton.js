import React from 'react';
import useTouchEvents from '../hooks/useTouchEvents';
import './RecordButton.css';

const RecordButton = ({
  isRecording,
  isProcessing,
  isReady,
  isSpeaking,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onTouchStart,
  onTouchEnd
}) => {
  // Use custom hook for touch events
  const { ref: touchRef } = useTouchEvents({
    onTouchStart,
    onTouchEnd
  });

  const getButtonState = () => {
    if (!isReady) return 'disabled';
    if (isRecording) return 'recording';
    if (isProcessing || isSpeaking) return 'processing';
    return 'ready';
  };

  const getButtonText = () => {
    if (!isReady) return 'Initializing...';
    if (isRecording) return 'Recording...';
    if (isProcessing) return 'Processing...';
    if (isSpeaking) return 'Speaking...';
    return 'Hold to Record';
  };

  const getButtonIcon = () => {
    if (!isReady) return '⏳';
    if (isRecording) return '🔴';
    if (isProcessing) return '⏳';
    if (isSpeaking) return '🔊';
    return '🎤';
  };

  return (
    <button
      ref={touchRef}
      className={`record-button ${getButtonState()}`}
      onMouseDown={isReady && !isProcessing && !isSpeaking ? onMouseDown : undefined}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      disabled={!isReady || isProcessing || isSpeaking}
    >
      <div className="button-content">
        <span className="button-icon">{getButtonIcon()}</span>
        <span className="button-text">{getButtonText()}</span>
      </div>
      
      {isRecording && (
        <div className="recording-indicator">
          <div className="pulse-ring"></div>
          <div className="pulse-ring delay-1"></div>
          <div className="pulse-ring delay-2"></div>
        </div>
      )}
    </button>
  );
};

export default RecordButton;