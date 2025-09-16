'use client';

import React, { useState, useEffect } from 'react';

interface VoiceInputParserProps {
  onQuickEntry: (exerciseName: string, entries: QuickEntry[]) => void;
  currentExercise?: string;
  availableExercises?: string[];
}

interface QuickEntry {
  setNumber: number;
  reps: number;
  actualWeight: number;
  completed: boolean;
}

export default function VoiceInputParser({ onQuickEntry, currentExercise, availableExercises = [] }: VoiceInputParserProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if speech recognition is supported
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      setIsSupported(true);
    }
  }, []);

  const startListening = () => {
    if (!isSupported) return;

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTranscript) {
        setTranscript(finalTranscript);
        parseVoiceInput(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const stopListening = () => {
    setIsListening(false);
  };

  const parseVoiceInput = (input: string) => {
    const cleanInput = input.trim().toLowerCase();
    
    // First, try to find an exercise name in the input
    let targetExercise = currentExercise;
    let exerciseInput = cleanInput;
    
    if (!targetExercise && availableExercises.length > 0) {
      // Look for exercise name in the input
      for (const exercise of availableExercises) {
        const exerciseLower = exercise.toLowerCase();
        if (cleanInput.includes(exerciseLower)) {
          targetExercise = exercise;
          // Remove exercise name from input
          exerciseInput = cleanInput.replace(exerciseLower, '').trim();
          break;
        }
      }
    }
    
    // Parse patterns for set, reps, weight
    const patterns = [
      // "1,5,50" format
      /^(\d+),(\d+),(\d+)$/,
      // "1 5 50" format
      /^(\d+)\s+(\d+)\s+(\d+)$/,
      // "set 1, 5 reps, 50 pounds" format
      /^set\s+(\d+),?\s+(\d+)\s+reps?,?\s+(\d+)\s+(pounds?|lbs?)$/i,
      // "1, 5, 50" format with spaces
      /^(\d+),\s*(\d+),\s*(\d+)$/,
      // "1, 5, 50" with extra words
      /^(\d+),?\s*(\d+),?\s*(\d+).*$/,
      // "set 1, 5 reps, 50" format
      /^set\s+(\d+),?\s+(\d+)\s+reps?,?\s+(\d+)$/i
    ];

    for (const pattern of patterns) {
      const match = exerciseInput.match(pattern);
      if (match) {
        const setNumber = parseInt(match[1]);
        const reps = parseInt(match[2]);
        const weight = parseInt(match[3]);

        if (setNumber > 0 && reps > 0 && weight >= 0) {
          const entry: QuickEntry = {
            setNumber,
            reps,
            actualWeight: weight,
            completed: true
          };

          // Apply to the target exercise
          if (targetExercise) {
            onQuickEntry(targetExercise, [entry]);
            console.log(`Applied voice input to ${targetExercise}:`, entry);
          } else if (availableExercises.length > 0) {
            // If no specific exercise found, apply to the first available exercise
            onQuickEntry(availableExercises[0], [entry]);
            console.log(`Applied voice input to ${availableExercises[0]}:`, entry);
          } else {
            console.log('Voice input parsed but no exercise available:', entry);
          }
          
          // Clear the transcript after successful parsing
          setTranscript('');
          return;
        }
      }
    }

    // If no pattern matched, log the input for debugging
    console.log('Voice input not recognized:', input);
  };

  if (!isSupported) {
    return (
      <div className="text-gray-500 text-sm">
        Voice input not supported in this browser
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg">
      <button
        onClick={isListening ? stopListening : startListening}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isListening 
            ? 'bg-red-600 hover:bg-red-700 text-white' 
            : 'bg-green-600 hover:bg-green-700 text-white'
        }`}
      >
        {isListening ? 'Stop Listening' : 'Voice Input'}
      </button>
      
      {isListening && (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-300">Listening...</span>
        </div>
      )}
      
      {transcript && (
        <div className="text-sm text-gray-300">
          Heard: "{transcript}"
        </div>
      )}
      
      <div className="text-xs text-gray-500">
        Say: "1,5,50" for set 1, 5 reps, 50 lbs
        {availableExercises.length > 0 && (
          <div className="mt-1">
            Or: "bench press 1,5,50" to specify exercise
          </div>
        )}
      </div>
    </div>
  );
}
