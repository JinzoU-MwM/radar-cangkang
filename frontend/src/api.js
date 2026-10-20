// Pembungkus fetch ke server.py. GET bisa diberi fresh=1 selama jendela waktu
// setelah pengguna menekan tombol "Perbarui" (pengganti monkey-patch fetch lama).
let freshUntil = 0

async function req(method, path, { params, body } = {}) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null && v !== '') q.set(k, v)
  if (method === 'GET' && path.startsWith('/api/') && path !== '/api/status' && Date.now() < freshUntil) q.set('fresh', '1')
  const url = path + (q.toString() ? '?' + q : '')
  const opt = { method, cache: 'no-store' }
  if (body !== undefined) {
    opt.headers = { 'Content-Type': 'application/json' }
    opt.body = JSON.stringify(body)
  }
  const r = await fetch(url, opt)
  const data = await r.json().catch(() => null)
  if (!r.ok) {
    const e = new Error((data && data.error) || `HTTP ${r.status}`)
    e.status = r.status
    e.data = data
    throw e
  }
  return data
}

export const api = {
  get: (path, params) => req('GET', path, { params }),
  put: (path, body) => req('PUT', path, { body }),
  post: (path, body) => req('POST', path, { body }),
  del: path => req('DELETE', path),
  freshFor(ms) { freshUntil = Date.now() + ms },
}

// File data statis (story-verified.json, dll). Gagal = objek kosong, halaman tetap jalan.
export async function loadJson(name) {
  try {
    const r = await fetch(name, { cache: 'no-store' })
    return r.ok ? await r.json() : {}
  } catch {
    return {}
  }
}
