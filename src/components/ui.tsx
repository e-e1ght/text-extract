import { useId, type ReactNode } from 'react';

export function Field({
  label, hint, children, variant,
}: { label: string; hint?: string; children: ReactNode; variant?: 'slider' | 'color' }) {
  return (
    <div className={`field${variant ? ` field-${variant}` : ''}`}>
      <div className="field-label">
        <span>{label}</span>
        {hint ? <span className="field-hint">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

/** 슬라이더 + 숫자 입력을 항상 함께 제공한다 (README: 모든 여백 수정에 둘 다 포함) */
export function NumberSlider({
  label, value, onChange, min, max, step = 1, unit = 'px', hint,
}: {
  label: string; value: number; onChange: (value: number) => void;
  min: number; max: number; step?: number; unit?: string; hint?: string;
}) {
  const id = useId();
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <Field label={label} hint={hint} variant="slider">
      <div className="slider-row">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <div className="number-box">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isNaN(next)) onChange(clamp(next));
            }}
          />
          {unit ? <span className="unit">{unit}</span> : null}
        </div>
      </div>
    </Field>
  );
}

export function ColorField({
  label, value, onChange, allowAlpha = false,
}: { label: string; value: string; onChange: (value: string) => void; allowAlpha?: boolean }) {
  return (
    <Field label={label} variant="color">
      <div className="color-row">
        <input type="color" value={normalizeHex(value)} onChange={(e) => onChange(e.target.value)} />
        <input
          type="text"
          className="color-text"
          value={value}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          placeholder={allowAlpha ? '#000000 또는 rgba(...)' : '#000000'}
        />
      </div>
    </Field>
  );
}

function normalizeHex(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : '#000000';
}

export function Select<T extends string | number>({
  label, value, options, onChange, hint,
}: {
  label: string; value: T; hint?: string;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <select
        value={String(value)}
        onChange={(e) => {
          const picked = options.find((option) => String(option.value) === e.target.value);
          if (picked) onChange(picked.value);
        }}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>{option.label}</option>
        ))}
      </select>
    </Field>
  );
}

export function ButtonGroup<T extends string>({
  label, value, options, onChange, hint,
}: {
  label?: string; value: T; hint?: string;
  options: Array<{ label: string; value: T; title?: string }>;
  onChange: (value: T) => void;
}) {
  const group = (
    <div className="button-group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title ?? option.label}
          className={value === option.value ? 'is-active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
  return label ? <Field label={label} hint={hint}>{group}</Field> : group;
}

export function Toggle({
  label, checked, onChange, hint,
}: { label: string; checked: boolean; onChange: (checked: boolean) => void; hint?: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden><span className="toggle-thumb" /></span>
      <span className="toggle-label">
        {label}
        {hint ? <span className="field-hint">{hint}</span> : null}
      </span>
    </label>
  );
}

export function TextInput({
  label, value, onChange, placeholder, multiline = false,
}: {
  label: string; value: string; onChange: (value: string) => void;
  placeholder?: string; multiline?: boolean;
}) {
  return (
    <Field label={label}>
      {multiline ? (
        <textarea value={value} placeholder={placeholder} rows={2} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

export function FileButton({
  label, accept, onPick,
}: { label: string; accept: string; onPick: (file: File) => void }) {
  const id = useId();
  return (
    <>
      <label className="file-button" htmlFor={id}>{label}</label>
      <input
        id={id}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = '';
        }}
      />
    </>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="hint-block">{children}</p>;
}
