import { describe, it, expect } from 'vitest'
import { stageOf } from '../domain.js'
import { syncTenders, syncStockbit, syncReports, inferMilestones } from '../sync.js'

const httpErr = (status, msg) => Object.assign(new Error(msg), { status })
const fakeApi = routes => ({ async get(path, params) { const r = routes[path]; if (!r) throw httpErr(404, 'tidak ada'); return typeof r === 'function' ? r(params) : r } })

describe('syncTenders', () => {
  it('menambah emiten baru, menyalakan tonggak, tidak memutasi input', async () => {
    const items = [{ id: 'OLDX', ticker: 'OLDX', stage: 'radar' }, { id: 'EXCL', ticker: 'EXCL' }]
    const api = fakeApi({ '/api/tenders': { exclude: ['EXCL'], items: [
      { ticker: 'OLDX', price: 75, percent: 10.5, start: '2020-01-01', end: '2020-01-20', paydate: '2020-02-01' },
      { ticker: 'NEWX', name: 'Baru' }] } })
    const out = await syncTenders(items, api)
    expect(items[0].stage).toBe('radar')
    expect(out.map(x => x.ticker)).toEqual(['OLDX', 'NEWX'])
    expect(out[0].ms).toEqual({ spa: true, akuisisi: true, to_umum: true, to_selesai: true })
    expect(stageOf(out[0])).toBe('tender')   // tahap diturunkan dari tonggak
    expect(out[1].ms).toEqual({ spa: true })
  })
})

describe('syncStockbit', () => {
  it('berhenti saat 401 dan mencatat error', async () => {
    const errors = []
    const api = fakeApi({ '/api/quote': () => { throw httpErr(401, 'token') } })
    const out = await syncStockbit([{ ticker: 'AAAA' }, { ticker: 'BBBB' }], api, { errors, delay: 0 })
    expect(errors).toEqual([{ source: 'AAAA', error: 'token' }])
    expect(out).toHaveLength(2)
  })
  it('memperbarui harga & kepemilikan', async () => {
    const api = fakeApi({ '/api/quote': { price: 50, volume: 300, avgVolume: 100 }, '/api/ownership': { marketCap: 123.45e9, freeFloat: 20, controllerPct: 70, controllerName: 'PT X' } })
    const prog = []
    const [d] = await syncStockbit([{ ticker: 'AAAA' }], api, { delay: 0, onProgress: (i, n) => prog.push([i, n]) })
    expect(prog).toEqual([[1, 1]])
    expect(d.price).toBe(50); expect(d.mcap).toBe(123.5); expect(d.flags.volume).toBe(true); expect(d.ctrlName).toBe('PT X')
  })
})

describe('inferMilestones & syncReports', () => {
  it('tanpa data tender: pengambilalihan paling awal jadi patokan', () => {
    const d = inferMilestones({ id: 'A' }, [
      { date: '2026-01-01', title: 'Pengambilalihan saham' },
      { date: '2026-02-01', title: 'Penawaran tender wajib' },
      { date: '2026-03-01', title: 'Risalah RUPSLB' }])
    expect(d.ms).toEqual({ akuisisi: true, to_umum: true, rupslb: true })
    expect(d.msAuto.rupslb).toBe('2026-03-01')
  })
  it('HMETD, KJPP, inbreng hanya dengan bukti pelaksanaan; deteksi lama dihitung ulang', () => {
    const base = { id: 'A', tender: { paydate: '2026-01-01' }, ms: { to_selesai: true, rights: true }, msAuto: { rights: '2026-02-01' } }
    const d = inferMilestones(base, [
      { date: '2026-02-01', title: 'Rencana PMHMETD I' },
      { date: '2026-02-02', title: 'Penunjukan KJPP untuk laporan penilai' },
      { date: '2026-02-03', title: 'Prospektus PMHMETD I' },
      { date: '2026-02-04', title: 'Perkembangan negosiasi akuisisi' }])
    expect(d.ms).toEqual({ to_selesai: true, rights: true })
    expect(d.msAuto.rights).toBe('2026-02-03')
  })
  it('menggabung laporan berdasarkan id dan mengumpulkan error', async () => {
    const items = [{ id: 'ABCD', ticker: 'ABCD', stage: 'tender' }]
    const updates = [{ id: 'sb-report-1', ticker: 'ABCD', title: 'lama' }]
    const api = fakeApi({ '/api/reports': { items: [{ id: 'sb-report-1', title: 'baru' }, { id: 'sb-report-2', title: 'x' }] },
      '/api/news': { items: [], errors: [{ source: 'Kontan', error: 'timeout' }] } })
    const prog = []
    const r = await syncReports(items, updates, api, { news: true, delay: 0, onProgress: (i, n) => prog.push(`${i}/${n}`) })
    expect(prog).toEqual(['1/1'])
    expect(r.addedNews).toBe(0)
    expect(updates[0].title).toBe('lama')
    expect(r.updates.map(u => u.title)).toEqual(['baru', 'x'])
    expect(r.added).toBe(1)
    expect(r.errors).toEqual([{ source: 'Kontan', error: 'timeout' }])
  })
})
