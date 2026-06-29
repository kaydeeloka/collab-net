import type { ReactNode } from 'react'
import { REPORT_ASSETS } from './report-theme'

interface Props {
  eyebrow?: string
  title: string
  children: ReactNode
  className?: string
}

export default function SeasonReportSlide({ eyebrow, title, children, className }: Props) {
  return (
    <section className={['season-report__slide', className].filter(Boolean).join(' ')}>
      <header className="season-report__head">
        <div className="season-report__head-copy">
          {eyebrow ? <span className="season-report__eyebrow">{eyebrow}</span> : null}
          <h2 className="season-report__title">{title}</h2>
        </div>
        <img src={REPORT_ASSETS.logo} alt="Mi Muse" className="season-report__logo" />
      </header>
      <div className="season-report__body">{children}</div>
    </section>
  )
}
