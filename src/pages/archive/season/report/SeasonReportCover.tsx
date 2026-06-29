import { REPORT_ASSETS } from './report-theme'
import { REPORT_COVER_FOOTER } from './report-cover'

interface Props {
  title: string
}

export default function SeasonReportCover({ title }: Props) {
  return (
    <section className="season-report__slide season-report__slide--cover" aria-label="리포트 표지">
      <img src={REPORT_ASSETS.logo} alt="Mi Muse" className="season-report__cover-logo" />
      <h1 className="season-report__cover-title">{title}</h1>
      <footer className="season-report__cover-footer">{REPORT_COVER_FOOTER}</footer>
    </section>
  )
}
