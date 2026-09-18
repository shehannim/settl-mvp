import React, { useRef, useState } from "react";

/**
 * Stitch Design System 6-Digit OTP Verification Input
 * Specs:
 * - 6 distinct square cells (48px x 56px)
 * - Centered digits in numeric-score / mono font (24px font size)
 * - Auto-focus progression, backspace handling, and paste support
 */
export default function OtpInput({ length = 6, value = "", onChange, onComplete }) {
  const [digits, setDigits] = useState(
    Array(length)
      .fill("")
      .map((_, i) => value[i] || "")
  );
  const inputRefs = useRef([]);

  const updateParent = (newDigits) => {
    const combined = newDigits.join("");
    if (onChange) onChange(combined);
    if (combined.length === length && onComplete && newDigits.every((d) => d !== "")) {
      onComplete(combined);
    }
  };

  const handleChange = (e, idx) => {
    const val = e.target.value.replace(/\D/g, "");
    if (!val) {
      const next = [...digits];
      next[idx] = "";
      setDigits(next);
      updateParent(next);
      return;
    }

    const char = val.slice(-1);
    const next = [...digits];
    next[idx] = char;
    setDigits(next);
    updateParent(next);

    // Auto advance
    if (idx < length - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasteData) return;

    const next = [...digits];
    for (let i = 0; i < pasteData.length; i++) {
      next[i] = pasteData[i];
    }
    setDigits(next);
    updateParent(next);

    const nextFocusIndex = Math.min(pasteData.length, length - 1);
    inputRefs.current[nextFocusIndex]?.focus();
  };

  return (
    <div className="flex items-center justify-between gap-2.5 max-w-sm mx-auto" onPaste={handlePaste}>
      {Array(length)
        .fill(0)
        .map((_, idx) => (
          <input
            key={idx}
            ref={(el) => (inputRefs.current[idx] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digits[idx] || ""}
            onChange={(e) => handleChange(e, idx)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`w-12 h-14 text-center font-mono text-2xl font-bold rounded-xl border ${
              digits[idx]
                ? "border-primary bg-blue-50/20 text-slate-900"
                : "border-border-hairline bg-white text-slate-800"
            } transition-all outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 shadow-xs`}
          />
        ))}
    </div>
  );
}
