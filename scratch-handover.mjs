import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  LevelFormat, TableOfContents, PageBreak, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType, ExternalHyperlink, VerticalAlign,
} from 'docx'
import { writeFileSync } from 'fs'

const CONTENT_W = 9638 // A4, 1134 DXA margins each side

function h1(text) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] }) }
function h2(text) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] }) }
function p(text, opts = {}) {
  return new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text, ...opts })] })
}
function bullets(items) {
  return items.map(text => new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 60 },
    children: [new TextRun(text)],
  }))
}
function checklist(items) {
  return items.map(text => new Paragraph({
    numbering: { reference: 'checkbox', level: 0 },
    spacing: { after: 70 },
    children: [new TextRun(text)],
  }))
}
function note(text, color = 'FFF7E0', border = 'F0C040', label = '참고') {
  return new Paragraph({
    spacing: { before: 80, after: 160 },
    shading: { fill: color, type: ShadingType.CLEAR },
    border: {
      top: { style: BorderStyle.SINGLE, size: 4, color: border, space: 4 },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: border, space: 4 },
      left: { style: BorderStyle.SINGLE, size: 4, color: border, space: 4 },
      right: { style: BorderStyle.SINGLE, size: 4, color: border, space: 4 },
    },
    children: [
      new TextRun({ text: label + ' — ', bold: true, size: 20 }),
      new TextRun({ text, size: 20 }),
    ],
  })
}
function warn(text) { return note(text, 'FDECEC', 'E08080', '주의') }
function pageBreak() { return new Paragraph({ children: [new PageBreak()] }) }

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
const cellBorders = { top: border, bottom: border, left: border, right: border }
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 }

function headerCell(text, width) {
  return new TableCell({
    borders: cellBorders, width: { size: width, type: WidthType.DXA }, margins: cellMargins,
    shading: { fill: '2E4B57', type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20 })] })],
  })
}
function bodyCell(text, width, opts = {}) {
  return new TableCell({
    borders: cellBorders, width: { size: width, type: WidthType.DXA }, margins: cellMargins,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [new TextRun({ text, size: 20, ...opts })] })],
  })
}
function table(widths, headerRow, rows) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headerRow.map((t, i) => headerCell(t, widths[i])) }),
      ...rows.map(r => new TableRow({ children: r.map((t, i) => bodyCell(t, widths[i])) })),
    ],
  })
}

const children = []

