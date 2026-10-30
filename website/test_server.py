"""Uji endpoint data radar (items, updates, migrate, layout) dan perbaikan server.

Jalankan: python3 website/test_server.py
"""
import json
import time
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

from datetime import datetime
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
