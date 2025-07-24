import React from 'react';

export function TrainAILogo({ size = 'large' }: { size?: 'small' | 'large' }) {
  // large = 64px tall on mobile, 80px on desktop; small = 32px/40px
  const classes = size === 'large'
    ? 'h-16 w-auto md:h-20'
    : 'h-8 w-auto md:h-10';
  return (
    <img
      src="/Updatedlogo.png"
      alt="TrainAI Logo"
      className={`${classes} block`}
    />
  )
} 