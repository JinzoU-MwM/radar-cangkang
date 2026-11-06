"""Uji endpoint data radar (items, updates, migrate, layout) dan perbaikan server.

Jalankan: python3 website/test_server.py
"""
import json
import time
import tempfile
import threading
import unittest
import unittest.mock
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

from datetime import datetime, timedelta
import server

# Data contoh tradersaham untuk tes (file asli tsa-*.json tidak dilacak git).
_TSA_TMP = tempfile.TemporaryDirectory()
for _n, _d in {"signals": {"ASPI": {"regimeSignal": "BULL"}}, "gems": {}, "foreign-flow": [],
               "broker-scanner": {"stocks": []}, "meta": {"sumber": "tes"}}.items():
    (Path(_TSA_TMP.name) / f"tsa-{_n}.json").write_text(json.dumps(_d))
server.TSA_DIR = Path(_TSA_TMP.name)
server._TSA_MEMO.clear()


class DataApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        server.DATA_DB = Path(cls.tmp.name) / "radar.sqlite"
        server._data = None
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.srv.server_address[1]}"
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.tmp.cleanup()

    def call(self, method, path, body=None, ctype="application/json", public=False):
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(self.base + path, data=data, method=method)
        if public:
            req.add_header("Cf-Connecting-Ip", "203.0.113.9")  # seperti request lewat Cloudflare Tunnel
        if ctype:
            req.add_header("Content-Type", ctype)
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read() or b"null")
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b"null")

    def test_01_migrate_once_then_items(self):
        payload = {"items": [{"ticker": "NAYZ", "stage": "tender"}, {"ticker": "bad"}],
                   "updates": [{"id": "news-1", "date": "2026-10-13", "ticker": "KETR"}]}
        st, res = self.call("POST", "/api/migrate", payload)
        self.assertEqual((st, res["migrated"], res["items"], res["updates"]), (200, True, 1, 1))
        st, res = self.call("POST", "/api/migrate", payload)
        self.assertFalse(res["migrated"])
        st, items = self.call("GET", "/api/items")
        self.assertEqual([i["ticker"] for i in items], ["NAYZ"])

    def test_02_put_delete_item(self):
        st, _ = self.call("PUT", "/api/items/BIKE", {"ticker": "BIKE", "notes": "x"})
        self.assertEqual(st, 200)
        st, _ = self.call("PUT", "/api/items/BIKE", {"ticker": "NAYZ"})
        self.assertEqual(st, 400)  # ticker di body harus sama dengan path
        st, _ = self.call("PUT", "/api/items/bike", {"ticker": "bike"})
        self.assertEqual(st, 404)
        self.call("DELETE", "/api/items/BIKE", ctype=None)
        _, items = self.call("GET", "/api/items")
        self.assertNotIn("BIKE", [i["ticker"] for i in items])

    def test_03_content_type_required(self):
        st, _ = self.call("PUT", "/api/items/NAYZ", {"ticker": "NAYZ"}, ctype="text/plain")
        self.assertEqual(st, 400)

    def test_04_updates_and_layout(self):
        st, _ = self.call("POST", "/api/updates", [{"id": "sb-1", "date": "2026-10-14"}])
        self.assertEqual(st, 200)
        st, _ = self.call("POST", "/api/updates", [{"date": "x"}])
        self.assertEqual(st, 400)
        self.call("PUT", "/api/layout/NAYZ", {"saiko": {"x": 1, "y": 2}})
        _, lay = self.call("GET", "/api/layout/NAYZ")
        self.assertEqual(lay, {"saiko": {"x": 1, "y": 2}})

    def test_05_ohlc_bad_ticker_not_500(self):
        st, _ = self.call("GET", "/api/ohlc?ticker=xx&tf=3m", ctype=None)
        self.assertIn(st, (400, 401))

    def test_06_tsa_summary_endpoint(self):
        st, res = self.call("GET", "/api/tsa/summary?ticker=ASPI", ctype=None)
        self.assertEqual(st, 200)
        self.assertEqual(res["ticker"], "ASPI")
        self.assertTrue(res["ada"])
        st, _ = self.call("GET", "/api/tsa/summary?ticker=bad", ctype=None)
        self.assertEqual(st, 400)
        st, res = self.call("GET", "/api/tsa/signals", ctype=None)
        self.assertEqual((st, res["rows"][0]["regimeSignal"]), (200, "BULL"))
        st, res = self.call("GET", "/api/tsa/broker-scanner", ctype=None)
        self.assertEqual((st, res["rows"]), (200, []))
        st, _ = self.call("GET", "/api/tsa/rahasia", ctype=None)
        self.assertNotEqual(st, 200)  # hanya 4 sumber yang dikenal

    def test_07_public_is_read_only(self):
        st, res = self.call("PUT", "/api/items/NAYZ", {"ticker": "NAYZ"}, public=True)
        self.assertEqual(st, 403)
        st, res = self.call("GET", "/api/status", ctype=None, public=True)
        self.assertTrue(res["readOnly"])
        st, res = self.call("GET", "/api/status", ctype=None)
        self.assertFalse(res["readOnly"])
        st, items = self.call("GET", "/api/items", ctype=None, public=True)
        self.assertEqual(st, 200)

    def test_08_kandidat_hide(self):
        req = lambda m: urllib.request.urlopen(urllib.request.Request(
            self.base + "/api/kandidat/hidden/ABCD", data=b"{}" if m == "PUT" else None, method=m,
            headers={"Content-Type": "application/json"}))
        self.assertEqual(json.loads(req("PUT").read())["ok"], True)
        self.assertEqual(server.data_rows("SELECT ticker FROM kandidat_hidden"), [("ABCD",)])
        req("DELETE")
        self.assertEqual(server.data_rows("SELECT ticker FROM kandidat_hidden"), [])

    def test_09_diff_since_snapshot(self):
        server.item_put({"id": "DIFX", "ticker": "DIFX", "stage": "tender", "price": 100, "ctrlPct": 50,
                         "ms": {"spa": True}, "flags": {}})
        server.snapshot_today(force=True)
        server.item_put({"id": "DIFX", "ticker": "DIFX", "stage": "tender", "price": 120, "ctrlPct": 75,
                         "ms": {"spa": True, "akuisisi": True}, "flags": {}})
        d = {x["ticker"]: x["changes"] for x in server.get_diff(1)["items"]}
        kinds = {c["k"]: c for c in d["DIFX"]}
        self.assertEqual(kinds["price"]["pct"], 20.0)
        self.assertEqual((kinds["ctrl"]["from"], kinds["ctrl"]["to"]), (50, 75))
        self.assertEqual(kinds["ms"]["added"], ["akuisisi"])
        server.data_exec("DELETE FROM items WHERE ticker=?", [("DIFX",)])

    def test_06_static_traversal_blocked(self):
        st, _ = self.call("GET", "/..%2fserver.py", ctype=None)
        self.assertEqual(st, 404)
        for f in ("/server.py", "/tsa_refresh.py", "/test_server.py", "/tsa-signals.json"):
            st, _ = self.call("GET", f, ctype=None)
            self.assertEqual(st, 404, f)


class CacheTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        server.CACHE_DB = Path(self.tmp.name) / "cache.sqlite"
        server._db = None
        server._fail_until.clear()

    def tearDown(self):
        server._db = None
        self.tmp.cleanup()

    def test_fresh_reuses_recent_copy(self):
        calls = []
        f = lambda: calls.append(1) or "body"
        url = "https://exodus.stockbit.com/emitten/NAYZ/profile"
        self.assertEqual(server.cached_text(url, f), "body")
        self.assertEqual(server.cached_text(url, f, fresh=True), "body")
        self.assertEqual(len(calls), 1)  # salinan < 5 menit dipakai walau fresh

    def test_public_reads_cache_only(self):
        url = "https://exodus.stockbit.com/emitten/BBCA/profile"
        server._req.public = True
        try:
            with self.assertRaises(server.PublicNoCache):
                server.cached_text(url, lambda: self.fail("tidak boleh memanggil Stockbit"))
            server.cache_write(url, "lama")
            self.assertEqual(server.cached_text(url, lambda: self.fail("tidak boleh memanggil")), "lama")
        finally:
            server._req.public = False

    def test_public_fetch_radar_with_budget(self):
        url = "https://exodus.stockbit.com/emitten/APEX/profile"
        server._req.public, server._req.public_fetch = True, True
        old = server.PUBLIC_BUDGET
        try:
            calls = []
            self.assertEqual(server.cached_text(url, lambda: calls.append(1) or "baru"), "baru")
            self.assertEqual(server.cached_text(url, lambda: calls.append(1) or "lagi"), "baru")  # TTL biasa
            self.assertEqual(len(calls), 1)
            server.PUBLIC_BUDGET = 0  # jatah habis: tanpa cache = PublicNoCache
            with self.assertRaises(server.PublicNoCache):
                server.cached_text(url + "x", lambda: self.fail("jatah habis, tidak boleh memanggil"))
        finally:
            server.PUBLIC_BUDGET = old
            server._req.public, server._req.public_fetch = False, False

    def test_prune_and_memo_cap(self):
        server.cache_write("https://x/lama", "a")
        server.cache_write("https://x/baru", "b")
        con = server.db()
        con.execute("UPDATE http_cache SET fetched_at=0 WHERE url='https://x/lama'")
        con.commit()
        self.assertEqual(server.cache_prune(), 1)
        self.assertIsNone(server.cache_read("https://x/lama", 0))
        self.assertEqual(server.cache_read("https://x/baru", 0), "b")
        old = server._benchmark
        server._benchmark = lambda deals, fresh=False: {"n": len(deals)}
        try:
            server._bm_memo.clear()
            for i in range(server.BM_MEMO_MAX + 10):
                server.get_benchmark([f"ABCD:2026-01-{i:02d}"])
            self.assertEqual(len(server._bm_memo), server.BM_MEMO_MAX)
        finally:
            server._benchmark = old
            server._bm_memo.clear()

    def test_failure_backoff_uses_stale(self):
        url = "https://exodus.stockbit.com/stream/v3/symbol/NAYZ"
        server.cache_write(url, "lama")
        con = server.db()
        con.execute("UPDATE http_cache SET fetched_at=0")
        con.commit()
        calls = []

        def boom():
            calls.append(1)
            raise RuntimeError("401")
        self.assertEqual(server.cached_text(url, boom), "lama")
        self.assertEqual(server.cached_text(url, boom), "lama")
        self.assertEqual(len(calls), 1)  # percobaan kedua tidak memanggil Stockbit


