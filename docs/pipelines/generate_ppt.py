"""Generate MiMuse dashboard workflow PowerPoint."""
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

FONT = "나눔휴먼OTF"
OUT = Path(__file__).parent / "MiMuse-Dashboard-Workflow.pptx"
OUT_ALT = Path(__file__).parent / "MiMuse-Dashboard-Workflow-updated.pptx"
OUT_FALLBACK = Path(__file__).parent / "MiMuse-Dashboard-Workflow-monthly.pptx"
OUT_TEMP = Path.home() / "Desktop" / "MiMuse-Dashboard-Workflow-monthly.pptx"

# MiMuse web theme
BLUE_DK = RGBColor(0x64, 0x80, 0x85)
BLUE = RGBColor(0x9F, 0xBA, 0xC5)
BLUE_LT = RGBColor(0xEA, 0xF2, 0xF6)
YELLOW_MD = RGBColor(0xFF, 0xE9, 0xA0)
YELLOW_TEXT = RGBColor(0xA0, 0x78, 0x00)
SURFACE = RGBColor(0xF8, 0xF6, 0xF6)
SURFACE_MD = RGBColor(0xE0, 0xDF, 0xDC)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
TEXT = RGBColor(0x2A, 0x2A, 0x2A)
MUTED = RGBColor(0x5A, 0x5A, 0x5A)
PAID = RGBColor(0xC0, 0x39, 0x2B)
HEADER_BG = RGBColor(0x4A, 0x6A, 0x6F)


def _font(run, size=14, bold=False, color=TEXT):
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color


def _box(slide, left, top, width, height, fill=SURFACE, line=BLUE):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    shape.line.color.rgb = line
    shape.line.width = Pt(1)
    return shape


def _text_in(shape, lines, size=13, bold_first=False, color=TEXT, align=PP_ALIGN.LEFT):
    tf = shape.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.space_after = Pt(4)
        run = p.add_run()
        run.text = line
        _font(run, size=size, bold=(bold_first and i == 0), color=color)


def _accent_line(slide):
    line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.5), Inches(0.35), Inches(9), Inches(0.06))
    line.fill.solid()
    line.fill.fore_color.rgb = YELLOW_MD
    line.line.fill.background()


def _slide_title(slide, title, subtitle=None):
    _accent_line(slide)
    tb = slide.shapes.add_textbox(Inches(0.55), Inches(0.5), Inches(8.5), Inches(0.7))
    tf = tb.text_frame
    p = tf.paragraphs[0]
    r = p.add_run()
    r.text = title
    _font(r, size=26, bold=True, color=TEXT)
    if subtitle:
        p2 = tf.add_paragraph()
        r2 = p2.add_run()
        r2.text = subtitle
        _font(r2, size=12, color=MUTED)
    # MiMuse wordmark placeholder
    logo = slide.shapes.add_textbox(Inches(7.8), Inches(0.45), Inches(1.8), Inches(0.45))
    lr = logo.text_frame.paragraphs[0].add_run()
    lr.text = "MiMuse"
    _font(lr, size=20, bold=True, color=BLUE_DK)


def _arrow(slide, left, top):
    arr = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, left, top, Inches(0.35), Inches(0.22))
    arr.fill.solid()
    arr.fill.fore_color.rgb = SURFACE_MD
    arr.line.color.rgb = SURFACE_MD


