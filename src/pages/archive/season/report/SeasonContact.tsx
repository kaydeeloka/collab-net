import { REPORT_ASSETS, REPORT_CONTACT } from './report-theme'

export default function SeasonContact() {
  return (
    <section className="season-report__slide season-report__slide--contact" aria-label="문의">
      <img src={REPORT_ASSETS.logo} alt="Mi Muse" className="season-contact__logo" />
      <span className="season-contact__eyebrow">CONTACT</span>
      <a className="season-contact__email" href={`mailto:${REPORT_CONTACT.email}`}>
        {REPORT_CONTACT.email}
      </a>
      <span className="season-contact__eod">E.O.D</span>
    </section>
  )
}