class KandidatTest(unittest.TestCase):
    def test_tts_set_key_guards(self):
        old_cfg, old_try = server.tts_config, server.tts_try_key
        try:
            server.tts_try_key = lambda k, r: False
            self.assertEqual(server.tts_set_key({"key": "pendek"}, True, "1.1.1.1")[0], 400)          # format salah
            server.tts_config = lambda: ("x" * 32, "southeastasia")
            self.assertEqual(server.tts_set_key({"key": "A" * 32}, True, "1.1.1.2")[0], 403)          # publik tidak boleh mengganti
            server.tts_config = lambda: None
            self.assertEqual(server.tts_set_key({"key": "A" * 32}, True, "1.1.1.3")[0], 400)          # ditolak Azure, tidak disimpan
            for _ in range(5):
                server.tts_set_key({"key": "A" * 32}, True, "1.1.1.4")
            self.assertEqual(server.tts_set_key({"key": "A" * 32}, True, "1.1.1.4")[0], 429)          # batas percobaan
        finally:
            server.tts_config, server.tts_try_key = old_cfg, old_try

    def test_tts_cache_and_fallback(self):
        import tempfile
        from pathlib import Path
        old_dir, old_cfg = server.TTS_DIR, server.tts_config
        with tempfile.TemporaryDirectory() as d:
            server.TTS_DIR = Path(d)
            try:
                server.tts_config = lambda: None
                self.assertIsNone(server.tts_audio("Halo"))            # tanpa kunci: frontend pakai suara browser
                import hashlib
                p = Path(d) / (hashlib.sha1(f"{server.TTS_VOICE}|Halo dunia".encode()).hexdigest() + ".mp3")
                p.write_bytes(b"ID3x")
                self.assertEqual(server.tts_audio("  Halo   dunia "), b"ID3x")   # cache dipakai tanpa kunci
                self.assertEqual(server.tts_usage()["karakter"], 0)
            finally:
                server.TTS_DIR, server.tts_config = old_dir, old_cfg

    def test_catchup_plan(self):
        now = datetime(2026, 10, 23, 12, 0).timestamp()
        self.assertEqual(server.catchup_plan("2026-10-23T08:00:00.000Z", now)[0], 1)
        self.assertEqual(server.catchup_plan("2026-10-15T08:00:00.000Z", now), (server.CATCHUP_PAGES, "2026-10-15"))
        self.assertEqual(server.catchup_plan(None, now)[0], server.CATCHUP_PAGES)

    def test_sb_news_pages_stop_at_since(self):
        calls = []
        def fake(url, fresh=False):
            calls.append(url)
            n = len(calls)
            return {"data": {"stream": [{"stream_id": n, "title": f"Berita {n}", "created_at": f"2026-10-{24 - n * 3:02d} 10:00:00", "content": ""}],
                             "pagination": {"is_last_page": False, "next_cursor": 100 + n}}}
        old, server.stockbit_api = server.stockbit_api, fake
        try:
            out = server.get_sb_news({"url": "https://x/stream/v3/symbol/{ticker}?category=STREAM_CATEGORY_REPORTS&report_type=REPORT_TYPE_ALL&last_stream_id=0&limit=30"},
                                     "DOOH", pages=4, since="2026-10-16")
        finally:
            server.stockbit_api = old
        self.assertEqual(len(calls), 3)            # 21, 18, lalu 15 < 16: berhenti
        self.assertIn("last_stream_id=101", calls[1])
        self.assertTrue(all("STREAM_CATEGORY_NEWS" in c and "report_type" not in c for c in calls))
        self.assertEqual(len(out), 3)

    def test_sb_news_convert(self):
        res = {"data": {"stream": [{"stream_id": 9, "title": "DOOH Teken MoU AI Data Center", "created_at": datetime.now().strftime("%Y-%m-%d 10:00:00"),
                                    "content": "PT Era Media Sejahtera Tbk (DOOH) menandatangani tiga nota kesepahaman ...", "news_feed": {"label": "emitennews"}},
                                   {"stream_id": 8, "title": "Lama", "created_at": "2000-01-01 10:00:00", "content": ""}]}}
        out = server.convert_sb_news(res, "DOOH")
        self.assertEqual([x["id"] for x in out], ["sb-news-9"])
        self.assertEqual(out[0]["source"], "StockbitNews · emitennews")
        self.assertFalse(out[0]["summary"].endswith("..."))

    def test_title_signals(self):
        f = server.kandidat_sigs
        self.assertEqual(f("Keterbukaan Informasi Negosiasi Perubahan Pengendali"), ["akuisisi"])
        self.assertIn("kbli", f("RUPSLB Perubahan Kegiatan Usaha dan Nama Perseroan"))
        self.assertEqual(f("Rencana PMHMETD I"), ["rights"])
        self.assertEqual(f("Perubahan Susunan Anggota Direksi"), ["direksi"])
        self.assertEqual(f("Penghentian Sementara Perdagangan Efek"), ["uma"])
        self.assertEqual(f("Laporan Keuangan Interim"), [])


class HolderNameTest(unittest.TestCase):
    def test_urutan_kata_tertukar_digabung(self):
        rows = [{"ticker": "MEJA", "name": "TRIPLE BERKAH BERSAMA"}, {"ticker": "MEJA", "name": "TRIPLE BERKAH BERSAMA"},
                {"ticker": "MEJA", "name": "TRIPLE BERSAMA BERKAH"}, {"ticker": "MEJA", "name": "PT INTERRA DJAYA KARYA"}]
        server.canon_names(rows)
        self.assertEqual({r["name"] for r in rows}, {"TRIPLE BERKAH BERSAMA", "PT INTERRA DJAYA KARYA"})
        self.assertEqual(server.holder_key("PT Triple Bersama Berkah Tbk"), server.holder_key("TRIPLE BERKAH BERSAMA"))


class HscAnalisaTest(unittest.TestCase):
    def test_kontribusi_dan_kesimpulan(self):
        hs = json.loads((Path(server.__file__).parent / "hsc.json").read_text(encoding="utf-8"))["kode"]
        hg = {t: {"h": 100, "d": -2.0, "w": -4.0, "m": -10.0, "y": -20.0, "tgl": "2026-10-29"} for t in hs}
        hg.update({t: {"h": 5000, "d": 1.0, "w": 2.0, "m": 3.0, "y": 4.0, "tgl": "2026-10-29"} for t in ("BBCA", "BBRI", "BMRI", "BBNI", "ASII", "TLKM")})
        lama = (server.harga_semua, server.broker_data, server.LIVE.get("harga"))
        server.harga_semua, server.broker_data, server.LIVE["harga"] = (lambda: hg), (lambda: {}), {"harga": 5000.0}
        try:
            r = server.hsc_analisa()
        finally:
            server.harga_semua, server.broker_data, server.LIVE["harga"] = lama
        self.assertEqual(r["bank4"]["sens"], 13.7)                       # 27,45% x 5000 / 100
        self.assertEqual(r["bank4"]["ret"]["1W"], 2.0)
        bbca = next(x for x in r["penggerak"] if x["t"] == "BBCA")
        self.assertEqual(bbca["poin"]["w"], 9.0)                        # 9% x 2% x 5000
        self.assertEqual(r["keranjang"]["hsc"]["1M"]["median"], -10.0)
        self.assertTrue(any("sepekan" in k["teks"] for k in r["kesimpulan"]))


class HarianSimpanTest(unittest.TestCase):
    def test_simpan_tiap_hari_dan_hari_gagal_dilewati(self):
        import brokerpola as BP
        def fetch(p, f=False):
            if "from=2026-10-29" in p:
                raise RuntimeError("HTTP Error 401")
            return {"data": {"broker_activity_transaction": {"brokers_buy": [{"stock_code": "BBCA", "value": "1000", "lot": "1", "avg_price": "10"}], "brokers_sell": []}}}
        disimpan = []
        d = BP.build_harian(fetch, {}, {"AA": {}, "BB": {}}, ["2026-10-30", "2026-10-29", "2026-10-28"], set(), pause=0,
                            log=lambda m: None, simpan=lambda x: disimpan.append(sorted(x["hari"])))
        self.assertEqual(disimpan, [["2026-10-30"], ["2026-10-28", "2026-10-30"]])
        self.assertNotIn("2026-10-29", d["hari"])


class LiveTertahanTest(unittest.TestCase):
    def test_peringatan_token_ditolak(self):
        lama = (dict(server.SB_LIVE), server.token_exp)
        try:
            server.token_exp = lambda: time.time() + 3600
            server.SB_LIVE.update(ok=time.time() - 400, gagal=time.time() - 10, pesan="HTTP Error 401: Unauthorized")
            self.assertEqual(server.live_tertahan(True)["alasan"], "token Stockbit ditolak")
            self.assertIsNone(server.live_tertahan(False))
            server.SB_LIVE.update(ok=time.time(), gagal=0)
            self.assertIsNone(server.live_tertahan(True))
            server.token_exp = lambda: time.time() - 10
            self.assertEqual(server.live_tertahan(False)["alasan"], "token Stockbit kedaluwarsa")
        finally:
            server.SB_LIVE.clear(); server.SB_LIVE.update(lama[0]); server.token_exp = lama[1]


