import type { CSSProperties, ReactNode } from 'react'
import { PAGE_HERO_DEFAULT_BG } from './page-hero-banner.constants'
import './page-hero-banner.css'

export interface PageHeroBannerProps {
  children: ReactNode
  aside?: ReactNode
  className?: string
  backgroundImage?: string
  style?: CSSProperties
}

/** Editorial hero row with flower gradient background. */
export function PageHeroBanner({
  children,
  aside,
  className,
  backgroundImage = PAGE_HERO_DEFAULT_BG,
  style,
}: PageHeroBannerProps) {
  const bgStyle = {
    '--page-hero-bg-image': `url('${backgroundImage}')`,
  } as CSSProperties

  return (
    <div
      className={['page-hero-row', className].filter(Boolean).join(' ')}
      style={{ ...style, ...bgStyle }}
    >
      <div className="page-hero-main">
        <div className="page-hero-bg" aria-hidden style={bgStyle} />
        <div className="page-hero-main-inner">{children}</div>
      </div>
      {aside}
    </div>
  )
}

export interface PageHeroBannerContentProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  showLogo?: boolean
  eyebrow?: ReactNode
  trailing?: ReactNode
}

/** Standard page hero copy block (title + description + optional actions). */
export function PageHeroBannerContent({
  title,
  description,
  actions,
  showLogo = false,
  eyebrow,
  trailing,
}: PageHeroBannerContentProps) {
  return (
    <>
      <div className="page-hero-copy page-hero-copy--fluid">
        {eyebrow && <div className="page-hero-meta">{eyebrow}</div>}
        {showLogo ? (
          <div className="page-hero-brand page-hero-brand--page">
            <img src="/img/logo-black.svg" alt="CollabNet" className="page-hero-logo page-hero-logo--page" />
            <h1 className="page-hero-title page-hero-title--page">{title}</h1>
          </div>
        ) : (
          <h1 className="page-hero-title page-hero-title--page">{title}</h1>
        )}
        {description && <div className="page-hero-desc">{description}</div>}
      </div>
      {trailing}
      {actions && <div className="page-hero-actions">{actions}</div>}
    </>
  )
}

export interface PageHeroAsideProps {
  children: ReactNode
  done?: boolean
  className?: string
}

/** Optional right-side panel (e.g. project deadline card). */
export function PageHeroAside({ children, done, className }: PageHeroAsideProps) {
  return (
    <div
      className={[
        'page-hero-aside',
        done ? 'page-hero-aside--done' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  )
}
