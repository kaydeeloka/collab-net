export const GAS_URL =
  'https://script.google.com/macros/s/AKfycbzKunmZIbHEpLwe5rJs8qK_bv_eqh0kIDuB6JxhfNjxclWiuXV_w0IwW-0og5zShHLR/exec'

async function parseGasResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!res.ok) {
    throw new Error('HTTP ' + res.status + (text ? ': ' + text.slice(0, 200) : ''))
  }
  try {
    return JSON.parse(text) as T
  } catch {
    const refMatch = text.match(/ReferenceError:\s*([^(<]+)/)
    if (refMatch) {
      throw new Error(
        `GAS 배포 오류: ${refMatch[1].trim()} — Apps Script에 api 폴더의 모든 .gs 파일이 있는지 확인하고 새 배포를 하세요.`,
      )
    }
    throw new Error('GAS 응답이 JSON이 아닙니다. Web App을 "새 배포"로 다시 배포했는지 확인하세요.')
  }
}

export async function gasGet<T = unknown>(
  action: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const qs = new URLSearchParams({
    action,
    _t: String(Date.now()),
    ...Object.fromEntries(
      Object.entries(params || {}).map(([k, v]) => [k, String(v)]),
    ),
  })
  const res = await fetch(GAS_URL + '?' + qs, { redirect: 'follow', cache: 'no-store' })
  return parseGasResponse<T>(res)
}

export async function gasPost<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow',
  })
  return parseGasResponse<T>(res)
}