def add_cover(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = SURFACE
    _accent_line(slide)
    tb = slide.shapes.add_textbox(Inches(0.8), Inches(2.4), Inches(8.5), Inches(1.2))
    p = tb.text_frame.paragraphs[0]
    r = p.add_run()
    r.text = "대시보드 자동화 시스템 워크플로우"
    _font(r, size=36, bold=True, color=TEXT)
    p2 = tb.text_frame.add_paragraph()
    r2 = p2.add_run()
    r2.text = "MiMuse Dashboard Automation System"
    _font(r2, size=18, color=BLUE_DK)
    p3 = tb.text_frame.add_paragraph()
    r3 = p3.add_run()
    r3.text = "트렌드 · 인플루언서 · 모니터링 · EMS 배송 추적"
    _font(r3, size=14, color=MUTED)


def add_architecture(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = WHITE
    _slide_title(slide, "MiMuse 대시보드 전체 아키텍처")

    # Left — Core
    lx, ly, bw, bh = Inches(0.55), Inches(1.35), Inches(4.35), Inches(5.5)
    _box(slide, lx, ly, bw, bh, fill=WHITE, line=SURFACE_MD)
    cap = slide.shapes.add_textbox(lx, Inches(1.1), bw, Inches(0.3))
    cr = cap.text_frame.paragraphs[0].add_run()
    cr.text = "코어 플랫폼"
    _font(cr, size=15, bold=True, color=TEXT)
    cap.text_frame.paragraphs[0].alignment = PP_ALIGN.CENTER

    inner = slide.shapes.add_textbox(lx + Inches(0.25), ly + Inches(0.2), bw - Inches(0.5), bh - Inches(0.4))
    tf = inner.text_frame
    tf.word_wrap = True
    lines = [
        ("프론트", True),
        ("React Dashboard (Vite / Vercel)", False),
        ("", False),
        ("백엔드", True),
        ("Google Apps Script (GAS API)", False),
        ("", False),
        ("데이터베이스", True),
        ("Supabase (Postgres + Storage)", False),
        ("  · 인플루언서 / 브랜드 / EMS / 모니터링", False),
        ("  · brand-archive · email-assets", False),
        ("Google Sheets", False),
        ("  · Beauty News 브리핑 JSON", False),
        ("  · (인플루언서 폼 데이터 → Supabase)", False),
    ]
    for i, (txt, bold) in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        r = p.add_run()
        r.text = txt
        _font(r, size=12 if not bold else 13, bold=bold, color=TEXT if bold else MUTED)

    # Right — External
    rx = Inches(5.1)
    _box(slide, rx, ly, bw, bh, fill=WHITE, line=SURFACE_MD)
    cap2 = slide.shapes.add_textbox(rx, Inches(1.1), bw, Inches(0.3))
    cr2 = cap2.text_frame.paragraphs[0].add_run()
    cr2.text = "External 플랫폼"
    _font(cr2, size=15, bold=True, color=TEXT)
    cap2.text_frame.paragraphs[0].alignment = PP_ALIGN.CENTER

    inner2 = slide.shapes.add_textbox(rx + Inches(0.25), ly + Inches(0.2), bw - Inches(0.5), bh - Inches(0.4))
    tf2 = inner2.text_frame
    tf2.word_wrap = True
    ext_lines = [
        ("1. 트렌드 분석", True),
        ("   Claude + Google Sheets", False),
        ("   Microsoft Outlook (Drafts / 발송)", False),
        ("", False),
        ("2. 인플루언서 리스트업", True),
        ("   TikTok Creator Marketplace (TCM) API", False),
        ("   Apify — automation-lab~tiktok-profile-scraper", False),
        ("", False),
        ("3. 아웃리치 / 컨택", True),
        ("   템플릿 관리 페이지 (/influencer/template)", False),
        ("   Microsoft Graph — Outlook Mail", False),
        ("", False),
        ("4. 인플루언서 모니터링", True),
        ("   Apify — clockworks~tiktok-profile-scraper", False),
        ("", False),
        ("5. 배송 추적", True),
        ("   17track API v2.4", False),
        ("   Korea Post (우체국 링크)", False),
    ]
    for i, (txt, bold) in enumerate(ext_lines):
        p = tf2.paragraphs[0] if i == 0 else tf2.add_paragraph()
        r = p.add_run()
        r.text = txt
        _font(r, size=12 if not bold else 13, bold=bold, color=TEXT if bold else MUTED)

    # Highlight monitoring sub-box
    sub = _box(slide, rx + Inches(0.35), ly + Inches(3.55), bw - Inches(0.7), Inches(0.95), fill=BLUE_LT, line=BLUE)
    _text_in(sub, ["모니터링 Apify Actor", "clockworks~tiktok-profile-scraper"], size=11, bold_first=True, color=BLUE_DK, align=PP_ALIGN.CENTER)


def add_pipeline_slide(prs, title, step1_title, step1_desc, step2_title, step2_desc, step3_title, step3_desc, collect, report):
    add_pipeline_slide_steps(
        prs,
        title,
        [
            (step1_title, step1_desc, False),
            (step2_title, step2_desc, True),
            (step3_title, step3_desc, False),
        ],
        collect,
        report,
    )


def add_pipeline_slide_steps(prs, title, steps, collect, report):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = WHITE
    _slide_title(slide, title, "자동화 파이프라인")

    n = len(steps)
    margin = Inches(0.45)
    gap = Inches(0.28)
    arrow_w = Inches(0.22)
    total_w = Inches(9.1)
    bw = (total_w - gap * (n - 1) - arrow_w * (n - 1)) / n
    bh = Inches(1.55)
    y = Inches(1.45)

    x = margin
    for i, (st, sd, highlight) in enumerate(steps):
        if i > 0:
            _arrow(slide, x - arrow_w - Inches(0.04), y + Inches(0.65))
            x += arrow_w
        fill = BLUE_LT if highlight else WHITE
        border = BLUE_DK if highlight else SURFACE_MD
        box = _box(slide, x, y, bw, bh, fill=fill, line=border)
        tf = box.text_frame
        tf.clear()
        tf.word_wrap = True
        p1 = tf.paragraphs[0]
        p1.alignment = PP_ALIGN.CENTER
        r1 = p1.add_run()
        r1.text = st
        _font(r1, size=12 if n > 3 else 14, bold=True, color=BLUE_DK if highlight else TEXT)
        p2 = tf.add_paragraph()
        p2.alignment = PP_ALIGN.CENTER
        r2 = p2.add_run()
        r2.text = sd
        _font(r2, size=9 if n > 3 else 10, color=MUTED)
        x += bw + gap

    foot = _box(slide, Inches(0.55), Inches(3.25), Inches(8.9), Inches(1.85), fill=SURFACE, line=SURFACE_MD)
    tf = foot.text_frame
    tf.clear()
    tf.word_wrap = True
    p = tf.paragraphs[0]
    r = p.add_run()
    r.text = "수집 데이터: "
    _font(r, size=11, bold=True, color=TEXT)
    r2 = p.add_run()
    r2.text = collect
    _font(r2, size=11, color=MUTED)
    p2 = tf.add_paragraph()
    r3 = p2.add_run()
    r3.text = "리포트 / 전달: "
    _font(r3, size=11, bold=True, color=TEXT)
    r4 = p2.add_run()
    r4.text = report
    _font(r4, size=11, color=MUTED)


def add_tools_table(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = SURFACE

    # Header bar
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.45), Inches(0.35), Inches(9.1), Inches(0.55))
    bar.fill.solid()
    bar.fill.fore_color.rgb = HEADER_BG
    bar.line.fill.background()
    ht = slide.shapes.add_textbox(Inches(0.6), Inches(0.42), Inches(7), Inches(0.45))
    hr = ht.text_frame.paragraphs[0].add_run()
    hr.text = "업무별 활용 툴 총정리"
    _font(hr, size=20, bold=True, color=WHITE)

    paid = slide.shapes.add_textbox(Inches(7.2), Inches(0.45), Inches(2.2), Inches(0.35))
    pr = paid.text_frame.paragraphs[0].add_run()
    pr.text = "💰 별도 유료 툴"
    _font(pr, size=10, bold=True, color=YELLOW_MD)

    rows = [
        ("트렌드 리서치", "Claude · Google Sheets · Supabase · Outlook"),
        ("틱톡 트렌드", "Microsoft Outlook Graph · GAS · React Dashboard"),
        ("인플루언서 서치 / 리스트업", "TikTok TCM API · Apify (automation-lab) · GAS · Supabase"),
        ("아웃리치 / 이메일 컨택", "템플릿 관리 페이지 · Outlook Mail · GAS · Supabase email_templates"),
        ("확정 인플루언서 데이터", "Google Form → Supabase · React Dashboard"),
        ("리뷰 모니터링", "Apify (clockworks) · GAS · Supabase monitoring_keywords"),
        ("콘텐츠 성과 리포트", "Supabase · React (computeContentReport)"),
        ("EMS 배송 추적", "17track API · GAS · Supabase ems_tracking"),
        ("EMS 발송 데이터", "Supabase · Excel(XLSX) export · 우체국 양식"),
        ("브랜드 DB / 컨택", "Excel import · Supabase · Outlook"),
        ("자료 아카이브", "Supabase Storage (brand-archive) · React 뷰어"),
        ("대시보드 집계", "Supabase · React HOME 카드"),
    ]
    paid_rows = {2, 5}  # 0-indexed rows with Apify / 17track mention — mark listup and monitoring

    table_shape = slide.shapes.add_table(len(rows) + 1, 2, Inches(0.55), Inches(1.05), Inches(8.9), Inches(4.8))
    table = table_shape.table
    table.columns[0].width = Inches(2.4)
    table.columns[1].width = Inches(6.5)

    headers = ("업무 카테고리", "활용 툴 (MiMuse 실제 구성)")
    for c, h in enumerate(headers):
        cell = table.cell(0, c)
        cell.fill.solid()
        cell.fill.fore_color.rgb = BLUE
        p = cell.text_frame.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = h
        _font(r, size=12, bold=True, color=WHITE)

    for ri, (cat, tools) in enumerate(rows, start=1):
        bg = WHITE if ri % 2 == 1 else SURFACE
        for ci in range(2):
            cell = table.cell(ri, ci)
            cell.fill.solid()
            cell.fill.fore_color.rgb = bg
            p = cell.text_frame.paragraphs[0]
            p.alignment = PP_ALIGN.LEFT
            txt = cat if ci == 0 else tools
            if ci == 0 and (ri - 1) in paid_rows:
                txt = cat + " 💰"
            r = p.add_run()
            r.text = txt
            _font(r, size=10, bold=(ci == 0), color=TEXT if ci == 0 else MUTED)


def add_cost_slide(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = WHITE
    _slide_title(slide, "비용이 발생하는 툴", "월 예상 비용 (2 phases · 50 influencers · 5 brands 기준)")

    rows = [
        ("툴", "요금 모델", "예상 비용 (월)", "용도"),
        ("Supabase Pro", "월 정액", "~$25/월", "DB 8GB + Storage 100GB"),
        ("Apify", "사용량 과금 💰", "~$23–43/월", "모니터링 클릭 + 영상 $0.25/개 · 리스트업 1000명 별도"),
        ("17track API", "API 플랜 💰", "~$4/월", "EMS 운송장 동기화"),
        ("Microsoft 365", "조직 라이선스 💰", "별도", "Outlook 발송 · 회신 동기화"),
        ("Vercel", "Free / Pro", "$0–10/월", "React 호스팅"),
        ("TikTok TCM API", "비즈니스 승인", "$0", "인플루언서 discover"),
        ("Google Apps Script", "Free tier", "$0", "백엔드 API"),
        ("Google Sheets", "Free", "$0", "Beauty News import"),
        ("Claude", "구독/사용량 💰", "별도", "뷰티 뉴스 큐레이션"),
    ]

    table_shape = slide.shapes.add_table(len(rows), 4, Inches(0.45), Inches(1.35), Inches(9.1), Inches(4.5))
    table = table_shape.table
    widths = [Inches(1.8), Inches(1.9), Inches(1.5), Inches(3.9)]
    for i, w in enumerate(widths):
        table.columns[i].width = w

    for ri, row in enumerate(rows):
        for ci, val in enumerate(row):
            cell = table.cell(ri, ci)
            if ri == 0:
                cell.fill.solid()
                cell.fill.fore_color.rgb = HEADER_BG
                color = WHITE
                bold = True
            else:
                cell.fill.solid()
                cell.fill.fore_color.rgb = WHITE if ri % 2 == 1 else SURFACE
                color = PAID if "💰" in val else (TEXT if ci == 0 else MUTED)
                bold = ci == 0
            p = cell.text_frame.paragraphs[0]
            r = p.add_run()
            r.text = val
            _font(r, size=9 if ri > 0 else 11, bold=bold, color=color)

    note = slide.shapes.add_textbox(Inches(0.5), Inches(6.0), Inches(9), Inches(0.55))
    tf = note.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    r = p.add_run()
    r.text = "※ 월 합계: Apify ~$23–43 + Supabase ~$25 + 17track ~$4 ≈ "
    _font(r, size=9, color=MUTED)
    r2 = p.add_run()
    r2.text = "~$52–72/월"
    _font(r2, size=9, bold=True, color=BLUE_DK)
    p2 = tf.add_paragraph()
    r3 = p2.add_run()
    r3.text = "※ Apify $/run → 다음 슬라이드 · 리스트업 1000명: 15 runs × $5 ≈ $75"
    _font(r3, size=9, color=MUTED)


def add_apify_per_run_slide(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = WHITE
    _slide_title(slide, "Apify 단가 (per video / per run)", "truefetch = 영상마다 과금 · 배치당 고정 아님")

    rows = [
        ("#", "Actor", "Pricing unit", "Example cost"),
        (
            "1",
            "automation-lab~tiktok-profile-scraper",
            "~$4–6 per UI click",
            "Listup 1 run",
        ),
        (
            "2",
            "clockworks~tiktok-profile-scraper",
            "~$0.8–1.2 per UI click",
            "Monitoring 1 run",
        ),
        (
            "3",
            "truefetch~tiktok-video-downloader",
            "$0.25 per video (MP4)",
            "50 videos = $12.50",
        ),
        (
            "4",
            "truefetch~tiktok-video-downloader",
            "$0.05 per video (metadata)",
            "50 videos = $2.50",
        ),
    ]

    table_shape = slide.shapes.add_table(len(rows), 4, Inches(0.45), Inches(1.35), Inches(9.1), Inches(3.6))
    table = table_shape.table
    col_w = [Inches(0.45), Inches(2.6), Inches(3.5), Inches(1.55)]
    for i, w in enumerate(col_w):
        table.columns[i].width = w

    for ri, row in enumerate(rows):
        for ci, val in enumerate(row):
            cell = table.cell(ri, ci)
            if ri == 0:
                cell.fill.solid()
                cell.fill.fore_color.rgb = HEADER_BG
                fc = WHITE
                bold = True
            else:
                cell.fill.solid()
                cell.fill.fore_color.rgb = WHITE if ri % 2 == 1 else SURFACE
                fc = TEXT if ci <= 1 else MUTED
                bold = ci == 0
            p = cell.text_frame.paragraphs[0]
            p.alignment = PP_ALIGN.CENTER if ci in (0, 3) else PP_ALIGN.LEFT
            p.word_wrap = True
            r = p.add_run()
            r.text = val
            _font(r, size=9 if ri > 0 else 11, bold=bold, color=fc)

    formula = _box(slide, Inches(0.5), Inches(5.15), Inches(9.0), Inches(1.35), fill=BLUE_LT, line=BLUE_DK)
    _text_in(
        formula,
        [
            "월 비용 = (클릭 × $/run) + (영상 수 × $/video)",
            "예) 50 리뷰 MP4: 50 × $0.25 = $12.50  ·  모니터링 10회 × $1 ≈ $10",
        ],
        size=11,
        bold_first=False,
        color=BLUE_DK,
        align=PP_ALIGN.CENTER,
    )


def add_apify_cost_slide(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = WHITE
    _slide_title(slide, "Apify 예상 비용", "리스트업 = 1000명 풀 (1회) · 나머지 = 월간 · 모두 수동 실행")

    rows = [
        ("Actor Purpose", "Recommended Actor", "Usage", "Est. Cost (USD)"),
        (
            "1. Listup — 1000 pool",
            "automation-lab~tiktok-profile-scraper",
            "10–20 runs × max 100/run\n(one-time)",
            "~$50 - $100",
        ),
        (
            "2. Monitoring (manual UI)",
            "clockworks/tiktok-profile-scraper",
            "up to 30 runs/mo × 50\n(if daily click)",
            "~$25 - $35",
        ),
        (
            "3. Video Download",
            "truefetch/tiktok-video-downloader",
            "50 matched reviews/mo\n× $0.25/video",
            "~$12.50",
        ),
        (
            "4. Metadata (optional)",
            "truefetch/tiktok-video-downloader",
            "Usually skip — monitoring\nalready has stats",
            "~$0",
        ),
        ("MONTHLY TOTAL (②③)", "", "", "~$23 - $43"),
    ]

    table_shape = slide.shapes.add_table(len(rows), 4, Inches(0.45), Inches(1.35), Inches(9.1), Inches(4.8))
    table = table_shape.table
    col_w = [Inches(2.0), Inches(2.5), Inches(2.6), Inches(2.0)]
    for i, w in enumerate(col_w):
        table.columns[i].width = w

    for ri, row in enumerate(rows):
        for ci, val in enumerate(row):
            cell = table.cell(ri, ci)
            if ri == 0:
                cell.fill.solid()
                cell.fill.fore_color.rgb = HEADER_BG
                fc = WHITE
                bold = True
            elif ri == len(rows) - 1:
                cell.fill.solid()
                cell.fill.fore_color.rgb = YELLOW_MD
                fc = YELLOW_TEXT
                bold = True
            else:
                cell.fill.solid()
                cell.fill.fore_color.rgb = WHITE if ri % 2 == 1 else SURFACE
                fc = TEXT if ci == 0 else MUTED
                bold = ci == 0
            p = cell.text_frame.paragraphs[0]
            p.alignment = PP_ALIGN.CENTER if ci > 0 else PP_ALIGN.LEFT
            p.word_wrap = True
            r = p.add_run()
            r.text = val
            _font(r, size=9 if ri > 0 else 11, bold=bold, color=fc)

    tip = slide.shapes.add_textbox(Inches(0.5), Inches(6.35), Inches(9), Inches(0.55))
    tf = tip.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    tr = p.add_run()
    tr.text = "※ truefetch: $0.25/영상(download) · $0.05/영상(metadata) — 50영상=$12.50 not $2.50 total"
    _font(tr, size=9, color=MUTED)


def main():
    prs = Presentation()
    prs.slide_width = Inches(10)
    prs.slide_height = Inches(7.5)

    add_cover(prs)
    add_architecture(prs)

    add_pipeline_slide(
        prs,
        "트렌드 분석 자동화 — 뷰티 뉴스 브리핑",
        "Claude + Google Sheet",
        "US 뷰티 뉴스 JSON\n주간 카테고리 · 키워드 입력",
        "GAS + Supabase",
        "importBeautyNewsFromSheet\nbeauty_news_archives 저장",
        "Dashboard / Outlook",
        "HOME 브리핑 카드\n월요일 09:00 KST 이메일 발송",
        "뉴스 제목 · 링크 · 출처 · 요약 · 카테고리별 건수 · 키워드 설명",
        "주간 트렌드 요약 · 카테고리별 Top 기사 · US 뷰티 키워드 인사이트 · 아카이브 페이지",
    )

    add_pipeline_slide(
        prs,
        "인플루언서 리스트업 자동화",
        "TikTok TCM + Apify",
        "TCM creator discover\nApify profile scrape (최대 200명/run)",
        "GAS tcmRunSearch",
        "dedup · 이메일 추출 · 티어 분류\nSupabase influencers 저장",
        "서치 UI + Dashboard",
        "탐색 결과 테이블\n서치 완료 N/1000 통계",
        "핸들 · 표시명 · 이메일 · 팔로워 · 프로필 URL · 아바타 · 티어",
        "티어별 후보 수 · 필터 제외 통계 (이메일 없음/중복) · 컨택 예정 수",
    )

    add_pipeline_slide_steps(
        prs,
        "아웃리치 (인플루언서 컨택) 자동화",
        [
            ("Supabase", "contacted 인플루언서\n이메일 템플릿 DB", False),
            ("템플릿 관리 페이지", "create template\n제목 · 본문 · 서명 편집\nemail_templates 저장", False),
            ("Outlook + GAS", "템플릿 기반 이메일 발송\nsendOutreachEmail\n회신 · 오류 동기화", True),
            ("인플루언서 컨택 페이지", "상태 업데이트\noutreach_messages 로그", False),
        ],
        "이메일 · 템플릿 · 기존 컨택 이력 · 발송 일시",
        "발송 성과율 · 회신 수 · 협상/확정 상태 · 배송 실패 알림",
    )

    add_pipeline_slide(
        prs,
        "인플루언서 모니터링 자동화",
        "Apify (clockworks)",
        "TikTok 50명 × 50영상 스크랩\n기간 필터 (MON_START/END)\n현재: UI 수동 실행 · 계획: 주 1회",
        "GAS 키워드 매칭",
        "monitoring_keywords vs 캡션\nviews/likes/comments 저장",
        "모니터링 UI",
        "리뷰 테이블 · 콘텐츠 성과 리포트\n대시보드 브랜드별 리뷰",
        "영상 URL · 조회수 · 좋아요 · 댓글 · 게시일 · 캡션 텍스트",
        "키워드 히트 영상 · 브랜드별 리뷰 수 · 플랫폼별 성과 요약",
    )

    add_pipeline_slide(
        prs,
        "배송 추적 (EMS) 자동화",
        "수동 입력 + 17track",
        "접수번호 · 등기번호 등록\n17track API 조회",
        "GAS 동기화",
        "syncAllEmsTracking\n상태 한글 매핑 → ems_tracking",
        "EMS UI + Dashboard",
        "배송 상태 · 17track/우체국 링크\n배송 중/완료/오류 통계",
        "접수번호 · 등기번호 · 배송 상태 · 이벤트 타임라인 · 수취인 주소",
        "배송 중 N건 · 완료 N건 · 예외/재발송 N건 · 마지막 업데이트",
    )

    add_tools_table(prs)
    add_cost_slide(prs)
    add_apify_per_run_slide(prs)
    add_apify_cost_slide(prs)

    target = OUT
    try:
        prs.save(target)
    except PermissionError:
        try:
            target = OUT_ALT
            prs.save(target)
            print("Note: close the open .pptx in PowerPoint, then re-run to overwrite the main file.")
        except PermissionError:
            for candidate in (OUT_FALLBACK, OUT_TEMP):
                try:
                    target = candidate
                    prs.save(target)
                    print(f"Note: pipeline folder files locked - saved to {target}")
                    break
                except PermissionError:
                    continue
            else:
                raise
    print(f"Saved: {target}")


if __name__ == "__main__":
    main()
