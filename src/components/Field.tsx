"use client";

interface Props {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
}

export default function Field({ label, unit, value, onChange, placeholder, error, hint }: Props) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted">
        {label}
        {unit && <span className="ml-1 text-[11px] font-normal text-muted/80">{unit}</span>}
      </label>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border bg-background/70 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent focus:bg-card focus:ring-2 focus:ring-accent/10 ${
          error ? "border-danger/60" : "border-line"
        }`}
      />
      {error ? (
        <p className="mt-1.5 text-[11px] leading-4 text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[11px] leading-4 text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
