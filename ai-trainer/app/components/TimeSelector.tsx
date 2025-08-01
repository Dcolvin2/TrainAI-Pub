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
    }, 200); // Delay to allow preset button clicks
  };

  return (
    <div className="time-selector" style={{ position: 'relative' }}>
      <span>Time Available: </span>
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
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '2px 4px'
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
      <span> minutes</span>
      
      {showPresets && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '0',
            zIndex: 1000,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <button
            onClick={() => handleTimeChange(30)}
            style={{ margin: '0 2px', padding: '4px 8px', fontSize: '12px' }}
          >
            30
          </button>
          <button
            onClick={() => handleTimeChange(45)}
            style={{ margin: '0 2px', padding: '4px 8px', fontSize: '12px' }}
          >
            45
          </button>
          <button
            onClick={() => handleTimeChange(60)}
            style={{ margin: '0 2px', padding: '4px 8px', fontSize: '12px' }}
          >
            60
          </button>
        </div>
      )}
    </div>
  );
};

export default TimeSelector; 