class HargaRadarTest(unittest.TestCase):
    def wib(self, *a):
        return datetime(*a, tzinfo=server.WIB)

    def test_jadwal(self):
        kamis_siang = self.wib(2026, 11, 5, 10, 0)
        self.assertTrue(server.harga_perlu(kamis_siang, None))
        self.assertFalse(server.harga_perlu(kamis_siang, kamis_siang.timestamp() - 600))
        self.assertTrue(server.harga_perlu(kamis_siang, kamis_siang.timestamp() - server.HARGA_GAP))
        # Sesudah tutup: sekali lagi bila terakhir diambil sebelum penutupan, lalu berhenti.
        kamis_malam = self.wib(2026, 11, 5, 19, 0)
        self.assertTrue(server.harga_perlu(kamis_malam, self.wib(2026, 11, 5, 16, 20).timestamp()))
        self.assertFalse(server.harga_perlu(kamis_malam, self.wib(2026, 11, 5, 16, 40).timestamp()))
        # Pagi sebelum buka dan akhir pekan: patokannya penutupan hari bursa terakhir.
        jumat_pagi = self.wib(2026, 11, 6, 7, 0)
        self.assertFalse(server.harga_perlu(jumat_pagi, self.wib(2026, 11, 5, 16, 40).timestamp()))
        self.assertTrue(server.harga_perlu(jumat_pagi, self.wib(2026, 11, 5, 15, 0).timestamp()))
        minggu = self.wib(2026, 11, 8, 12, 0)
        self.assertFalse(server.harga_perlu(minggu, self.wib(2026, 11, 6, 16, 45).timestamp()))
        self.assertTrue(server.harga_perlu(minggu, self.wib(2026, 11, 6, 14, 0).timestamp()))

    def test_gabung(self):
        it = {"ticker": "ULTJ", "name": "Ultra Jaya", "price": 2020, "mcap": 20000, "float": 30,
              "ctrlName": "PT X", "flags": {"akuisisi": True, "volume": True}, "notes": "catatan tim"}
        q = {"price": 2100.0, "pctChange": 1.45, "volume": 100.0, "avgVolume": 200.0, "uma": True, "name": "lain"}
        new = server.harga_gabung(it, q)
        self.assertEqual((new["price"], new["chgPct"], new["volRatio"]), (2100.0, 1.45, 0.5))
        self.assertEqual(new["flags"], {"akuisisi": True, "volume": True, "uma": True})  # volume tidak dimatikan
        self.assertEqual((new["name"], new["ctrlName"], new["notes"], new["mcap"]), ("Ultra Jaya", "PT X", "catatan tim", 20000))
        self.assertEqual(it["price"], 2020)  # input tidak dimutasi
        o = {"marketCap": 20.79e12, "freeFloat": 31.5, "controllerName": "PT Y"}
        new = server.harga_gabung(it, {"price": None}, o)
        self.assertEqual((new["price"], new["mcap"], new["float"], new["ctrlName"]), (2020, 20790.0, 31.5, "PT X"))

    def test_segarkan_baca_ulang(self):
        disimpan = []
        baris = [{"ticker": "ULTJ", "price": 2020, "notes": "lama"}]
        terbaru = {"ticker": "ULTJ", "price": 2020, "notes": "diubah tim"}
        with unittest.mock.patch.object(server, "items_all", return_value=baris), \
                unittest.mock.patch.object(server, "get_token", return_value=None), \
                unittest.mock.patch.object(server, "page_quote", return_value={"price": 2100.0}), \
                unittest.mock.patch.object(server, "data_rows", return_value=[(json.dumps(terbaru),)]), \
                unittest.mock.patch.object(server, "item_put", side_effect=disimpan.append):
            self.assertEqual(server.segarkan_harga(delay=0), 1)
        self.assertEqual((disimpan[0]["price"], disimpan[0]["notes"]), (2100.0, "diubah tim"))
        self.assertIn("updatedAt", disimpan[0])


class HarmonikTest(unittest.TestCase):
    """Screening Harmonic Pattern: Gartley bullish sintetis X 100, A 200, B 138,2 (0,618), C 175,3, D 121,4 (0,786)."""

    @staticmethod
    def bars(titik, ekor=(), vol=1e5, n=10):
        cl = [a + (b - a) * k / n for a, b in zip(titik, titik[1:]) for k in range(n)] + [titik[-1], *ekor]
        return [{"d": f"2026-{1 + i // 28:02d}-{1 + i % 28:02d}", "o": c, "h": c * 1.004, "l": c * 0.996, "c": c, "v": vol}
                for i, c in enumerate(cl)]

    def test_gartley_di_prz(self):
        import harmonik
        r = harmonik.cari(self.bars([150, 100, 200, 138.2, 175.3, 121.4]))
        g = next(x for x in r if x["pola"] == "gartley")
        self.assertEqual((g["arah"], g["status"]), ("bullish", "prz"))
        self.assertTrue(g["prz"][0] <= 121.4 <= g["prz"][1])
        self.assertEqual([x["n"] for x in g["titik"]], list("XABCD"))
        self.assertEqual(g["stop"], 100)                                      # sedikit di balik X
        self.assertTrue(121.4 < g["target"][0] < g["target"][1] < 200)        # 0,382 lalu 0,618 kaki AD
        self.assertEqual(g["targetCA"], [176, 201])                          # titik C lalu A

    def test_menuju_dan_tidak_likuid(self):
        import harmonik
        r = harmonik.cari(self.bars([150, 100, 200, 138.2, 175.3, 135]))
        g = next(x for x in r if x["pola"] == "gartley")
        self.assertEqual(g["status"], "menuju")
        self.assertGreater(g["jarak"], 0)
        # Nilai transaksi rata-rata < Rp1 miliar: tidak disaring.
        self.assertEqual(harmonik.cari(self.bars([150, 100, 200, 138.2, 175.3, 121.4], vol=10)), [])
        # D menembus X: bukan Gartley lagi.
        self.assertFalse([x for x in harmonik.cari(self.bars([150, 100, 200, 138.2, 175.3, 95])) if x["pola"] == "gartley"])

    def test_candle_balik(self):
        import harmonik
        pin = [{"o": 10, "h": 10.2, "l": 9.8, "c": 9.9}, {"o": 10, "h": 10.1, "l": 9.0, "c": 10.05}]
        self.assertEqual(harmonik.candle_balik(pin, 1, True), "pin bar")
        eng = [{"o": 10, "h": 10.1, "l": 9.4, "c": 9.5}, {"o": 9.45, "h": 10.3, "l": 9.4, "c": 10.2}]
        self.assertEqual(harmonik.candle_balik(eng, 1, True), "bullish engulfing")
        self.assertEqual(harmonik.candle_balik(eng, 1, False), "")

    def test_api_urut_dan_nama(self):
        tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        f = Path(tmp.name) / ".harmonik.json"
        f.write_text(json.dumps({"updated": "2026-11-05 00:40", "dinilai": 2, "rows": [
            {"t": "BBBB", "status": "menuju", "jarak": 4.0}, {"t": "AAAA", "status": "prz", "jarak": 0}]}))
        with unittest.mock.patch.object(server, "HARMONIK_PATH", f), \
                unittest.mock.patch.object(server, "nama_semua", return_value={"AAAA": "Aaaa Tbk"}), \
                unittest.mock.patch.object(server, "radar_tickers", return_value={"BBBB"}):
            r = server.harmonik_api()
        tmp.cleanup()
        self.assertEqual([(x["t"], x["nama"], x["radar"]) for x in r["rows"]], [("AAAA", "Aaaa Tbk", False), ("BBBB", "", True)])
        self.assertEqual({p["k"] for p in r["pola"]}, {"gartley", "bat", "butterfly", "crab", "cypher"})

    def test_saham_live_dan_cadangan(self):
        bars = self.bars([150, 100, 200, 138.2, 175.3, 121.4])
        tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        f = Path(tmp.name) / ".harmonik.json"
        f.write_text(json.dumps({"rows": [], "bars": {"AAAA": bars}}))
        with unittest.mock.patch.object(server, "HARMONIK_PATH", f), \
                unittest.mock.patch.object(server, "nama_semua", return_value={"AAAA": "Aaaa Tbk"}):
            with unittest.mock.patch.object(server, "get_ohlc", return_value=bars):
                r = server.harmonik_saham("AAAA")
            self.assertEqual((r["sumber"], r["nama"], r["likuid"]), ("harga harian Stockbit", "Aaaa Tbk", True))
            self.assertIn("gartley", [x["pola"] for x in r["rows"]])
            self.assertTrue(r["pivot"] and r["pivot"][-1]["tentatif"])
            # Cache kosong (mis. pengunjung publik): pakai salinan dari screening malam.
            with unittest.mock.patch.object(server, "get_ohlc", side_effect=server.PublicNoCache("kosong")):
                self.assertEqual(server.harmonik_saham("AAAA")["sumber"], "salinan screening malam")
                with self.assertRaises(server.PublicNoCache):
                    server.harmonik_saham("BBBB")
        tmp.cleanup()


class AutoMonitorTest(unittest.TestCase):
    """Kandidat otomatis masuk Monitor: pergantian pengendali terkonfirmasi, atau rencana pengambilalihan (DGIK)."""

    def kd(self, t, teks, d="2026-11-04", nc=None):
        return {"ticker": t, "name": t + " Tbk", "flags": {"akuisisi": True}, **({"pengendaliBaru": nc} if nc else {}),
                "signals": {"akuisisi": {"st": "on", "d": d, "ev": [{"d": d, "text": teks, "src": "https://stockbit.com/post/1"}]}}}

    def jalan(self, items, ada=(), sembunyi=()):
        simpan = []
        with unittest.mock.patch.object(server, "items_all", return_value=[{"ticker": t} for t in ada]), \
                unittest.mock.patch.object(server, "data_rows", return_value=[(t,) for t in sembunyi]), \
                unittest.mock.patch.object(server, "item_put", side_effect=simpan.append):
            hasil = server.auto_monitor({"items": items}, now=datetime(2026, 11, 6))
        return hasil, simpan

    def test_rencana_pengambilalihan(self):
        hasil, simpan = self.jalan([
            self.kd("DGIK", "Tokyu Construction Siap Caplok 25 Persen Saham Nusa Konstruksi (DGIK)"),
            self.kd("BUMI", "BUMI Akuisisi Tambang Emas di Australia"),                        # BUMI pembeli, bukan target
            self.kd("LAMA", "Penawaran Tender Wajib atas Saham PT Lama Tbk", d="2026-10-01"),  # lebih dari 14 hari
            self.kd("TRSY", "Keterbukaan Informasi Pengalihan Saham Hasil Pembelian Kembali Saham"),
        ])
        self.assertEqual(hasil, ["DGIK"])
        self.assertEqual((simpan[0]["stage"], simpan[0]["auto"], simpan[0]["autoJenis"]), ("radar", True, "rencana"))
        self.assertIn("belum terkonfirmasi di KSEI", simpan[0]["notes"])

    def test_terkonfirmasi_dan_lewati(self):
        nc = {"date": "2026-11-03", "name": "Pt Baru", "pct": 30, "text": "Pt Baru masuk: 0% → 30% (KSEI)"}
        hasil, simpan = self.jalan([self.kd("AAAA", "Perubahan Pengendali", nc=nc),
                                    self.kd("BBBB", "Tokyu Akan Akuisisi 25% Saham BBBB"),     # sudah di Monitor
                                    self.kd("CCCC", "X Siap Caplok 30 Persen Saham CCCC")],    # disembunyikan tim
                                   ada=["BBBB"], sembunyi=["CCCC"])
        self.assertEqual(hasil, ["AAAA"])
        self.assertNotIn("autoJenis", simpan[0])
        self.assertIn("terkonfirmasi", simpan[0]["notes"])

    def test_batas_per_putaran(self):
        items = [self.kd(f"A{c}AA", f"Investor Siap Caplok 20 Persen Saham A{c}AA") for c in "BCDEFGH"]
        hasil, _ = self.jalan(items)
        self.assertEqual(len(hasil), server.RENCANA_MAKS)


