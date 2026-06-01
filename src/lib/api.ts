export const GAS_URL =
  'https://script.google.com/macros/s/AKfycbzKunmZIbHEpLwe5rJs8qK_bv_eqh0kIDuB6JxhfNjxclWiuXV_w0IwW-0og5zShHLR/exec'

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
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

export async function gasPost<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify(body),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}
