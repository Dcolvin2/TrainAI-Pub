import React from 'react';

interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number';
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  name?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

export default function Input({
  type = 'text',
  placeholder,
  value,
  onChange,
  className = '',
  name,
  id,
  required = false,
  disabled = false,
  error
}: InputProps) {
  const baseClasses = 'bg-input-bg border border-border text-foreground px-4 py-3 rounded-lg font-inter text-base transition-all duration-200';
  const focusClasses = 'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';
  const errorClasses = error ? 'border-error focus:border-error focus:ring-error/20' : '';
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';
  
  return (
    <div className="w-full">
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`${baseClasses} ${focusClasses} ${errorClasses} ${disabledClasses} ${className}`}
        name={name}
        id={id}
        required={required}
        disabled={disabled}
      />
      {error && (
        <p className="text-error text-sm mt-1">{error}</p>
      )}
    </div>
  );
} 