// ── Title Page ──
children.push(
  new Paragraph({ spacing: { before: 2200 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'MiMuse', size: 30, color: '8BAAB8', bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 },
    children: [new TextRun({ text: '프로젝트 인수인계 문서', size: 56, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1600 },
    children: [new TextRun({ text: 'K-Beauty US Creator Seeding 대시보드 — 시스템·운영 가이드', size: 26, color: '666666' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: '2026년 7월', size: 22, color: '888888' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: '크레인커뮤니케이션즈 · MiMuse 운영팀', size: 22, color: '888888' })] }),
  pageBreak(),
)

// ── TOC ──
children.push(
  h1('목차'),
  new TableOfContents('목차', { hyperlink: true, headingStyleRange: '1-2' }),
  pageBreak(),
)

// ── 1. 프로젝트 개요 ──
children.push(
  h1('1. 프로젝트 개요'),
  p('MiMuse는 크레인커뮤니케이션즈가 운영하는 K-Beauty 브랜드의 미국향 인플루언서 시딩(제품 협찬) 캠페인입니다. 여러 K-뷰티 브랜드의 제품을 하나의 큐레이션 키트로 구성해 미국의 나노·마이크로 틱톡 인플루언서에게 발송하고, 리뷰 콘텐츠 업로드와 성과를 관리합니다.'),
  p('이 문서는 그 운영을 위해 만들어진 사내 대시보드(MiMuse 대시보드)의 구조와 운영 정보를 정리한 것입니다. 화면별 사용 방법은 별도의 「MiMuse_사용자매뉴얼.docx」를 참고하세요.'),
  h2('1.1 차수(시즌) 단위 운영'),
  p('캠페인은 "1차", "2차"처럼 차수 단위로 반복됩니다. 대시보드의 거의 모든 데이터(인플루언서, 브랜드, 배송, 모니터링)는 phase_id로 차수에 귀속되어 있습니다.'),
  h2('1.2 핵심 업무 흐름'),
  ...bullets([
    '인플루언서 트랙 — 서치(틱톡 크리에이터 발굴) → 컨택(아웃리치 메일) → 확정(배송지 수집) → 키트 발송(EMS) → 리뷰 모니터링 → 성과 리포트',
    '브랜드 트랙 — DB 확보 → 컨택 → 확정(참여 브랜드로 자료 수집) → 시즌 아카이브',
    '트렌드 리서치 — 매주 뷰티 뉴스·틱톡 트렌드를 자동 요약해 팀에 이메일로 공유',
    '시즌이 끝나면 결과물(시즌 컬렉션, 디자인 자료, 브랜드별 리포트)을 ARCHIVE 메뉴에 보관',
  ]),
  pageBreak(),
)

// ── 2. 시스템 구성 ──
children.push(
  h1('2. 시스템 구성'),
  p('시스템은 아래 네 축으로 이루어져 있습니다.'),
  table(
    [2200, 7438],
    ['구성 요소', '설명'],
    [
      ['프론트엔드', 'React + TypeScript + Vite로 만든 웹 대시보드. Tailwind CSS로 스타일링. Vercel에 배포되어 있으며, GitHub 저장소(main 브랜치)에 푸시하면 자동으로 재배포되는 구조로 보입니다(Vercel 대시보드에서 GitHub 연동 여부를 확인하세요).'],
      ['데이터베이스', 'Supabase(Postgres 기반 BaaS)가 모든 데이터를 저장하는 중심입니다. 프론트엔드는 Supabase JS 클라이언트로 직접 읽고 쓰며, 백엔드(GAS)는 REST API로 접근합니다.'],
      ['백엔드', 'Google Apps Script(GAS)가 이메일 발송, 외부 크롤링(Apify) 실행, 배송 조회(17track), 구글시트/폼 연동 등 "무거운" 로직을 담당합니다. 이 저장소의 api/ 폴더가 백엔드 코드입니다.'],
      ['외부 서비스', 'Apify(틱톡·인스타 콘텐츠 수집), 17track.net(EMS 배송 조회), Microsoft Graph/Outlook(이메일 발송·수신 확인), TikTok Creator Marketplace API(크리에이터 발굴), Google Sheets/Forms(연동 시트·설문 임포트)'],
    ],
  ),
  pageBreak(),
)

// ── 3. 저장소 및 배포 ──
children.push(
  h1('3. 저장소 및 배포 정보'),
  h2('3.1 코드 위치'),
  table(
    [2600, 7038],
    ['항목', '위치'],
    [
      ['프론트엔드 저장소', 'GitHub — kaydeeloka/mimuse-automation-dashboard (main 브랜치 단일 운영)'],
      ['로컬 작업 경로', 'C:\\Users\\user\\Desktop\\mimuse-react'],
      ['GAS 백엔드', '저장소 내 api/ 폴더 — Google Apps Script 프로젝트에 그대로 붙여넣어 배포'],
      ['배포 플랫폼', 'Vercel (SPA 라우팅을 위한 vercel.json 리라이트 설정 포함)'],
    ],
  ),
  new Paragraph({ text: '' }),
  h2('3.2 GAS(백엔드) 배포 방법 — 중요'),
  p('api/ 폴더의 .gs 파일을 수정한 뒤에는 Google Apps Script 편집기에서 반드시 "배포 → 배포 관리 → 새 버전으로 배포"를 다시 실행해야 실제 서비스에 반영됩니다. 저장만 하고 재배포하지 않으면 이전 버전이 계속 응답합니다.'),
  warn('실제로 프론트엔드(src/lib/api.ts)에도 이 문제를 감지하는 에러 메시지가 내장되어 있습니다 — GAS 응답이 깨지면 "Apps Script에 api 폴더의 모든 .gs 파일이 있는지 확인하고 새 배포를 하세요"라는 안내가 뜹니다.'),
  p('GAS 웹앱은 "나(배포자) 권한으로 실행 / 액세스 권한 없음(익명 허용)"으로 배포되어 있습니다. 즉 배포 URL 자체가 사실상 비밀키 역할을 하므로, URL(src/lib/api.ts의 GAS_URL)이 외부에 노출되지 않도록 주의하세요.'),
  pageBreak(),
)

// ── 4. DB 요약 ──
children.push(
  h1('4. 데이터베이스(Supabase) 요약'),
  p('아래는 주요 테이블과 역할입니다. 대부분의 테이블에 phase_id(차수) 컬럼이 있어, 차수별로 데이터가 분리됩니다. 정확한 컬럼 목록이 필요하면 Supabase 대시보드의 Table Editor에서 직접 확인하세요.'),
  table(
    [2400, 7238],
    ['테이블', '역할'],
    [
      ['phases', '차수(시즌) 마스터 — 이름, 활성 여부, 시작/종료일, 키트 발송일, 연동 구글시트 URL'],
      ['influencers', '서치로 발굴한 인플루언서 마스터 — 팔로워, 참여율, 티어, 컨택 상태'],
      ['tiers', '인플루언서 우선순위 등급(1~5순위) 정의'],
      ['confirmed_influencers', '확정 인플루언서의 배송지·전화번호·리포스트 동의·리뷰 링크'],
      ['ems_tracking', '17track.net 기준 EMS 배송 상태 (확정 인플루언서와 연결)'],
      ['monitoring', 'Apify로 감지한 리뷰 콘텐츠(조회수·좋아요·댓글·감지 키워드)'],
      ['monitoring_keywords', '모니터링에 사용할 키워드(전체 공통 + 브랜드별)'],
      ['brand_general / brand_personal', '브랜드 DB — 회사 단위 정보(brand_general)와 담당자 개인 정보(brand_personal)로 분리'],
      ['confirmed_brands', '최종 참여가 확정된 브랜드의 제품·제안 정보'],
      ['beauty_news_archives', '주간 뷰티 뉴스 브리핑 원본(요약, 키워드, 기간)'],
      ['email_recipients', '뷰티뉴스/틱톡트렌드 이메일 수신자 목록'],
      ['app_config', '기타 설정값(JSON) 저장용 키-값 테이블'],
    ],
  ),
  new Paragraph({ text: '' }),
  note('브랜드 관련 시트 동기화 스크립트(api/sheets.gs)는 brand_contacts라는 이름으로 조회하기도 합니다. 이는 brand_general/brand_personal을 합친 뷰(view)이거나 별칭일 수 있으니, 실제 존재 여부는 Supabase에서 확인하세요.'),
  pageBreak(),
)

// ── 5. 외부 서비스 및 계정 ──
children.push(
  h1('5. 외부 연동 서비스 및 필요 계정'),
  p('아래 서비스들의 계정·API 키가 있어야 대시보드의 모든 기능이 정상 동작합니다. 인수인계 시 계정 접근 권한을 함께 이전해야 합니다.'),
  table(
    [1800, 3400, 4438],
    ['서비스', '용도', '필요한 것'],
    [
      ['Supabase', '데이터베이스·파일 저장소', '프로젝트 URL, anon key (.env.local) / 프로젝트 멤버 초대'],
      ['Vercel', '프론트엔드 배포·호스팅', '팀 멤버 초대 (GitHub 연동 배포 계정)'],
      ['GitHub', '소스코드 저장소', '저장소 협업자(Collaborator) 권한'],
      ['Google Apps Script', 'GAS 백엔드 실행', '스크립트 프로젝트 편집 권한 또는 소유권 이전'],
      ['Apify', '틱톡/인스타 콘텐츠 크롤링, 크리에이터 발굴', 'APIFY_TOKEN, 계정 로그인 (크레딧 잔액 주기 확인 필요)'],
      ['17track.net', 'EMS 국제배송 조회', 'TRACK17_API_KEY, 계정 로그인'],
      ['Microsoft Azure AD', 'Outlook 메일 발송·수신확인(Graph API)', 'OUTLOOK_CLIENT_ID/SECRET/TENANT_ID, 앱 등록 관리 권한'],
      ['TikTok Creator Marketplace', '틱톡 크리에이터 공식 API 검색', 'TIKTOK_APP_ID/SECRET_KEY, 비즈니스 센터 앱 관리 권한'],
      ['Google 계정 (연동 시트/폼)', '인플루언서·브랜드 DB 구글시트 내보내기, 확정 인플루언서 구글폼', '해당 시트·폼 소유자 권한 또는 공유'],
    ],
  ),
  new Paragraph({ text: '' }),
  note('실제 API 키 값은 이 문서에 적지 않았습니다. Supabase 키는 .env.local(프론트엔드) 및 GAS 스크립트 속성(Script Properties)에 저장되어 있으니, 인수인계 시 안전한 방법(비밀번호 관리자 등)으로 직접 전달받으세요.'),
  pageBreak(),
)

// ── 6. 자동화 스케줄 ──
children.push(
  h1('6. 자동화 스케줄 (GAS 트리거)'),
  p('Google Apps Script 편집기의 "트리거" 메뉴에 아래 시간 기반 자동 실행이 등록되어 있어야 합니다(에디터에서 실제 등록 여부를 확인하세요).'),
  table(
    [2400, 2800, 4438],
    ['시간(KST)', '실행 함수', '내용'],
    [
      ['매주 월 08:50', 'importBeautyNewsFromSheet()', '구글시트에서 뷰티 뉴스 브리핑 데이터 1차 임포트'],
      ['매주 월 08:55', 'importBeautyNewsFromSheet()', '동일 함수 재실행(갱신 반영 대비)'],
      ['매주 월 09:00', 'sendWeeklyBeautyNewsEmail()', 'email_recipients 대상 뷰티뉴스 브리핑 메일 발송'],
      ['6~12시간마다 (권장)', 'scheduledReplySync()', '브랜드·인플루언서 아웃리치 메일의 답장을 자동 감지해 상태 반영'],
    ],
  ),
  pageBreak(),
)

// ── 7. 알려진 이슈 / 진행 중 작업 ──
children.push(
  h1('7. 알려진 이슈 · 진행 중인 작업 (2026년 7월 기준)'),
  h2('7.1 진행 중인 작업'),
  ...bullets([
    '리포트 슬라이드를 이미지가 아닌 네이티브 PPTX로 내보내는 기능을 개발 중입니다(src/pages/archive/ppt-native.ts, src/pages/archive/season/report-slides/ppt-slides.ts). 아직 커밋되지 않은 새 파일입니다.',
    'src/pages/archive/season/phase.tsx, src/pages/archive/season/web-archive/load-season-brands.ts 에 커밋되지 않은 수정 사항이 있습니다. git diff로 내용을 확인한 뒤 이어서 작업하거나 커밋하세요.',
  ]),
  h2('7.2 알려진 이슈'),
  ...bullets([
    'README.md의 프로젝트 구조·라우팅 설명은 초기 버전 기준이라 현재 구조와 다릅니다(예: 실제 페이지 파일명·경로 상이). 실제 화면 구성은 「MiMuse_사용자매뉴얼.docx」와 src/App.tsx의 라우팅을 기준으로 삼으세요.',
    'Apify·17track은 크레딧/쿼터가 소진되면 리서치·모니터링·배송추적 기능이 조용히 멈출 수 있습니다. 계정 잔액을 주기적으로 확인하세요.',
    'GAS 웹앱 재배포를 잊으면 코드를 고쳐도 실제 서비스에는 반영되지 않습니다(3.2절 참고).',
  ]),
  pageBreak(),
)

// ── 8. 유지보수 가이드 ──
children.push(
  h1('8. 자주 하는 유지보수 작업'),
  h2('8.1 새 차수(시즌) 시작'),
  p('대시보드 사이드바 하단 톱니바퀴 → 차수 관리 → "새 차수 시작"에서 코드 수정 없이 바로 생성할 수 있습니다. 자세한 방법은 사용자 매뉴얼 9장을 참고하세요.'),
  h2('8.2 이메일 템플릿 수정'),
  p('인플루언서/브랜드/EMS 컨택 이메일 문구는 각 메뉴의 "템플릿 관리" 화면에서 코드 수정 없이 바로 편집할 수 있습니다.'),
  h2('8.3 GAS 코드 수정 시 체크리스트'),
  ...bullets([
    'GAS 코드는 이 저장소의 api/ 폴더에서만 관리합니다.',
    '수정 후 Apps Script 편집기에서 새 버전으로 재배포',
    '재배포 후 대시보드에서 관련 기능을 실제로 한 번 실행해 정상 동작 확인',
  ]),
  h2('8.4 계정 크레딧/쿼터 점검'),
  p('Apify, 17track, Microsoft Graph(Outlook) 계정의 사용량·크레딧을 월 1회 정도 점검하는 것을 권장합니다. 소진 시 관련 기능이 에러 없이 "그냥 안 되는" 형태로 멈출 수 있습니다.'),
  pageBreak(),
)

// ── 9. 인수인계 체크리스트 ──
children.push(
  h1('9. 인수인계 체크리스트'),
  p('아래 항목을 순서대로 이전/확인하세요.'),
  ...checklist([
    'Supabase 프로젝트에 새 담당자를 멤버로 초대',
    'Vercel 팀에 새 담당자를 멤버로 초대',
    'GitHub 저장소(kaydeeloka/mimuse-automation-dashboard)에 협업자로 추가',
    'Google Apps Script 프로젝트(api/) 편집 권한 공유 또는 소유권 이전',
    'Apify 계정/토큰 전달 및 크레딧 현황 공유',
    '17track.net 계정 전달',
    'Microsoft Azure AD 앱(Outlook 발송용) 관리 권한 이전',
    'TikTok Creator Marketplace 비즈니스 센터 앱 관리 권한 이전',
    '연동 구글시트·구글폼(뷰티뉴스, 확정 인플루언서 설문 등) 공유 권한 확인',
    '크레인커뮤니케이션즈 내부 이메일 수신자 목록(email_recipients) 최신화',
  ]),
  pageBreak(),
)

// ── 10. 참고 문서 ──
children.push(
  h1('10. 참고 문서'),
  ...bullets([
    'MiMuse_사용자매뉴얼.docx — 화면별 사용 방법 (일반 사용자용)',
    '이 문서 — 시스템 구조·운영·인수인계 정보 (담당자용)',
  ]),
  p('두 문서 모두 docs/ 폴더에 함께 보관되어 있습니다.'),
)

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Malgun Gothic', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 34, bold: true, font: 'Malgun Gothic', color: '2E4B57' },
        paragraph: { spacing: { before: 320, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Malgun Gothic', color: '4A7180' },
        paragraph: { spacing: { before: 240, after: 140 }, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 560, hanging: 260 } } } }] },
      { reference: 'checkbox', levels: [{ level: 0, format: LevelFormat.BULLET, text: '☐', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 560, hanging: 260 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
      },
    },
    children,
  }],
})

Packer.toBuffer(doc).then(buffer => {
  writeFileSync('docs/MiMuse_인수인계문서.docx', buffer)
  console.log('written')
})
