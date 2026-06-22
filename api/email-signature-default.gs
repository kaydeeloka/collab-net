// Compact signature — large PNG logos (>~30KB inlined) trigger Gmail "[Message clipped]" at 102KB.
var OUTREACH_SIGNATURE_LOGO_URL_DEFAULT =
  'https://ybtfkkkpansmsxyvymef.supabase.co/storage/v1/object/public/email-assets/crane-logo-compressed.png';

function _outreachSignatureLogoUrl() {
  return scriptProp('OUTREACH_SIGNATURE_LOGO_URL') || OUTREACH_SIGNATURE_LOGO_URL_DEFAULT;
}

/** Text-only fallback when HTML must stay under Gmail 102KB limit. */
function textOnlyOutreachSignatureHtml() {
  return '<div style="margin-top:12px;font-family:Malgun Gothic,Arial,sans-serif;font-size:12px;line-height:1.65;color:#666;">'
    + '<b style="color:#2c4a6e;">Mi Muse Operations Team / Crane Communications</b><br>'
    + '<b style="color:#333;">Mi Muse</b> 운영팀 / 크레인커뮤니케이션즈<br>'
    + 'T. 02-522-0692 · E. <a href="mailto:beautyproject@cranecomm.com" style="color:#2563eb;">beautyproject@cranecomm.com</a><br>'
    + '06754 서울특별시 서초구 양재천로69, 1층<br>'
    + '1F, Yangjaecheon-ro 69, Seocho-gu, Seoul, Korea 06619'
    + '</div>';
}

function defaultOutreachSignatureHtml() {
  var logo = _outreachSignatureLogoUrl();
  return '<div style="margin-top:12px;font-family:Malgun Gothic,Arial,sans-serif;font-size:12px;line-height:1.65;color:#666;">'
    + '<img src="' + logo + '" alt="Crane Communications" width="260" style="display:block;border:0;max-width:260px;height:auto;margin:0 0 10px 0;" />'
    + '<b style="color:#333;">Mi Muse</b> 운영팀 / 크레인커뮤니케이션즈<br>'
    + '<b style="color:#2c4a6e;">Mi Muse Operations Team / Crane Communications</b><br>'
    + 'T. 02-522-0692 · E. <a href="mailto:beautyproject@cranecomm.com" style="color:#2563eb;">beautyproject@cranecomm.com</a><br>'
    + '06754 서울특별시 서초구 양재천로69, 1층<br>'
    + '1F, Yangjaecheon-ro 69, Seocho-gu, Seoul, Korea 06619'
    + '</div>';
}
