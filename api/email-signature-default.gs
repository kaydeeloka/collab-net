// Compact signature — large PNG logos (>~30KB inlined) trigger Gmail "[Message clipped]" at 102KB.
var OUTREACH_SIGNATURE_LOGO_URL_DEFAULT =
  'https://ybtfkkkpansmsxyvymef.supabase.co/storage/v1/object/public/email-assets/crane-logo-compressed.png';

function _outreachSignatureLogoUrl() {
  return scriptProp('OUTREACH_SIGNATURE_LOGO_URL') || OUTREACH_SIGNATURE_LOGO_URL_DEFAULT;
}

function _outreachSignatureTextHtml() {
  return '<b style="color:#333;">Mi Muse</b> 운영팀 / 크레인커뮤니케이션즈<br>'
    + '<b style="color:#2c4a6e;">Mi Muse Operations Team / Crane Communications</b><br>'
    + 'T. 02-522-0692 · E. <a href="mailto:beautyproject@cranecomm.com" style="color:#2563eb;">beautyproject@cranecomm.com</a><br>'
    + '06754 서울특별시 서초구 양재천로69, 1층<br>'
    + '1F, Yangjaecheon-ro 69, Seocho-gu, Seoul, Korea 06619';
}

/** Text-only fallback when HTML must stay under Gmail 102KB limit. */
function textOnlyOutreachSignatureHtml() {
  return _outreachSignatureTextHtml();
}

/** uniqueKey: per-message token so Gmail does not trim identical signature blocks. */
function defaultOutreachSignatureHtml(uniqueKey) {
  var logo = _outreachSignatureLogoUrl();
  var unique = uniqueKey
    ? '<span style="font-size:1px;line-height:1px;color:#fcfcfc;opacity:0.01;">' + String(uniqueKey) + '</span>'
    : '';
  return '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Malgun Gothic,Arial,sans-serif;font-size:14px;line-height:1.7;color:#222;">'
    + '<tr><td style="padding:8px 0 0 0;">'
    + '<img src="' + logo + '" alt="Crane" width="260" style="border:0;max-width:260px;height:auto;display:block;margin:0 0 8px 0;" />'
    + _outreachSignatureTextHtml()
    + unique
    + '</td></tr></table>';
}
