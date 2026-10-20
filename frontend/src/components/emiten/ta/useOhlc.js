// Candle harian 1 tahun dari /api/ohlc + indikator & sinyal (dipakai tab Teknikal dan Spekulasi).
import { computed, ref, shallowRef, watch } from 'vue'
import { api } from '../../../api.js'
import { indicators, taSignals } from '../../../lib/ta.js'

export const errText = e => e?.status === 401 ? 'Token Stockbit belum ada atau ditolak' : (e?.message || 'server lokal tidak merespons')

export function useOhlc(ticker) {
  const loading = ref(true), error = ref(''), bars = shallowRef(null)
  let seq = 0
  watch(ticker, async t => {
    const my = ++seq
    loading.value = true; error.value = ''; bars.value = null
    try {
      const j = await api.get('/api/ohlc', { ticker: t, tf: '1y' })
      const b = (j.bars || []).filter(x => x.c > 0)
      if (b.length < 35) throw new Error('data harga kurang dari 35 hari bursa')
      if (my === seq) bars.value = b
    } catch (e) {
      if (my === seq) error.value = errText(e)
    } finally {
      if (my === seq) loading.value = false
    }
  }, { immediate: true })
  const ind = computed(() => bars.value && indicators(bars.value))
  const sig = computed(() => bars.value && taSignals(bars.value, ind.value))
  return { loading, error, bars, ind, sig }
}
