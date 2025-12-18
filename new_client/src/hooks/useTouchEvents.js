import { useEffect, useRef } from 'react';

const useTouchEvents = ({ onTouchStart, onTouchEnd }) => {
  const elementRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e) => {
      e.preventDefault();
      if (onTouchStart) {
        onTouchStart(e);
      }
    };

    const handleTouchEnd = (e) => {
      e.preventDefault();
      if (onTouchEnd) {
        onTouchEnd(e);
      }
    };

    // Add event listeners with passive: false to allow preventDefault
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onTouchStart, onTouchEnd]);

  return {
    ref: elementRef
  };
};

export default useTouchEvents;