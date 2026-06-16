import { type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const variantClass: Record<Variant, string> = {
  primary: 'ui-btn--primary',
  secondary: 'ui-btn--secondary',
  ghost: 'ui-btn--ghost',
  danger: 'ui-btn--danger',
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...rest
}: Props) {
  const sizeClass = size === 'sm' ? 'ui-btn--sm' : ''
  return (
    <button
      type={type}
      className={`ui-btn ${variantClass[variant]} ${sizeClass} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  )
}
