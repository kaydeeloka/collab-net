import type { CSSProperties, ReactNode } from 'react'
import './page-hero-banner.css'

export const PAGE_HERO_DEFAULT_BG = '/img/dashboard-hero-flower.png'

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
    <div className={['page-hero-row', className].filter(Boolean).join(' ')} style={style}>
      <div className="page-hero-main">
        <div className="page-hero-bg" aria-hidden style={bgStyle} />
        <div className="page-hero-main-inner">{children}</div>
      </div>
      {aside}
    </div>
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