class PovDalamLatarTest(unittest.TestCase):
    """Analisa mendalam tersimpan per saham, ditarik ulang hanya bila ada data baru atau umurnya lewat batas."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        d = Path(self.tmp.name)
        self.patches = [unittest.mock.patch.object(server, k, v) for k, v in (
            ("PD_DIR", d / ".pov-dalam"), ("PD_LAMA", d / ".pov-dalam.json"), ("PD_PEMICU_PATH", d / ".pov-dalam-pemicu.json"),
            ("_pd_indeks", None), ("_pd_jobs", {}), ("_pd_gagal_latar", {}), ("_pd_mulai", []))]
        for p in self.patches:
            p.start()
        self.v = server.PD.VERSI

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def test_pecah_format_lama(self):
        server.PD_LAMA.write_text(json.dumps({"AAAA": {"at": 100.0, "hasil": {"versi": self.v}}, "bad": {}}), encoding="utf-8")
        self.assertEqual(server.pd_indeks(), {"AAAA": {"at": 100.0, "versi": self.v}})
        self.assertFalse(server.PD_LAMA.exists())
        self.assertEqual(server.pd_baca("AAAA")["hasil"]["versi"], self.v)

    def test_pemicu_dan_basi(self):
        kemarin = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        hari = datetime.now().strftime("%Y-%m-%d")
        # Pencatatan pertama memakai awal tanggal baris: analisa yang dibuat sesudahnya tetap berlaku.
        server.pd_pemicu_catat([("AAAA", "u1", kemarin, "Hasil RUPS")])
        server.pd_simpan("AAAA", {"versi": self.v})
        simpan = server.pd_baca("AAAA")
        self.assertEqual(server.pd_basi("AAAA", simpan), "")
        # Baris yang sama tidak dicatat dua kali; baris baru sesudah analisa membuatnya basi.
        self.assertEqual(server.pd_pemicu_catat([("AAAA", "u1", kemarin, "Hasil RUPS")]), 0)
        self.assertEqual(server.pd_pemicu_catat([("AAAA", "u2", hari, "Pengambilalihan")], now=simpan["at"] + 60), 1)
        self.assertIn("Pengambilalihan", server.pd_basi("AAAA", simpan))
        # Tanpa data baru, analisa berumur > PD_MAKS_UMUR tetap ditarik ulang.
        self.assertIn("hari", server.pd_basi("BBBB", {"at": 1.0}, {}, now=server.PD_MAKS_UMUR + 10))

    def test_urutan_latar(self):
        now = time.time()
        for t in ("AAAA", "BBBB", "DDDD", "EEEE"):
            server.pd_simpan(t, {"versi": self.v})
        server._pd_indeks["DDDD"]["at"] = now - server.PD_MAKS_UMUR - 10
        server._pd_indeks["EEEE"]["versi"] = "lama"
        server.PD_PEMICU_PATH.write_text(json.dumps({"BBBB": [{"k": "x", "waktu": now + 5, "tgl": "2026-11-05", "teks": "RUPS"}]}))
        server._pd_gagal_latar["FFFF"] = now
        with unittest.mock.patch.object(server, "items_all", return_value=[{"ticker": "ZZZZ"}]), \
                unittest.mock.patch.object(server, "radar_tickers", return_value={"ZZZZ"}), \
                unittest.mock.patch.object(server, "bei_kode_load",
                                           return_value={t: "" for t in ("AAAA", "BBBB", "CCCC", "DDDD", "EEEE", "FFFF")}):
            # data baru > belum ada/versi lama (radar dulu) > terlalu lama; AAAA masih berlaku, FFFF baru gagal.
            self.assertEqual(server.pd_urutan(now + 10), ["BBBB", "ZZZZ", "CCCC", "EEEE", "DDDD"])

    def test_api_tampil_lama_sambil_tarik_ulang(self):
        server.pd_simpan("AAAA", {"versi": self.v, "t": "AAAA"})
        at = server.pd_baca("AAAA")["at"]
        server.PD_PEMICU_PATH.write_text(json.dumps({"AAAA": [{"k": "x", "waktu": at + 5, "tgl": "2026-11-05", "teks": "PPJB"}]}))
        with unittest.mock.patch.object(server, "bei_kode_load", return_value={"AAAA": ""}):
            r = server.pov_dalam_api("AAAA", False)
            self.assertEqual((r["status"], r["hasil"]["t"], r["cakupan"]["tersimpan"]), ("selesai", "AAAA", 1))
            self.assertIn("PPJB", r["basi"])
            self.assertNotIn("segarkan", r)
            with unittest.mock.patch.object(server, "get_token", return_value="x"), \
                    unittest.mock.patch.object(server, "token_expired", return_value=False), \
                    unittest.mock.patch.object(server.threading, "Thread") as th:
                r = server.pov_dalam_api("AAAA", True)
            th.return_value.start.assert_called_once()
            self.assertEqual((r["status"], r["segarkan"]["langkah"]), ("selesai", 0))
            # Pekerjaan latar tidak menghabiskan jatah pengunjung.
            server._pd_jobs["AAAA"]["latar"] = True
            self.assertIn("segarkan", server.pov_dalam_api("AAAA", False))
            self.assertEqual(server.pov_dalam_api("BBBB", False)["status"], "kosong")

    def test_folder_titik_tidak_disajikan(self):
        root = Path(self.tmp.name)
        (root / ".pov-dalam").mkdir(exist_ok=True)
        (root / ".pov-dalam" / "AAAA.json").write_text("{}")
        (root / "data.json").write_text("{}")
        srv = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{srv.server_address[1]}"
        kode = {}
        try:
            with unittest.mock.patch.object(server, "ROOT", root), unittest.mock.patch.object(server, "DIST", root / "dist"):
                for p in ("/.pov-dalam/AAAA.json", "/data.json"):
                    try:
                        with urllib.request.urlopen(base + p) as r:
                            kode[p] = r.status
                    except urllib.error.HTTPError as e:
                        kode[p] = e.code
        finally:
            srv.shutdown()
            srv.server_close()
        self.assertEqual(kode, {"/.pov-dalam/AAAA.json": 404, "/data.json": 200})


class LkTest(unittest.TestCase):
    """Laporan keuangan seluruh BEI dari akun StockbitReports: urai ringkasan AI menjadi angka dan kategori."""

    def post(self, title, judul, summary, points, sid=1, topic="AKPI"):
        return {"stream_id": sid, "title": f"{title} [{topic}]", "topics": [topic], "created_at": "2026-11-02 11:56:00",
                "summary": {"title": judul, "summary": summary, "key_points": points, "key_takeaway": "Laba naik karena margin melebar"}}

    def test_laba_naik(self):
        r = server.lk_parse(self.post("Penyampaian Laporan Keuangan Interim Yang Tidak Diaudit", "Laba Bersih Naik 3.408,3% 9M26",
            "AKPI (Argha Karya Prima Industry) membukukan laba bersih bertambah 3.408,3% menjadi Rp 110,75 miliar, dengan pendapatan meningkat 24,25% menjadi Rp 2,77 triliun.",
            ["Laba bersih meningkat 3.408,3% YoY dari Rp 3,16 miliar menjadi Rp 110,75 miliar", "Margin kotor naik dari 10,44% menjadi 13,39%"]))
        self.assertEqual((r["t"], r["periode"], r["kategori"], r["nama"]), ("AKPI", "9M26", "bagus", "Argha Karya Prima Industry"))
        self.assertAlmostEqual(r["laba"]["pct"], 3408.3)
        self.assertAlmostEqual(r["laba"]["dari"]["v"], 3.16e9)
        self.assertAlmostEqual(r["laba"]["ke"]["v"], 110.75e9)
        self.assertAlmostEqual(r["pendapatan"]["pct"], 24.25)
        self.assertEqual(r["marginKotor"], {"dari": 10.44, "ke": 13.39})
        self.assertTrue(any("Basis tahun lalu kecil" in c for c in r["catatan"]))

    def test_kategori_lain(self):
        base = ("Penyampaian Laporan Keuangan Interim", "", "XXXX (Contoh) membukukan.", [])
        cek = lambda judul: server.lk_parse(self.post(base[0], judul, base[2], base[3], topic="XXXX"))["kategori"]
        self.assertEqual(cek("Rugi Bersih Berbalik Laba 9M26"), "berbalik")
        self.assertEqual(cek("Laba Bersih Berbalik Rugi 9M26"), "rugi")
        self.assertEqual(cek("Laba Bersih Turun 22,15% 9M26"), "turun")
        self.assertEqual(cek("Laba Bersih Bertambah 5% 9M26"), "naik")
        self.assertIsNone(server.lk_parse(self.post("Bukti Iklan Laporan Keuangan", "Penyampaian Bukti Iklan Laporan Keuangan", "x", [])))
        self.assertIsNone(server.lk_parse(self.post("Laporan Bulanan Registrasi", "Laba Bersih Naik 5%", "x", [])))

    def test_periode_dan_format_nilai(self):
        self.assertEqual([server.lk_periode(j) for j in ("Laba Bersih Naik 20% 9M26", "Rugi Bersih Turun 48,59% Q1 26",
                                                          "Laba Bersih Naik 5% H1 2026", "Laba Bersih Naik 5% FY25")], ["9M26", "3M26", "1H26", "FY25"])
        d, k = server.lk_nilai_laba(["Laba bersih naik 16,8% YoY menjadi Rp 84,53 miliar dari Rp 72,39 miliar"])
        self.assertEqual((d["v"], k["v"]), (72.39e9, 84.53e9))
        # Tanpa pembanding: angka sesudah "mencapai", bukan angka pendapatan; periode lalu diturunkan dari % YoY.
        r = server.lk_parse(self.post("Laporan Keuangan", "Laba Neto Naik 25% 1H26",
            "BSSR (Baramulti) membukukan laba bersih naik 25% mencapai US$ 62,5 juta, dengan pendapatan menjadi US$ 361 juta.", []))
        self.assertEqual(r["periode"], "1H26")
        self.assertAlmostEqual(r["laba"]["ke"]["v"], 62.5e6)
        self.assertAlmostEqual(r["laba"]["dari"]["v"], 50e6)

    def test_q3_murni_melemah(self):
        # 9M naik 20% (100 -> 120) tetapi 1H naik lebih besar (60 -> 90): Q3 tahun lalu 40, Q3 kini 30 (turun 25%).
        r9 = server.lk_parse(self.post("Laporan Keuangan", "Laba Bersih Naik 20% 9M26", "AKPI (A) x.",
                                       ["Laba bersih naik 20% YoY dari Rp 100 miliar menjadi Rp 120 miliar"], sid=9))
        r6 = server.lk_parse(self.post("Laporan Keuangan", "Laba Bersih Naik 50% 1H26", "AKPI (A) x.",
                                       ["Laba bersih naik 50% YoY dari Rp 60 miliar menjadi Rp 90 miliar"], sid=6))
        r3 = server.lk_parse(self.post("Laporan Keuangan", "Laba Bersih Naik 10% 3M26", "AKPI (A) x.",
                                       ["Laba bersih naik 10% YoY dari Rp 40 miliar menjadi Rp 44 miliar"], sid=3))
        k = server.lk_kuartal(r9, r6, r3)
        self.assertAlmostEqual(k["laba"], 30e9)
        self.assertAlmostEqual(k["labaLalu"], 40e9)
        self.assertEqual((k["yoy"], k["status"], k["melemah"]), (-25.0, "turun", True))
        self.assertAlmostEqual(k["labaSebelum"], 46e9)
        r6["tgl"], r3["tgl"] = "2026-07-30", "2026-04-30"
        with unittest.mock.patch.object(server, "items_all", return_value=[]):
            row = server.lk_api({x["id"]: x for x in (r9, r6, r3)}, kuartalan={}, keystats={})["rows"][0]
        self.assertEqual(row["periode"], "9M26")
        self.assertTrue(row["kuartal"]["melemah"])

    def test_q3_berbalik_rugi(self):
        r9 = server.lk_parse(self.post("Laporan Keuangan", "Rugi Bersih Berbalik Laba 9M26", "AKPI (A) x.",
                                       ["Laba bersih berbalik dari rugi Rp 10 miliar menjadi laba Rp 5 miliar"], sid=19))
        r9["laba"]["dari"], r9["laba"]["ke"] = {"v": 10e9, "mata": "Rp"}, {"v": 5e9, "mata": "Rp"}
        r6 = server.lk_parse(self.post("Laporan Keuangan", "Rugi Bersih Turun 50% 1H26", "AKPI (A) x.",
                                       ["Rugi bersih turun 50% YoY dari Rp 8 miliar menjadi Rp 4 miliar"], sid=16))
        k = server.lk_kuartal(r9, r6, None)
        self.assertAlmostEqual(k["laba"], 9e9)          # 5 - (-4)
        self.assertAlmostEqual(k["labaLalu"], -2e9)     # -10 - (-8)
        self.assertEqual(k["status"], "berbalik")

    def test_berbalik_dan_basis_kecil(self):
        # AMMN: "berbalik menjadi laba US$871,47 juta dari rugi US$178,54 juta".
        d, k = server.lk_nilai_laba(["Rugi bersih berbalik menjadi laba US$ 871,47 juta dari rugi US$ 178,54 juta"])
        self.assertEqual((d["v"], k["v"]), (178.54e6, 871.47e6))
        # ARII: basis tahun lalu sangat kecil (0,29 jt) vs tabel (0,66 jt) tetap dianggap cocok terhadap laba 9M (16,24 jt).
        r = server.lk_parse(self.post("Laporan Keuangan", "Laba Bersih Bertambah 5.537,85% 9M26", "ARII (A) x.",
                                      ["Laba bersih naik 5.537,85% YoY dari US$ 288.000 menjadi US$ 16,24 juta"], topic="ARII"))
        fd = {"mata": "Rp", "pend": {}, "laba": {"Laba Bersih": {"Q125": 11.35e6, "Q225": -7.92e6, "Q325": -2.77e6, "Q425": 1.71e6,
                                                                   "Q126": 9.7e6, "Q226": 2.17e6}}}
        q = server.lk_kuartal_fd(r, fd)
        self.assertEqual(q["status"], "berbalik")
        self.assertAlmostEqual(q["laba"], 4.37e6)

    def test_api_satu_per_emiten(self):
        a = server.lk_parse(self.post("Laporan Keuangan", "Laba Bersih Naik 30% 6M26", "AKPI (A) x.", [], sid=1))
        b = server.lk_parse(self.post("Laporan Keuangan", "Laba Bersih Naik 40% 9M26", "AKPI (A) x.", [], sid=2))
        a["tgl"] = "2026-08-01"
        with unittest.mock.patch.object(server, "items_all", return_value=[]):
            r = server.lk_api({a["id"]: a, b["id"]: b}, kuartalan={}, keystats={})
        self.assertEqual(r["n"], 1)
        self.assertEqual(r["rows"][0]["periode"], "9M26")
        self.assertEqual(r["hitung"], {"bagus": 1})


class UpdatesUnikTest(unittest.TestCase):
    def test_ganda_disaring_resmi_didahulukan(self):
        ups = [{"id": "sb-news-1", "ticker": "VISI", "date": "2026-11-02", "title": "Raffi Ahmad Borong Saham VISI"},
               {"id": "sb-report-2", "ticker": "VISI", "date": "2026-11-02", "title": "Raffi  Ahmad borong saham VISI"},
               {"id": "sb-news-3", "ticker": "VISI", "date": "2026-11-01", "title": "Raffi Ahmad Borong Saham VISI"},
               {"id": "sb-news-4", "ticker": "MKNT", "date": "2026-11-02", "title": "Raffi Ahmad Borong Saham VISI"}]
        self.assertEqual([u["id"] for u in server.updates_unik(ups)], ["sb-report-2", "sb-news-3", "sb-news-4"])


class CekPascaDeployTest(unittest.TestCase):
    """deploy/cek_pasca.py: halaman utama/JS = kritis, data kosong = peringatan."""

    def setUp(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location("cek_pasca", Path(__file__).resolve().parent.parent / "deploy" / "cek_pasca.py")
        self.cek = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.cek)

    def jawab(self, ubah=None):
        isi = {"": (200, b'<div id="app"></div><script type="module" src="./assets/index-A.js"></script>'),
               "assets/index-A.js": (200, b"x"),
               "api/items": (200, b'[{"ticker": "AGAR"}]'), "api/updates": (200, b'[{"id": 1}]'),
               "api/lk": (200, b'{"n": 800}'), "api/saham50": (200, b'{"n": 150}'),
               "api/broker-pola": (200, json.dumps({"brokers": [{}] * 90}).encode()),
               "api/seasonality": (200, b'{"total": 239}'),
               "api/kode-bei": (200, json.dumps({"kode": [{}] * 1000}).encode())}
        isi.update(ubah or {})
        return lambda p: isi.get(p, (404, b""))

    def test_semua_lulus(self):
        self.assertEqual(self.cek.periksa(self.jawab()), {"kritis": [], "peringatan": []})

    def test_js_hilang_kritis(self):
        r = self.cek.periksa(self.jawab({"assets/index-A.js": (404, b"")}))
        self.assertEqual(len(r["kritis"]), 1)

    def test_data_kosong_peringatan(self):
        r = self.cek.periksa(self.jawab({"api/broker-pola": (200, b'{"error": "Data pola broker sedang disiapkan"}'),
                                         "api/lk": (500, b"")}))
        self.assertEqual(r["kritis"], [])
        self.assertEqual(len(r["peringatan"]), 2)
        self.assertIn("Pola Broker", r["peringatan"][1] + r["peringatan"][0])


class LkTumbuhTest(unittest.TestCase):
    def test_definisi(self):
        t = server.lk_tumbuh
        self.assertTrue(t({"status": "naik", "laba": 9, "labaSebelum": 9, "qoq": 1.4})["tumbuh"])      # EPS lebih presisi
        self.assertFalse(t({"status": "naik", "laba": 45, "labaSebelum": 46, "qoq": -3.1})["tumbuh"])  # AKPI: Q3 < Q2
        k = t({"status": "berbalik", "laba": 20, "labaSebelum": -2, "qoq": None})                       # FITT
        self.assertTrue(k["tumbuh"] and k["berbalikQoq"])
        self.assertFalse(t({"status": "turun", "laba": 5, "labaSebelum": 1, "qoq": 400})["tumbuh"])    # turun YoY
        self.assertIsNone(t(None))


class PovDiskTest(unittest.TestCase):
    def test_pulih_dari_disk_setelah_restart(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / ".pov.json"
            res = {"asOf": "2026-11-03T08:00:00", "users": [{"username": "athira"}], "consensus": [], "errors": []}
            with unittest.mock.patch.object(server, "POV_PATH", p), unittest.mock.patch.object(server, "_pov_memo", None):
                server._pov_ke_disk(123.0, res)
                with unittest.mock.patch.object(server, "is_public_request", return_value=True):
                    self.assertEqual(server.get_pov()["users"][0]["username"], "athira")   # tanpa memanggil Stockbit

    def test_publik_tidak_menunggu_kunci(self):
        with tempfile.TemporaryDirectory() as d, \
                unittest.mock.patch.object(server, "POV_PATH", Path(d) / ".pov.json"), \
                unittest.mock.patch.object(server, "_pov_memo", None), \
                unittest.mock.patch.object(server, "is_public_request", return_value=True):
            with server._pov_lock:   # seolah pov_loop sedang menghitung
                r = server.get_pov()
            self.assertEqual(r["users"], [])
            self.assertIn("disiapkan", r["errors"][0]["error"])


class BeritaSahamTest(unittest.TestCase):
    def test_gabung_tanpa_simpan(self):
        lap = [{"id": "sb-report-1", "ticker": "RELF", "date": "2026-10-01", "title": "Laporan Bulanan"}]
        news = [{"id": "sb-news-2", "ticker": "RELF", "date": "2026-11-01", "title": "RELF masuk UMA"},
                {"id": "sb-news-3", "ticker": "RELF", "date": "2026-10-01", "title": "Laporan bulanan"}]
        with unittest.mock.patch.object(server, "load_config", return_value={"reports": {"url": "x"}}),                 unittest.mock.patch.object(server, "get_reports", return_value=lap),                 unittest.mock.patch.object(server, "get_sb_news", return_value=news),                 unittest.mock.patch.object(server, "nama_semua", return_value={"RELF": "Graha Mitra Asia Tbk"}),                 unittest.mock.patch.object(server, "updates_put") as simpan:
            r = server.berita_saham("RELF")
        self.assertEqual([u["id"] for u in r["items"]], ["sb-news-2", "sb-report-1"])
        self.assertEqual(r["nama"], "Graha Mitra Asia Tbk")
        simpan.assert_not_called()   # tidak masuk feed radar

    def test_cache(self):
        server._berita_cache.clear()
        isi = {"ticker": "RELF", "items": [{"id": "a"}]}
        with unittest.mock.patch.object(server, "berita_saham", return_value=isi) as ambil:
            server.berita_saham_cache("RELF")
            server.berita_saham_cache("RELF")
            self.assertEqual(ambil.call_count, 1)          # pencarian kedua dari cache
            server.berita_saham_cache("RELF", fresh=True)
            self.assertEqual(ambil.call_count, 2)
        with unittest.mock.patch.object(server, "berita_saham", return_value={"ticker": "NAYZ", "items": []}) as ambil:
            server.berita_saham_cache("NAYZ")
            server.berita_saham_cache("NAYZ")
            self.assertEqual(ambil.call_count, 2)          # hasil kosong tidak di-cache
        server._berita_cache.clear()


class GalianTest(unittest.TestCase):
    """Galian lanjutan POV (povgali): delapan analisa lintas emiten, harga, tahapan, broker, nominee, ritel, rekam jejak."""

    def test_kalender_backdoor(self):
        import povgali
        from datetime import datetime
        lap = [{"date": "2026-08-01", "title": "Penandatanganan PPJB saham pengendali"},
               {"date": "2026-09-10", "title": "Pengumuman penawaran tender wajib"},
               {"date": "2026-10-01", "title": "Laporan Keuangan Interim"}]
        k = povgali.kalender_backdoor({"kini": datetime(2026, 11, 4), "laporan": lap, "konversi": ["2026-05-01: ENAM BERLIAN 46.72%"]})
        self.assertEqual(k["posisi"], 4)
        self.assertEqual([x["status"] for x in k["tahap"][:4]], ["terjadi", "belum", "terjadi", "terjadi"])
        self.assertIn("RUPSLB", k["berikut"])
        self.assertEqual(povgali.kalender_backdoor({"kini": datetime(2026, 11, 4)})["posisi"], 0)

    def test_harga_pengalihan(self):
        import povgali
        ins = [{"date": "2026-09-02", "name": "PT BARU", "chg": 25.0, "price": 150, "estPrice": False, "value": 5e10},
               {"date": "2026-09-03", "name": "TUAN KECIL", "chg": 0.01, "price": 90, "estPrice": False, "value": 1e6}]
        bars = [{"d": "2026-09-01", "c": 100}, {"d": "2026-09-02", "c": 100}]
        lap = [{"date": "2026-10-01", "title": "Keterbukaan tender", "summary": "Harga penawaran tender Rp 1.250 per saham"}]
        h = povgali.harga_pengalihan(ins, bars, lap, 120)
        self.assertEqual(len(h["rows"]), 1)
        self.assertEqual(h["rows"][0]["selisih"], 50.0)
        self.assertEqual(h["dokumen"][0]["harga"], 1250)
        self.assertEqual(h["acuan"]["harga"], 1250)
        self.assertTrue(any("premi" in x for x in h["catatan"]))

    def test_pengurus_alamat_nominee(self):
        import povgali
        idx = {"AAAA": {"pengurus": ["Ir. Budi Santoso, MBA"], "alamat": "Menara Satu Lt. 12, Jl. Sudirman Kav. 5, Jakarta", "telp": "021-5551234",
                        "pemegang": []},
               "BBBB": {"pengurus": ["BUDI SANTOSO"], "alamat": "Menara Satu Lantai 12 Jl Sudirman Kav 5 Jakarta Selatan", "telp": "(021) 555 1234",
                        "pemegang": [["SITI AMINAH", 7.5, "INDONESIA", "Individual"]]},
               "CCCC": {"pengurus": ["ANDI"], "alamat": "Jl. Lain No. 9 Surabaya", "telp": "031-1112222", "pemegang": []}}
        p = povgali.pengurus_lintas("AAAA", ["BUDI SANTOSO (Direktur Utama)"], ["SITI AMINAH"], idx)
        self.assertEqual({x["nama"] for x in p}, {"BUDI SANTOSO", "SITI AMINAH"})
        self.assertEqual([x["t"] for x in povgali.alamat_sama("AAAA", idx)], ["BBBB"])
        pm = [{"name": "GOLDEN SPV LTD", "pct": 12.0}, {"name": "SITI AMINAH", "pct": 6.0}, {"name": "PT INDUK", "pct": 50.0, "pengendali": True}]
        det = {povgali.kunci_orang("GOLDEN SPV LTD"): {"dom": "BRITISH VIRGIN ISLANDS", "kls": "Corporate"},
               povgali.kunci_orang("SITI AMINAH"): {"dom": "INDONESIA", "kls": "Individual"}}
        nm = {x["nama"]: x for x in povgali.nominee(pm, det, [], [], [], [], [])}
        self.assertIn("GOLDEN SPV LTD", nm)
        self.assertIn("SITI AMINAH", nm)
        self.assertNotIn("PT INDUK", nm)

    def test_broker_ritel_rekam(self):
        import povgali
        bandar = {"fase": [{"hari": 30, "periode": "1 bulan", "bandar": 5e9, "akum": ["DH", "MG"], "dist": ["XL", "YP"]}]}
        b = povgali.broker_grup(bandar, [], ["PT SINAR MAS MULTIARTHA"])
        self.assertTrue(b["rows"][0]["satuGrup"])
        self.assertTrue(any("Sinar Mas" in x for x in b["catatan"]))
        self.assertTrue(any("lokal non-ritel" in x for x in b["catatan"]))
        r = povgali.tren_ritel([("2026-06-30", 1000), ("2026-07-31", 1100), ("2026-08-31", 1300), ("2026-09-30", 1500)],
                               [{"d": "2026-06-30", "c": 200}, {"d": "2026-09-30", "c": 150}])
        self.assertIn("distribusi", r["catatan"][0])
        harga = [{"d": f"2024-{(i % 12) + 1:02d}-01", "v": v} for i, v in enumerate([100] * 10 + [500] * 10 + [40] * 10)]
        nb = povgali.nasib_emiten(harga, "2025-01-01")
        self.assertIn("gocap", nb["pola"])
        rj = povgali.rekam_jejak([{"nama": "PT X", "emiten": [], "keluar": [{"t": "ZZZZ"}]}], {"ZZZZ": nb},
                                 [{"judul": "Bos PT X jadi tersangka korupsi", "url": "u"}, {"judul": "PT X raih penghargaan", "url": "v"}])
        self.assertEqual(len(rj["emiten"]), 1)
        self.assertEqual([x["kategori"] for x in rj["berita"]], [["hukum"]])
        self.assertTrue(rj["catatan"])

    def test_kakdr_riwayat(self):
        with tempfile.TemporaryDirectory() as d, unittest.mock.patch.object(server, "KAKDR_RIWAYAT_PATH", Path(d) / "r.json"):
            (Path(d) / "r.json").write_text(json.dumps({"2000-01-01": ["AAAA", "BBBB"]}))
            baru, keluar = server.kakdr_riwayat(["BBBB", "CCCC"])
        self.assertEqual((baru, keluar), (["CCCC"], ["AAAA"]))

    def test_profil_ringkas(self):
        p = {"key_executive": {"director": [{"value": "ANDI"}], "commissioner": [{"value": "BUDI"}]},
             "address": [{"office": "Jl. A\nNo. 1", "phone": "021-1"}],
             "shareholder_one_percent": {"shareholder": [{"name": "X LTD", "percentage": "12.5%", "domicile": "SEYCHELLES", "classification": "Corporate"}]},
             "shareholder_numbers": [{"shareholder_date": "30 Sep 2026", "total_share": "5,996"}]}
        r = server.profil_ringkas(p)
        self.assertEqual(r["pengurus"], ["ANDI", "BUDI"])
        self.assertEqual(r["alamat"], "Jl. A No. 1")
        self.assertEqual(r["pemegang"][0][:3], ["X LTD", 12.5, "SEYCHELLES"])
        self.assertEqual(r["jumlah"], [["2026-09-30", 5996]])


class KakdrScreenTest(unittest.TestCase):
    def test_screening(self):
        ks = {"AAAA": {"hargaKira": 400, "rasio": {"Current Price to Book Value": 0.6, "Debt to Equity Ratio (Quarter)": 0.4,
                                                   "Return on Equity (TTM)": 12.0, "Dividend Yield": 5.0, "52 Week High": 1000}},
              "BBBB": {"hargaKira": 900, "rasio": {"Current Price to Book Value": 3.0, "Debt to Equity Ratio (Quarter)": 2.5,
                                                   "Return on Equity (TTM)": -4.0, "Dividend Yield": 0, "52 Week High": 1000}}}
        with unittest.mock.patch.object(server, "lks_load", return_value=ks), \
                unittest.mock.patch.object(server, "harga_semua", return_value={}), \
                unittest.mock.patch.object(server, "sektor_load", return_value={}), \
                unittest.mock.patch.object(server, "nama_semua", return_value={}), \
                unittest.mock.patch.object(server, "_kakdr_memo", (0.0, None)):
            r = server.kakdr_screen()
        self.assertEqual([x["t"] for x in r["rows"]], ["AAAA"])
        self.assertEqual(r["rows"][0]["skor"], 10.0)
        self.assertTrue(all(r["rows"][0]["lolos"].values()))


class PovDalamTest(unittest.TestCase):
    """povdalam.analyze: contoh AKPI (pendiri 95,72%, jaringan Risjad/Henry Pribadi, posting komunitas)."""

    def data(self):
        from datetime import datetime
        return {"t": "AKPI", "nama": "Argha Karya Prima Industry", "profil": {
            "sector": "Barang Baku", "industry": "Wadah & Kemasan", "stats": {"freeFloat": 4.28, "marketCap": 1e12},
            "metrics": {"pbv": 0.2}, "beneficiary": [], "directors": ["Dina Risjad (Direktur Utama)"], "commissioners": [],
            "shareholders": [{"name": "PT Tiara Intimahkota", "pct": "36.11", "pengendali": True}],
            "holders1": [{"name": "Prismatama Nugraha PT", "pct": 27.28}, {"name": "Nawa Panduta, PT", "pct": 15.05},
                         {"name": "PT Gitanirwana Mandrasakti", "pct": 4.19}, {"name": "Dina Risjad", "pct": 1.70},
                         {"name": "Masyarakat", "pct": 4.28}], "chart": [{"d": "2026-11-03", "v": 510}]},
            "insider": [{"date": "2026-10-01", "name": "Nawa Panduta, PT", "prev": 10, "cur": 15.05, "chg": 5.05, "role": "", "value": 1e9}],
            "jaringan": {"Nawa Panduta, PT": [{"symbol": "LSIP", "pct": 2.1, "since": "2010-01-01"}, {"symbol": "SCMA", "pct": 1.5}],
                         "PT Tiara Intimahkota": [{"symbol": "LSIP", "pct": 1.2}]},
            "laporan": [{"date": "2026-10-20", "title": "Rencana penambahan modal HMETD", "jenis": ["rights"], "inti": "", "url": "u"}],
            "posts": [{"user": "athira", "d": "2026-10-22", "likes": 40, "url": "p",
                       "txt": "$AKPI Saat ini pak henry pribadi, pak risjad dan pak henry liem ada di akpi lewat napan (nawa panduta). "
                              "Pak henry pribadi bersama pak risjad dulu akuisisi $LSIP. Pendiri dan keluarga 95,72% free float. "
                              "Henry Liem melalui PT Gitanirwana Mandrasakti masih menjual, tersisa 26 juta lembar."}],
            "lk": {"kuartal": {"tumbuh": True, "q": 3}}}, datetime(2026, 11, 3)

    def test_analisa(self):
        import povdalam
        d, kini = self.data()
        r = povdalam.analyze(d, kini)
        self.assertAlmostEqual(r["kepemilikan"]["nonPublik"], 80.14, places=2)   # >=5% + pengurus (Dina Risjad)
        self.assertEqual(r["kepemilikan"]["pemegang"][4]["pengurus"], "Dina Risjad")
        self.assertEqual(r["bersama"][0]["t"], "LSIP")                      # dimiliki dua pemegang AKPI
        judul = " | ".join(g["judul"] for g in r["dugaan"])
        self.assertIn("free float", judul.lower())
        self.assertIn("jaringan", judul.lower())
        self.assertIn("HMETD", " ".join(b for g in r["dugaan"] for b in g["bukti"]))
        nama = {e["nama"]: e["terverifikasi"] for e in r["komunitas"]["nama"]}
        self.assertIn("Henry Pribadi", nama)
        self.assertEqual(r["komunitas"]["terkait"][0]["t"], "LSIP")
        rel = r["komunitas"]["relasi"]
        self.assertTrue(any(x["orang"] == "Henry Liem" and "GITANIRWANA" in x["badan"] and x["terverifikasi"] for x in rel), rel)
        self.assertTrue(any("26 juta lembar" in c["teks"] for c in r["komunitas"]["klaim"]))

    def test_cek_klaim(self):
        import povdalam
        from datetime import datetime
        d = {"t": "PTIS", "nama": "", "profil": {"stats": {"freeFloat": 9.0}, "metrics": {"pbv": 0.4, "bvps": 1500},
             "shareholders": [{"name": "PT Anugerah Salim Investama", "pct": "60"}], "holders1": [], "chart": [{"v": 500}]},
             "posts": [{"user": "PMFernandoR", "d": "2026-10-21", "likes": 9, "url": "u", "txt":
                        "Maybe next $PTIS, 1000% saya yakin ini sahamnya punya konglo itu. Alasan beli: 1. Ada 2 Konglo Tier 1 di sini. "
                        "2. Saham gak liquid/gorengan tapi valuasi murah. 3. Valuasi wajarnya di 3x harga sekarang."}]}
        r = povdalam.analyze(d, datetime(2026, 11, 3))
        st = {c["jenis"]: c["status"] for c in r["klaim"]}
        self.assertEqual(st["konglo"], "didukung data")      # pemegang bernama Salim
        self.assertNotIn("murah", st)                         # valuasi (fundamental) tidak dicek lagi
        self.assertEqual(st["likuid"], "didukung data")      # free float efektif 40% tidak, tetapi ff 9% < 10
        self.assertNotIn("fokusPosts", r["komunitas"])

    def test_arah_pengendali(self):
        import povarah
        bm = povarah.bandarmologi({30: {"bandar": 2e9, "akum": ["YP", "PD"], "dist": ["MG"], "avgAkum": 480, "konsentrasi": 70, "asing": 0},
                                   90: {"bandar": 5e9, "akum": ["YP"], "dist": ["KK"], "avgAkum": 450, "konsentrasi": 55, "asing": 0}},
                                  [{"d": "2026-01-01", "c": 500, "v": 1}] * 100, 500)
        self.assertIn("akumulasi diam-diam", bm["fase"][0]["arti"])
        self.assertTrue(any("YP" in x for x in bm["catatan"]))
        a = povarah.arah({"ff": 4.3, "ffEfektif": 4.3, "afiliasi": 95.7, "insiderJual": [1], "habisBulan": True, "bandar": bm})
        self.assertEqual(a["skenario"][0]["nama"], "Distribusi untuk memenuhi free float / menjual ke publik")
        t = povarah.target_harga({"harga": 500, "bvps": 3160, "high52": 800})
        self.assertEqual([x["harga"] for x in t], [3160])          # tanpa titik teknikal 52 minggu
        self.assertEqual(t[0]["potensi"], 532.0)

    def test_afiliasi_dan_market_maker(self):
        import povarah
        pm = [{"name": "PT RELIFE PROPERTY", "pct": 19.44}, {"name": "PT RELIFE REALTY INDONESIA", "pct": 9.43},
              {"name": "GHOFAR ROZAQ NAZILA", "pct": 10.77, "pengurus": "GHOFAR ROZAQ NAZILA"}]
        ins = [{"date": "2026-03-10", "name": n, "prev": 0, "cur": c, "broker": "IU"} for n, c in
               (("RELIFE PROPERTY", 19.44), ("RELIFE REALTY INDONESIA", 9.43), ("GHOFAR ROZAQ NAZILA", 10.77))]
        a = povarah.afiliasi(pm, ins, [], [])
        jenis = {k["jenis"] for k in a["kelompok"]}
        self.assertTrue({"nama mirip", "bergerak bersamaan", "pemegang = pengurus"} <= jenis, jenis)
        mm = povarah.market_maker(ins, {"fase": [{"periode": "1 bulan", "akum": ["IU"], "dist": []}]})
        self.assertIn("kemungkinan broker", mm[0])
        # Tanda umum saja (pemain baru, kapitalisasi kecil) bernilai kecil; tanda inti menaikkan skor tajam.
        self.assertLess(povarah.potensi_backdoor({"pemainBaru": [1], "mcap": 1.5e11})["skor"], 15)
        bd = povarah.potensi_backdoor({"masukBersama": [1], "jejakCangkang": [1], "batas12": "2026-01-01",
                                       "ambil": [{"date": "2026-10-01"}], "pemainBaru": [1], "mcap": 1.5e11})
        self.assertGreaterEqual(bd["skor"], 70)
        self.assertFalse(povarah.bukan_kustodian("UOB KAY HIAN PRIVATE LIMITED"))

    def test_pemegang_ganda_dan_keluarga(self):
        import povdalam
        from datetime import datetime
        d = {"t": "XXXX", "profil": {"stats": {}, "metrics": {},
             "shareholders": [{"name": "STRAITS CORPORATION PTE. LTD.", "pct": "81.82", "pengendali": True}],
             "holders1": [{"name": "Straits Corporation Pte Ltd", "pct": 81.82}, {"name": "AMIRSYAH RISJAD", "pct": 1.7},
                          {"name": "DINA RISJAD", "pct": 1.7}, {"name": "DEDEY RISJAD", "pct": 1.7}]}}
        r = povdalam.analyze(d, datetime(2026, 11, 4))
        self.assertEqual(len(r["kepemilikan"]["pemegang"]), 4)                    # Straits sekali, 3 Risjad
        self.assertEqual(r["kepemilikan"]["keluarga"][0]["anggota"].__len__(), 3)
        self.assertLessEqual(r["kepemilikan"]["nonPublik"], 100)

    def test_pertanyaan_dan_pemindai(self):
        import povdalam, povpindai
        from datetime import datetime
        d, k = self.data()
        d["insider"].append({"date": "2026-10-01", "name": "PT Tiara Intimahkota", "prev": 30, "cur": 36.11, "chg": 6.11, "broker": "YP", "purpose": "Investasi"})
        d["brokers"] = {5: {"bandar": 1e9, "akum": ["YP"], "dist": ["MG"], "avgAkum": 480}, 30: {"bandar": -2e9, "akum": ["PD"], "dist": ["MG"], "avgAkum": 480}}
        h = povdalam.analyze(d, k)
        q = {x["q"][:20]: x["a"] for x in h["pertanyaan"]}
        self.assertIn("Belum tampak selesai", q["Apakah pembelian sud"])
        self.assertIn("tidak tercatat", q["Apakah masih ada dis"])
        h["radar"] = True
        rows = {"AKPI": povpindai.baris(h, k)}
        self.assertEqual(rows["AKPI"]["t"], "AKPI")
        feed = [{"date": "2026-11-03", "name": "PT NAWA PANDUTA", "ticker": "ZZZZ", "prev": 0, "cur": 9.5}]
        al = povpindai.alarm_penjual({"Nawa Panduta, PT": [{"t": "NAYZ", "tgl": "2026-08-19", "dari": "AKPI"}]}, feed)
        self.assertEqual(al[0]["t"], "ZZZZ")
        self.assertIn("RINGKASAN", povpindai.ringkasan(rows, {"AKPI": 0}, al)["teks"])

    def test_masuk_terverifikasi(self):
        import povdalam
        from datetime import datetime
        ins = [{"date": "2026-09-11", "name": "ENAM BERLIAN SINERGI", "prev": 0, "cur": 46.72, "chg": 46.72, "source": "KSEI"},
               {"date": "2026-09-17", "name": "ENAM BERLIAN SINERGI", "prev": 46.72, "cur": 45.22, "chg": -1.5, "source": "IDX"},
               {"date": "2026-10-23", "name": "CENTRAL ENERGI PRATAMA", "prev": 0, "cur": 49.73, "source": "IDX"}]
        r = povdalam._riwayat(ins, datetime(2026, 11, 4))
        enam = next(x for x in r if x["nama"].startswith("ENAM"))
        self.assertTrue(enam.get("pertama"))
        self.assertIsNone(enam["lewat"])                                          # bukan pengendali baru
        cep = next(x for x in r if x["nama"].startswith("CENTRAL"))
        self.assertEqual(cep["lewat"], 20)                                        # masuk baru terverifikasi IDX
        ins180 = {x["nama"]: x for x in povdalam._insider180(ins, datetime(2026, 11, 4))}
        self.assertLess(ins180["ENAM BERLIAN SINERGI"]["chg"], 0)               # penjualan, bukan pembelian +46%
        self.assertIn("scripless", enam["teks"])
        import povarah
        bd = povarah.potensi_backdoor({"konversi": ["2026-09-11: ENAM BERLIAN SINERGI 46.72%"]})
        self.assertTrue(any("scripless" in b for b in bd["bukti"]))

    def test_keluarga(self):
        import povdalam
        pm = [{"name": n, "pct": 1.7} for n in ("AMIRSYAH RISJAD", "DINA RISJAD", "DEDEY RISJAD", "SELVIYA RISJAD DANANTO")]
        pm.append({"name": "PT NAWA PANDUTA", "pct": 15.05})
        k = povdalam.keluarga(pm)
        self.assertEqual((k[0]["nama"], len(k[0]["anggota"]), k[0]["pct"]), ("Risjad", 4, 6.8))
        self.assertEqual(povdalam.nama_disebut("pak komisaris aris bilang"), [])

    def test_nama_disebut(self):
        import povdalam
        self.assertEqual(povdalam.nama_disebut("pak djuhar sutanto dan pak ibrahim risjad yg tergabung"),
                         ["Djuhar Sutanto", "Ibrahim Risjad"])


class JadwalTerlewatTest(unittest.TestCase):
    def test_terlewat(self):
        import os
        from datetime import datetime, timezone
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "x.json"
            p.write_text("{}")
            t = datetime(2026, 11, 1, 17, 21, tzinfo=timezone.utc).timestamp()   # Senin 2 Nov 00.21 WIB
            os.utime(p, (t, t))
            self.assertTrue(server.jadwal_terlewat(p, datetime(2026, 11, 3, 9, 0, tzinfo=timezone.utc)))    # 3 Nov 16.00 WIB
            self.assertFalse(server.jadwal_terlewat(p, datetime(2026, 11, 2, 9, 0, tzinfo=timezone.utc)))   # 2 Nov 16.00 WIB


class Saham50TambahTest(unittest.TestCase):
    def test_riwayat_skor(self):
        from datetime import date
        with tempfile.TemporaryDirectory() as d, unittest.mock.patch.object(server, "S50_RIWAYAT_PATH", Path(d) / "r.json"):
            server.s50_riwayat([{"t": "PURA", "skor": 30}], date(2026, 10, 27))
            rows = [{"t": "PURA", "skor": 43}, {"t": "BARU", "skor": 10}]
            server.s50_riwayat(rows, date(2026, 11, 3))
            self.assertEqual((rows[0]["skorLalu"], rows[0]["skorTgl"]), (30, "2026-10-27"))
            self.assertNotIn("skorLalu", rows[1])

    def test_broker_per_saham(self):
        resp = {"data": {"broker_summary": {
            "brokers_buy": [{"netbs_broker_code": "YP", "bval": "500000000"}, {"netbs_broker_code": "PD", "bval": "100000000"}],
            "brokers_sell": [{"netbs_broker_code": "CC", "sval": "-2e+08"}]}}}
        b = server.s50_broker_parse(resp)
        self.assertEqual((b["bandar"], b["akum"], b["dist"]), (400000000, ["YP", "PD"], ["CC"]))
        self.assertIsNone(server.s50_broker_parse({"data": {}}))

    def test_broker(self):
        data = {"tahun": "2026", "broker": {
            "YP": {"jenis": "Lokal", "bulan": {"10": {"beli": [{"s": "PURA", "val": 5e8, "lot": 100}], "jual": []}}},
            "CC": {"jenis": "Lokal", "bulan": {"10": {"beli": [], "jual": [{"s": "PURA", "val": -1e8, "lot": 20}]}}}}}
        with unittest.mock.patch.object(server, "broker_data", return_value=data):
            b = server.s50_broker({"PURA"})["PURA"]
        self.assertEqual(b[-1]["bulan"], 10)
        self.assertEqual(b[-1]["akum"], ["YP"])
        self.assertGreater(b[-1]["bandar"], 0)


class Saham50Test(unittest.TestCase):
    def test_teknikal(self):
        # 80 hari turun dari 60 ke 41, lalu naik ke 45: di atas EMA20, resistance 60 hari di atas harga.
        px = [{"d": f"2026-{1 + i // 28:02d}-{1 + i % 28:02d}", "v": 60 - i * 0.25} for i in range(77)]
        px += [{"d": "2026-03-25", "v": 43}, {"d": "2026-03-26", "v": 44}, {"d": "2026-03-27", "v": 45}]
        t = server.s50_teknikal(px)
        self.assertEqual(t["harga"], 45)
        self.assertEqual(t["rendah52"], 41.0)
        self.assertGreater(t["resistance"], 45)
        self.assertGreater(t["potensiTeknikal"], 0)
        self.assertFalse(t["datar"])
        self.assertIsNone(server.s50_teknikal(px[:10]))


class RamalanBuktiTest(unittest.TestCase):
    def test_ramalan_jatuh_tempo_dan_arah(self):
        bars = [{"d": f"2026-10-{i:02d}", "c": 5000 + i * 10} for i in range(1, 31)]
        log = {"2026-10-01": {"tanggal": "2026-10-01", "harga": 5010, "ts": {"1": 5030, "5": 4990, "21": 5200}, "astro": {"bias": "naik"}}}
        r = server.ramalan_api(log, bars)
        self.assertEqual(r["ts"]["ringkas"]["1"]["arahTepat"], 100)   # ramalan naik, aktual naik
        self.assertEqual(r["ts"]["ringkas"]["5"]["arahTepat"], 0)     # ramalan turun, aktual naik
        self.assertTrue(r["astro"]["baris"][0]["arahTepat"])

    def test_bukti_tanpa_melihat_tahun_berjalan(self):
        from datetime import date
        naik10 = {str(y): {"10": 1.0} for y in range(2016, 2026)}
        data = {"stock": {"BBBB": {"s": {**naik10, "2026": {"10": -3.0}}}}, "index": {}}
        r = server.season_bukti(None, data, date(2026, 11, 2))
        self.assertEqual((r["bulan"], r["tahun"]), (10, 2026))
        self.assertEqual(r["pilihan"][0]["prob"], 100)                # dihitung dari 2016-2025 saja
        self.assertFalse(r["pilihan"][0]["terbukti"])


class TsaSummaryTest(unittest.TestCase):
    """Data intel pasar tradersaham: helper tsa_summary (tanpa HTTP)."""

    def test_10_helper_known_and_unknown(self):
        s = server.tsa_summary("ASPI")
        self.assertTrue(s["ada"])
        self.assertEqual(s["ticker"], "ASPI")
        self.assertIn("regimeSignal", s["signals"])
        self.assertFalse(server.tsa_summary("ZZZZ")["ada"])


class TsaTokenTest(unittest.TestCase):
    def test_bearer_file_like_stockbit(self):
        import base64, tsa_refresh as tr
        def jwt(exp):
            body = base64.urlsafe_b64encode(json.dumps({"exp": exp}).encode()).decode().rstrip("=")
            return f"h.{body}.s"
        with tempfile.TemporaryDirectory() as d:
            tr.BEARER_FILE, tr.CACHE_FILE, tr.REFRESH_FILE = (Path(d) / n for n in (".t", ".c", ".r"))
            tr.CREDS_FILE = Path(d) / ".creds"
            fresh = jwt(time.time() + 3600)
            tr.BEARER_FILE.write_text("\ufeffBearer " + fresh)       # BOM + prefix "Bearer " tetap terbaca
            self.assertEqual(tr.get_token(), fresh)
            tr.BEARER_FILE.write_text(jwt(time.time() - 10))       # kedaluwarsa, tanpa cadangan = berhenti
            with self.assertRaises(SystemExit):
                tr.get_token()


if __name__ == "__main__":
    unittest.main(verbosity=2)
