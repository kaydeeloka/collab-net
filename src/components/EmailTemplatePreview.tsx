import React from 'react'
import { renderEmailBodyPreview } from '@/lib/template/email-body-format'
import { getEmailTemplateUiConfig } from '@/lib/template/email-template-ui-config'
import type { EmailTemplateDomain } from '@/lib/template/email-templates'

export interface EmailTemplatePreviewPanelProps {
  title: string
  body: string
  domain: EmailTemplateDomain
  /** `card` — editor inline box; `message` — email-client header + body */
  layout?: 'card' | 'message'
  signatureHtml?: string | null
  showRecipient?: boolean
}

function renderRecipientLine(
  domain: EmailTemplateDomain,
  dummyValues: Record<string, { value: string; color: string }>,
) {
  if (domain === 'brand') {
    const brand = dummyValues['{{브랜드명}}']
    const contact = dummyValues['{{담당자}}']
    const position = dummyValues['{{직함}}']
    if (!brand || !contact) return null
    return (
      <div style={{ fontSize: 10, color: 'var(--gray-4)', marginBottom: 8 }}>
        받는 사람 ·{' '}
        <span style={{ color: brand.color, fontWeight: 700 }}>{brand.value}</span>
        {' '}
        <span style={{ color: contact.color, fontWeight: 700 }}>{contact.value}</span>
        {position && <span style={{ color: 'var(--gray-5)' }}> {position.value}</span>}
      </div>
    )
  }

  if (domain === 'influencer') {
    const name = dummyValues['{{이름}}']
    const email = dummyValues['{{이메일}}']
    if (!name || !email) return null
    return (
      <div style={{ fontSize: 10, color: 'var(--gray-4)', marginBottom: 8 }}>
        받는 사람 · <span style={{ color: name.color, fontWeight: 700 }}>{name.value}</span>
        {' <'}<span style={{ color: email.color, fontWeight: 700 }}>{email.value}</span>{'>'}
      </div>
    )
  }

  const emsName = dummyValues['{이름}']
  if (!emsName) return null
  return (
    <div style={{ fontSize: 10, color: 'var(--gray-4)', marginBottom: 8 }}>
      받는 사람 · <span style={{ color: emsName.color, fontWeight: 700 }}>{emsName.value}</span>
    </div>
  )
}

function SignatureBlock({ html }: { html: string }) {
  return (
    <div
      style={{ marginTop: 16, fontSize: 13, color: 'var(--gray-7)', lineHeight: 1.6 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export function EmailTemplatePreviewPanel({
  title,
  body,
  domain,
  layout = 'message',
  signatureHtml,
  showRecipient,
}: EmailTemplatePreviewPanelProps) {
  const { previewSender, dummyValues } = getEmailTemplateUiConfig(domain)
  const recipient = showRecipient ?? layout === 'message'

  const titleContent = title
    ? renderEmailBodyPreview(title, dummyValues)
    : <span style={{ color: 'var(--gray-4)', fontStyle: 'italic' }}>(제목 없음)</span>

  const bodyContent = body
    ? renderEmailBodyPreview(body, dummyValues)
    : <span style={{ color: 'var(--gray-4)', fontStyle: 'italic' }}>본문 없음</span>

  if (layout === 'card') {
    return (
      <div style={{ background: 'var(--gray-1)', borderRadius: 10, padding: '14px 18px', border: '1px solid var(--gray-2)' }}>
        <div style={{ fontSize: 10, color: 'var(--gray-4)', marginBottom: 6 }}>{previewSender}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-8)', marginBottom: 10 }}>{titleContent}</div>
        <div style={{ fontSize: 13, color: 'var(--gray-7)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
          {bodyContent}
        </div>
        {signatureHtml ? <SignatureBlock html={signatureHtml} /> : null}
      </div>
    )
  }

  return (
    <>
      <div style={{ background: 'var(--gray-1)', padding: '12px 20px', borderBottom: '1px solid var(--gray-2)' }}>
        <div style={{ fontSize: 10, color: 'var(--gray-4)', marginBottom: 8 }}>{previewSender}</div>
        {recipient ? renderRecipientLine(domain, dummyValues) : null}
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-8)' }}>{titleContent}</div>
      </div>
      <div style={{ padding: '24px 20px', fontSize: 13, color: 'var(--gray-7)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
        {bodyContent}
        {signatureHtml ? <SignatureBlock html={signatureHtml} /> : null}
      </div>
    </>
  )
}

export interface EmailTemplatePreviewModalProps {
  open: boolean
  onClose: () => void
  templateName?: string
  title: string
  body: string
  domain: EmailTemplateDomain
  footer?: React.ReactNode
  signatureHtml?: string | null
}

export function EmailTemplatePreviewModal({
  open,
  onClose,
  templateName,
  title,
  body,
  domain,
  footer,
  signatureHtml,
}: EmailTemplatePreviewModalProps) {
  if (!open) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 16, width: 560, maxWidth: '90vw', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--gray-2)' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-8)' }}>
            미리보기{templateName ? ` — ${templateName}` : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--gray-2)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ×
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <EmailTemplatePreviewPanel
            title={title}
            body={body}
            domain={domain}
            layout="message"
            signatureHtml={signatureHtml}
          />
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          {footer ?? (
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '6px 14px', background: 'var(--gray-1)', color: 'var(--gray-6)', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              닫기
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
