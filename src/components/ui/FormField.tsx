import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

interface LabelProps {
  label: string
  required?: boolean
  hint?: string
  className?: string
}

export function FormSection({ title }: { title: string }) {
  return <div className="ui-form-section">{title}</div>
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="ui-form-grid">{children}</div>
}

function FieldWrap({ label, required, hint, className = '', children }: LabelProps & { children: ReactNode }) {
  return (
    <div className={`ui-field ${className}`.trim()}>
      <label className="ui-label">
        {label}
        {required && <span className="ui-label__req">*</span>}
      </label>
      {children}
      {hint && <span style={{ fontSize: 11, color: 'var(--gray-5)' }}>{hint}</span>}
    </div>
  )
}

export function FormInput({
  label,
  required,
  hint,
  className,
  ...inputProps
}: LabelProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldWrap label={label} required={required} hint={hint} className={className}>
      <input className="ui-input" {...inputProps} />
    </FieldWrap>
  )
}

export function FormTextarea({
  label,
  required,
  hint,
  className,
  ...textareaProps
}: LabelProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldWrap label={label} required={required} hint={hint} className={className}>
      <textarea className="ui-textarea" {...textareaProps} />
    </FieldWrap>
  )
}

export function FormSelect({
  label,
  required,
  hint,
  className,
  children,
  ...selectProps
}: LabelProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <FieldWrap label={label} required={required} hint={hint} className={className}>
      <select className="ui-select" {...selectProps}>{children}</select>
    </FieldWrap>
  )
}

export function FormSlot({ label, required, hint, className, children }: LabelProps & { children: ReactNode }) {
  return (
    <FieldWrap label={label} required={required} hint={hint} className={className}>
      {children}
    </FieldWrap>
  )
}

/** @deprecated Prefer FormInput / FormTextarea / FormSelect / FormSlot */
export default function FormField(props: LabelProps & { children: ReactNode }) {
  return <FormSlot {...props} />
}
