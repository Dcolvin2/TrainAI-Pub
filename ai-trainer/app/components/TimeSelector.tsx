import React, { useState } from 'react';

const TimeSelector = ({ onTimeChange }: { onTimeChange?: (time: number) => void }) => {
  const [timeAvailable, setTimeAvailable] = useState(45);
  const [isEditing, setIsEditing] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  const handleTimeChange = (newTime: number) => {
    setTimeAvailable(newTime);
    if (onTimeChange) {
      onTimeChange(newTime);
    }
    setShowPresets(false);
    setIsEditing(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 45;
    handleTimeChange(value);
  };

  const handleInputFocus = () => {
    setIsEditing(true);
    setShowPresets(true);
  };

  const handleInputBlur = () => {
    setTimeout(() => {
      setIsEditing(false);
      setShowPresets(false);
    }, 200);
  };

  return (
    <div className="time-selector" style={{ position: 'relative' }}>
      <span style={{ color: '#F7F8FA' }}>Time Available: </span>
      {isEditing ? (
        <input
          type="number"
          value={timeAvailable}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          style={{
            display: 'inline',
            width: '60px',
            border: '2px solid #19A0FF',
            borderRadius: '0.5rem',
            padding: '4px 8px',
            backgroundColor: '#001F54',
            color: '#F7F8FA',
            fontSize: '16px' // Prevents zoom on iOS
          }}
          autoFocus
        />
      ) : (
        <span
          onClick={() => setIsEditing(true)}
          style={{
            textDecoration: 'underline',
            cursor: 'pointer',
            color: '#19A0FF'
          }}
        >
          {timeAvailable}
        </span>
      )}
      <span style={{ color: '#F7F8FA' }}> minutes</span>
      
      {showPresets && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '0',
            zIndex: 1000,
            backgroundColor: '#001F54',
            border: '1px solid #19A0FF',
            borderRadius: '0.5rem',
            padding: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
        >
          <button
            onClick={() => handleTimeChange(30)}
            style={{ 
              margin: '0 4px', 
              padding: '6px 12px', 
              fontSize: '14px',
              backgroundColor: '#19A0FF',
              color: '#001F54',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer'
            }}
          >
            30
          </button>
          <button
            onClick={() => handleTimeChange(45)}
            style={{ 
              margin: '0 4px', 
              padding: '6px 12px', 
              fontSize: '14px',
              backgroundColor: '#19A0FF',
              color: '#001F54',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer'
            }}
          >
            45
          </button>
          <button
            onClick={() => handleTimeChange(60)}
            style={{ 
              margin: '0 4px', 
              padding: '6px 12px', 
              fontSize: '14px',
              backgroundColor: '#19A0FF',
              color: '#001F54',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer'
            }}
          >
            60
          </button>
        </div>
      )}
    </div>
  );
};

export default TimeSelector; 