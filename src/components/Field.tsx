"use client";

interface Props {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export default function Field({ label, unit, value, onChange, placeholder, error, hint, required }: Props) {
  return (
    <div>
      <label className="mb-1 block text-sm">
        {required && <span className="mr-0.5 text-red-500">*</span>}
        {label}
        {unit && <span className="ml-1 text-xs text-muted">{unit}</span>}
      </label>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg bg-card px-3 py-2 text-sm ring-1 outline-none transition-shadow focus:ring-2 focus:ring-accent/40 ${
          error ? "ring-red-400" : "ring-line"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
