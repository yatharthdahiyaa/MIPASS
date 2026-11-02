import React from 'react';
import { Check, X } from 'lucide-react';

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const minLength = password.length >= 12;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  let score = 0;
  if (password.length >= 12) score += 25;
  if (password.length >= 16) score += 15;
  if (hasUppercase) score += 15;
  if (hasLowercase) score += 15;
  if (hasNumber) score += 15;
  if (hasSymbol) score += 15;

  score = Math.min(100, score);

  let strengthColor = 'bg-red-500';
  let strengthLabel = 'Very Weak';

  if (score >= 80) {
    strengthColor = 'bg-emerald-500';
    strengthLabel = 'Very Strong';
  } else if (score >= 65) {
    strengthColor = 'bg-emerald-400';
    strengthLabel = 'Strong';
  } else if (score >= 45) {
    strengthColor = 'bg-amber-500';
    strengthLabel = 'Medium';
  } else if (score >= 25) {
    strengthColor = 'bg-orange-500';
    strengthLabel = 'Weak';
  }

  const rules = [
    { label: 'At least 12 characters long', valid: minLength },
    { label: 'At least one uppercase letter (A-Z)', valid: hasUppercase },
    { label: 'At least one lowercase letter (a-z)', valid: hasLowercase },
    { label: 'At least one number (0-9)', valid: hasNumber },
    { label: 'At least one symbol (!@#$%^&*)', valid: hasSymbol },
  ];

  if (!password) return null;

  return (
    <div className="mt-3 space-y-2.5 text-xs">
      {/* Progress Bar */}
      <div>
        <div className="flex justify-between items-center mb-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300">
          <span>Password strength:</span>
          <span className={score >= 65 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
            {strengthLabel} ({score}%)
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${strengthColor}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] pt-1">
        {rules.map((rule, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-1.5 transition-colors ${
              rule.valid
                ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {rule.valid ? (
              <Check className="w-3.5 h-3.5 flex-shrink-0" />
            ) : (
              <X className="w-3.5 h-3.5 flex-shrink-0" />
            )}
            <span>{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
