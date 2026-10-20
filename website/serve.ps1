# Server lokal + proxy Stockbit untuk Radar Cangkang (pemakaian pribadi).
# Jalankan: powershell -ExecutionPolicy Bypass -File serve.ps1   lalu buka http://localhost:8765
#
# Token Stockbit dibaca dari env STOCKBIT_TOKEN atau file .stockbit-token di folder ini.
# Token hanya dipakai server ini untuk memanggil Stockbit; tidak pernah dikirim ke browser.
# -Lan: bisa dibuka dari perangkat lain di jaringan lokal (butuh izin urlacl + firewall, lihat README).
param([int]$Port = 8765, [switch]$Lan)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $root "stockbit.config.json"
$tokenPath = Join-Path $root ".stockbit-token"

function Get-Token {
  $t = $env:STOCKBIT_TOKEN
  if (-not $t -and (Test-Path $tokenPath)) {
    # Abaikan baris komentar (#) dan baris kosong; ambil baris pertama yang berisi token.
    $t = Get-Content $tokenPath | Where-Object { $_.Trim() -and -not $_.Trim().StartsWith('#') } | Select-Object -First 1
  }
  if (-not $t) { return $null }
  return ($t.Trim() -replace '^(?i)bearer\s+', '')
}

# Waktu kedaluwarsa token (detik Unix) dari payload JWT; hanya klaim "exp" yang dibaca, isi token tidak pernah dikirim.
function Get-TokenExp {
  $t = Get-Token
  if (-not $t) { return $null }
  $parts = $t.Split('.')
  if ($parts.Count -lt 2) { return $null }
  try {
    $b = $parts[1].Replace('-', '+').Replace('_', '/')
    switch ($b.Length % 4) { 2 { $b += '==' } 3 { $b += '=' } }
    $payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b)) | ConvertFrom-Json
    if ($payload.exp) { return [int64]$payload.exp }
  } catch {}
  return $null
}

function Get-Config {
  if (-not (Test-Path $configPath)) { return $null }
  try { return (Get-Content $configPath -Raw | ConvertFrom-Json) } catch { return $null }
}

# Ambil nilai dari objek JSON dengan path bertitik, mis. "data.price" atau "data.items.0.value".
function Get-ByPath($obj, [string]$path) {
  if (-not $path) { return $null }
  $cur = $obj
  foreach ($seg in $path.Split('.')) {
    if ($null -eq $cur) { return $null }
    if ($seg -match '^\d+$') { $cur = @($cur)[[int]$seg] }
    else { $cur = $cur.$seg }
  }
  return $cur
}

function Send-Json($ctx, $obj, [int]$status = 200) {
  $json = $obj | ConvertTo-Json -Depth 20 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $ctx.Response.StatusCode = $status
  $ctx.Response.ContentType = "application/json; charset=utf-8"
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

# ---- Cache SQLite ----
# Respons Stockbit dan sumber berita disimpan di website/.cache.sqlite (dotfile: tidak pernah disajikan),
# sehingga semua perangkat memakai salinan yang sama dan Stockbit hanya dipanggil saat salinan kedaluwarsa.
# Butuh CLI sqlite3; tanpa itu server tetap jalan tanpa cache.
$cacheDb = Join-Path $root ".cache.sqlite"
$sqlite = (Get-Command sqlite3 -ErrorAction SilentlyContinue).Source
if ($sqlite) {
  & $sqlite $cacheDb "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS http_cache(url TEXT PRIMARY KEY, body TEXT NOT NULL, fetched_at INTEGER NOT NULL);" | Out-Null
}
$script:Fresh = $false   # true untuk permintaan ?fresh=1 (tombol Perbarui manual): lewati cache

# Jam bursa BEI kira-kira (hari kerja 08.45–16.15 waktu komputer); di luar itu harga tidak bergerak.
function Test-MarketOpen {
  $n = Get-Date
  if ($n.DayOfWeek -in 'Saturday', 'Sunday') { return $false }
  $m = $n.Hour * 60 + $n.Minute
  return ($m -ge 525 -and $m -le 975)
}

# Umur maksimum salinan (detik) menurut jenis data.
function Get-CacheTtl([string]$url) {
  switch -Regex ($url) {
    'corpaction|tenderoffer|majorholder|emitten|profile|keystats|financial|shareholding' { return 6 * 3600 }
    '/stream/' { return 20 * 60 }
    'stockbit\.com/symbol/|chartbit|prices|orderbook|running|marketdetector' { return $(if (Test-MarketOpen) { 10 * 60 } else { 6 * 3600 }) }
    default { return 15 * 60 }
  }
}

function Read-Cache([string]$key, [int64]$minTime) {
  $tmp = [IO.Path]::GetTempFileName()
  try {
    # writefile() menyalin isi apa adanya (tanpa diubah pemisah baris/encoding oleh konsol).
    $n = & $sqlite -batch $cacheDb "SELECT writefile('$($tmp.Replace("'", "''"))', body) FROM http_cache WHERE url='$key' AND fetched_at >= $minTime;"
    if (-not $n) { return $null }
    return [IO.File]::ReadAllText($tmp, [Text.Encoding]::UTF8)
  } finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
}

# Ambil teks dari cache bila masih segar; bila tidak, jalankan $fetch lalu simpan hasilnya.
# Bila $fetch gagal (Stockbit menolak/limit/putus), salinan lama dipakai daripada mengembalikan error.
function Get-CachedText([string]$url, [scriptblock]$fetch) {
  if (-not $sqlite) { return & $fetch }
  $key = $url.Replace("'", "''")
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  if (-not $script:Fresh) {
    $hit = Read-Cache $key ($now - (Get-CacheTtl $url))
    if ($null -ne $hit) { return $hit }
  }
  try { $body = & $fetch }
  catch {
    $old = Read-Cache $key 0
    if ($null -ne $old) { Write-Host "Cache basi dipakai ($($_.Exception.Message)): $url"; return $old }
    throw
  }
  $tmp = [IO.Path]::GetTempFileName()
  try {
    [IO.File]::WriteAllText($tmp, $body, [Text.UTF8Encoding]::new($false))
    & $sqlite -batch $cacheDb "INSERT OR REPLACE INTO http_cache VALUES('$key', CAST(readfile('$($tmp.Replace("'", "''"))') AS TEXT), $now);" | Out-Null
  } finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
  return $body
}

# Panggil endpoint Stockbit dari config untuk satu ticker.
function Invoke-Stockbit($endpoint, [string]$ticker) {
  $url = $endpoint.url.Replace("{ticker}", $ticker)

  # Mode "page": halaman publik stockbit.com/symbol/XXXX, data diambil dari JSON __NEXT_DATA__.
  # Tidak memakai token sama sekali.
  if ($endpoint.source -eq "page") {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $html = Get-CachedText $url { (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20 -Headers @{ "User-Agent" = "Mozilla/5.0 RadarCangkang/1.0" }).Content }
    $m = [regex]::Match($html, '<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', 'Singleline')
    if (-not $m.Success) { throw [Exception]::new("Format halaman Stockbit berubah (__NEXT_DATA__ tidak ditemukan).") }
    return ($m.Groups[1].Value | ConvertFrom-Json)
  }

  # Mode "api": endpoint API Stockbit dengan token Bearer.
  $token = Get-Token
  if (-not $token) { throw [Exception]::new("NO_TOKEN") }
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $headers = @{ Authorization = "Bearer $token"; Accept = "application/json"; Origin = "https://stockbit.com"; Referer = "https://stockbit.com/" }
  # Baca sebagai UTF-8 eksplisit: PowerShell 5 kadang menebak ISO-8859-1 sehingga tanda kutip/aksen rusak.
  $text = Get-CachedText $url {
    $r = Invoke-WebRequest -Uri $url -Headers $headers -Method Get -TimeoutSec 15 -UseBasicParsing
    [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
  }
  return ($text | ConvertFrom-Json)
}

# Klasifikasi jenis berita/laporan dari judulnya.
function Get-NewsType([string]$title) {
  switch -Regex ($title) {
    'tender|\bMTO\b'                                                                  { return "tender" }
    'pengalihan saham|pengambilalihan|pengendali|akuisisi|akusisi|acquisition|caplok|negosiasi|backdoor' { return "pengendali" }
    'HMETD|hak memesan|rights issue|penambahan modal|private placement|inbreng'        { return "rights" }
    'RUPS|rapat umum'                                                                  { return "rupslb" }
    '\bUMA\b|suspensi|penghentian sementara|unusual|volatilitas'                       { return "uma" }
    default                                                                            { return "lainnya" }
  }
}

$ua = @{ "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" }

function Clean-Text([string]$s) {
  $s = $s -replace '<!\[CDATA\[|\]\]>', '' -replace '<[^>]+>', ' ' -replace '\s+', ' '
  return [Net.WebUtility]::HtmlDecode($s).Trim()
}

# Ambil judul artikel dari satu sumber berita (RSS atau halaman daftar artikel).
function Get-SourceArticles($src) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $html = Get-CachedText $src.url { (Invoke-WebRequest -Uri $src.url -UseBasicParsing -TimeoutSec 15 -Headers $ua).Content }
  $list = @()
  if ($src.type -eq "rss") {
    foreach ($m in [regex]::Matches($html, '<item>([\s\S]*?)</item>')) {
      $x = $m.Groups[1].Value
      $title = Clean-Text ([regex]::Match($x, '<title>([\s\S]*?)</title>').Groups[1].Value)
      $link  = Clean-Text ([regex]::Match($x, '<link>([\s\S]*?)</link>').Groups[1].Value)
      $desc  = Clean-Text ([regex]::Match($x, '<description>([\s\S]*?)</description>').Groups[1].Value)
      $pub   = Clean-Text ([regex]::Match($x, '<pubDate>([\s\S]*?)</pubDate>').Groups[1].Value)
      $date = $null; try { if ($pub) { $date = ([DateTimeOffset]::Parse($pub)).ToLocalTime().ToString("yyyy-MM-dd") } } catch {}
      if ($title -and $link) { $list += @{ title = $title; url = $link; desc = $desc; date = $date } }
    }
  } else {
    # Halaman HTML: link yang cocok dengan pola URL artikel situs tersebut.
    $seen = @{}
    foreach ($m in [regex]::Matches($html, '<a\b([^>]*?)href="([^"#]+)"([^>]*)>([\s\S]{0,2500}?)</a>')) {
      $href = $m.Groups[2].Value
      if ($href -notmatch $src.pattern -or $seen.ContainsKey($href)) { continue }
      $inner = $m.Groups[4].Value
      $alt = [regex]::Match($inner, '\balt="([^"]{20,})"').Groups[1].Value
      $title = $(if ($alt) { Clean-Text $alt } else { Clean-Text $inner })
      if ($title.Length -lt 25 -or $title.Length -gt 250) { continue }
      $seen[$href] = $true
      $list += @{ title = $title; url = $href; desc = ""; date = $null }
    }
  }
  return ,$list
}

# Kumpulkan berita yang relevan: cocok kata kunci backdoor, atau menyebut kode saham di radar.
function Get-News($cfgNews, [string[]]$tickers) {
  $kw = "$($cfgNews.keywords)"
  $tickRe = $(if ($tickers.Count) { '\b(' + ($tickers -join '|') + ')\b' } else { $null })
  $today = (Get-Date).ToString("yyyy-MM-dd")
  $items = @(); $errors = @()
  foreach ($src in @($cfgNews.sources)) {
    try {
      foreach ($a in (Get-SourceArticles $src)) {
        $text = "$($a.title) $($a.desc)"
        # Kode saham dianggap cocok hanya dalam konteks saham: "(ASPI)", "saham ASPI", "emiten ASPI", "ASPI Tbk".
        $hitTicker = ""
        if ($tickRe) {
          # "(ASPI)" saja tidak cukup (bisa "Asosiasi ... (ASPI)"); harus "Tbk (ASPI)", "saham ASPI", "ASPI Tbk".
          $tm = [regex]::Match($text, 'Tbk\.?\s*\((' + ($tickers -join '|') + ')\)|\b(?:saham|emiten|kode|perseroan)\s+(' + ($tickers -join '|') + ')\b|\b(' + ($tickers -join '|') + ')\s+Tbk\b', 'IgnoreCase')
          if ($tm.Success) { $hitTicker = (@($tm.Groups[1].Value, $tm.Groups[2].Value, $tm.Groups[3].Value) | Where-Object { $_ } | Select-Object -First 1).ToUpper() }
        }
        if (-not ($text -match $kw) -and -not $hitTicker) { continue }
        # Bila tidak menyebut emiten di radar, ambil kode saham dalam kurung di judul, mis. "(GMFI)".
        if (-not $hitTicker) { $hitTicker = [regex]::Match($a.title, '\(([A-Z]{4})\)').Groups[1].Value }
        $md5 = [BitConverter]::ToString([Security.Cryptography.MD5]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($a.url))).Replace("-", "").Substring(0, 16)
        $items += [ordered]@{
          id = "news-$md5"; date = $(if ($a.date) { $a.date } else { $today }); ticker = $hitTicker
          type = Get-NewsType $a.title; title = $a.title
          summary = $(if ($a.desc -and $a.desc.Length -gt 20) { $a.desc.Substring(0, [Math]::Min(300, $a.desc.Length)) } else { "" })
          source = $src.name; url = $a.url
        }
      }
    } catch {
      $code = $(if ($_.Exception.Response) { "HTTP " + [int]$_.Exception.Response.StatusCode } else { $_.Exception.Message })
      $errors += @{ source = $src.name; error = "$code" }
    }
  }
  return @{ items = $items; errors = $errors }
}

# ---- Profil emiten & skenario harga ----
$sbBase = "https://exodus.stockbit.com"
function Get-SB([string]$path) { return Invoke-Stockbit ([pscustomobject]@{ source = "api"; url = $sbBase + $path }) "" }

# Angka dari teks Stockbit: "230 B" -> 230e9, "(13 B)" -> -13e9, "32.88%" -> 32.88, "-" -> $null.
function To-Num([string]$s) {
  if (-not $s -or $s.Trim() -in @("-", "")) { return $null }
  $neg = $s -match '^\(.*\)$' -or $s.Trim().StartsWith('-')
  $m = [regex]::Match($s, '([\d.,]+)\s*([KMBT])?')
  if (-not $m.Success) { return $null }
  $v = [double]($m.Groups[1].Value -replace ',', '')
  switch ($m.Groups[2].Value) { 'K' { $v *= 1e3 } 'M' { $v *= 1e6 } 'B' { $v *= 1e9 } 'T' { $v *= 1e12 } }
  return $(if ($neg) { -$v } else { $v })
}

$chartCache = @{}   # ticker -> @{ at; prices }, agar benchmark tidak memanggil ulang dalam 6 jam
function Get-Prices([string]$ticker) {
  $c = $chartCache[$ticker]
  if ($c -and ((Get-Date) - $c.at).TotalHours -lt 6) { return $c.prices }
  # 3 tahun: cukup untuk melihat harga sebelum rumor backdoor pada transaksi yang PTW-nya sudah lama.
  $res = Get-SB "/charts/$ticker/daily?timeframe=3y"
  $prices = @($res.data.prices | Where-Object { $_.formatted_date -and $_.value } | ForEach-Object { @{ d = "$($_.formatted_date)"; v = [double]$_.value } })
  $chartCache[$ticker] = @{ at = Get-Date; prices = $prices }
  return $prices
}

# Candle harian (open/high/low/close/volume) untuk analisa teknikal. Volume dari Stockbit dalam lot.
$ohlcCache = @{}
function Get-Ohlc([string]$ticker, [string]$tf = "1y") {
  $key = "$ticker|$tf"
  $c = $ohlcCache[$key]
  if ($c -and ((Get-Date) - $c.at).TotalMinutes -lt 30) { return $c.bars }
  $res = Get-SB "/charts/$ticker/daily?timeframe=$tf&chart_type=PRICE_CHART_TYPE_CANDLE"
  $bars = @($res.data.prices | Where-Object { $_.formatted_date -and $_.value } | ForEach-Object {
    $cl = [double]$_.value
    # Hari tanpa transaksi kadang tanpa open/high/low: isi dengan harga penutupan.
    $o = $(if ("$($_.open)") { [double]$_.open } else { $cl }); $hi = $(if ("$($_.high)") { [double]$_.high } else { $cl }); $lo = $(if ("$($_.low)") { [double]$_.low } else { $cl })
    [ordered]@{ d = "$($_.formatted_date)"; o = $o; h = $hi; l = $lo; c = $cl; v = $(if ("$($_.volume)") { [double]$_.volume } else { 0 }) }
  })
  $ohlcCache[$key] = @{ at = Get-Date; bars = $bars }
  return $bars
}

function Get-Profile([string]$ticker) {
  $p = (Get-SB "/emitten/$ticker/profile").data
  $k = (Get-SB "/keystats/ratio/v1/$ticker`?year_limit=10").data
  $kv = @{}
  foreach ($g in @($k.closure_fin_items_results)) { foreach ($f in @($g.fin_name_results)) { $kv["$($f.fitem.name)"] = "$($f.fitem.value)" } }
  $yearAgo = (Get-Date).AddDays(-365).ToString("yyyy-MM-dd")
  $prices = @(Get-Prices $ticker | Where-Object { $_.d -ge $yearAgo })   # profil menampilkan 1 tahun terakhir
  # Grafik dirampingkan ke ±60 titik agar ringan.
  $step = [Math]::Max(1, [Math]::Floor($prices.Count / 60))
  $chart = @(for ($i = 0; $i -lt $prices.Count; $i += $step) { $prices[$i] }) + @($prices | Select-Object -Last 1)
  $ke = $p.key_executive
  return [ordered]@{
    ticker = $ticker
    background = ("$($p.background)" -replace '\s+', ' ').Trim()
    sector = "$($p.classification.sector.name)"; subSector = "$($p.classification.sub_sector.name)"; industry = "$($p.classification.industry.name)"
    website = "$(@($p.address)[0].website)".Trim(); office = "$(@($p.address)[0].office)".Trim()
    shareholders = @($p.shareholder | ForEach-Object { [ordered]@{ name = "$($_.name)"; pct = "$($_.percentage)"; value = "$($_.value)"; pengendali = (@($_.badges) -contains "pengendali") } })
    beneficiary = @($p.beneficiary | ForEach-Object { "$($_.name)" })
    directors = @($ke.director | ForEach-Object { "$($_.value)" })
    commissioners = @(@($ke.commissioner) + @($ke.independent_commissioner) | Where-Object { $_ } | ForEach-Object { "$($_.value)" + $(if ("$($_.key)" -match 'Independent') { " (independen)" } else { "" }) })
    stats = [ordered]@{
      marketCap = To-Num $k.stats.market_cap; shares = To-Num $k.stats.current_share_outstanding
      freeFloat = To-Num $k.stats.free_float; ev = To-Num $k.stats.enterprise_value
    }
    metrics = [ordered]@{
      pbv = To-Num $kv["Current Price to Book Value"]; bvps = To-Num $kv["Current Book Value Per Share"]
      epsAnn = To-Num $kv["Current EPS (Annualised)"]; per = To-Num $kv["Current PE Ratio (Annualised)"]
      equity = To-Num $kv["Total Equity"]; cash = To-Num $kv["Cash (Quarter)"]; assets = To-Num $kv["Total Assets (Quarter)"]
      revenueTtm = To-Num $kv["Revenue (TTM)"]; netIncomeTtm = To-Num $kv["Net Income (TTM)"]
      revGrowth = "$($kv['Revenue (Quarter YoY Growth)'])"; netMargin = "$($kv['Net Profit Margin (Quarter)'])"
      high52 = To-Num $kv["52 Week High"]; low52 = To-Num $kv["52 Week Low"]
      ret1y = "$($kv['1 Year Price Returns'])"; ret3m = "$($kv['3 Month Price Returns'])"; ytd = "$($kv['Year to Date Price Returns'])"
    }
    chart = $chart
  }
}

# Kepemilikan ringkas untuk tabel: kapitalisasi, porsi publik, dan pengendali (label "pengendali" dari Stockbit).
function Get-Ownership([string]$ticker) {
  $p = (Get-SB "/emitten/$ticker/profile").data
  $k = (Get-SB "/keystats/ratio/v1/$ticker`?year_limit=10").data   # Stockbit menolak nilai lain (400)
  $ctrl = @($p.shareholder | Where-Object { @($_.badges) -contains "pengendali" })
  $pct = { param($s) To-Num ("$s" -replace '%', '') }
  $guess = $false
  if (-not $ctrl.Count) {
    # Tanpa label pengendali: pakai pemegang terbesar selain masyarakat/publik, ditandai sebagai perkiraan.
    $ctrl = @($p.shareholder | Where-Object { "$($_.name)" -notmatch 'MASYARAKAT|PUBLIK|PUBLIC' } |
              Sort-Object { & $pct $_.percentage } -Descending | Select-Object -First 1)
    $guess = [bool]$ctrl.Count
  }
  return [ordered]@{
    ticker = $ticker
    controllerGuess = $guess
    marketCap = To-Num $k.stats.market_cap
    freeFloat = To-Num $k.stats.free_float
    controllerPct = $(if ($ctrl.Count) { [Math]::Round((($ctrl | ForEach-Object { & $pct $_.percentage }) | Measure-Object -Sum).Sum, 2) } else { $null })
    controllerName = (@($ctrl | ForEach-Object { "$($_.name)" }) -join ", ")
  }
}

# Story emiten: bisnis lama (profil) + pengendali lama/baru dari riwayat pergerakan pemegang saham besar.
function Norm-Name([string]$s) { return (($s.ToUpper() -replace '\b(PT|TBK|LTD|PTE|LIMITED|INC)\b', '' -replace '[^A-Z0-9]', '')) }
function Get-Story([string]$ticker, [string]$controller, [string]$near) {
  $p = (Get-SB "/emitten/$ticker/profile").data
  $bg = ("$($p.background)" -replace '\s+', ' ').Trim()
  # Riwayat pergerakan (maks 8 halaman, terbaru dulu).
  $moves = @()
  foreach ($pg in 1..8) {
    $j = Get-SB "/insider/company/majorholder?symbol=$ticker&page=$pg"
    $moves += @($j.data.movement)
    if (-not $j.data.is_more) { break }
    Start-Sleep -Milliseconds 200
  }
  $ci = [Globalization.CultureInfo]::InvariantCulture
  $rows = @($moves | ForEach-Object {
    $d = $null; try { $d = [datetime]::ParseExact("$($_.date)", "dd MMM yy", $ci) } catch {}
    [pscustomobject]@{ date = $d; name = "$($_.name)".Trim(); prev = [double]("0" + ("$($_.previous.percentage)" -replace '[^\d.]', '')); cur = [double]("0" + ("$($_.current.percentage)" -replace '[^\d.]', '')); action = "$($_.action_type)" }
  } | Where-Object { $_.date -and $_.prev -le 100 -and $_.cur -le 100 })   # buang data janggal (>100%)

  # Transaksi pengambilalihan = pembelian terbesar oleh pengendali baru (atau pembelian terbesar bila nama tidak cocok).
  $nc = Norm-Name $controller
  $buys = @($rows | Where-Object { $_.action -notmatch 'SELL' -and $_.cur -gt $_.prev } | Sort-Object { $_.cur - $_.prev } -Descending)
  # Bila tanggal PTW diketahui, pengambilalihan dicari 240 hari sebelum s.d. 15 hari sesudahnya.
  if ($near -match '^\d{4}-\d{2}-\d{2}$') {
    $nd = [datetime]::ParseExact($near, "yyyy-MM-dd", $ci)
    $inWin = @($buys | Where-Object { $_.date -ge $nd.AddDays(-240) -and $_.date -le $nd.AddDays(15) })
    if ($inWin.Count) { $buys = $inWin }
  }
  $isCtrl = { param($n) $nc -and ((Norm-Name $n).Contains($nc) -or $nc.Contains((Norm-Name $n))) }
  $buy = @($buys | Where-Object { & $isCtrl $_.name })[0]
  # Tanpa nama yang cocok: pembelian besar (≥15%) yang paling baru.
  if (-not $buy) { $buy = $buys | Where-Object { ($_.cur - $_.prev) -ge 15 } | Sort-Object date -Descending | Select-Object -First 1 }

  $old = @()
  if ($buy) {
    # Penjual dalam ±45 hari dari tanggal pembelian = pengendali lama (laporan penjual & pembeli bisa beda tanggal).
    $win = @($rows | Where-Object { $_.cur -lt $_.prev -and [Math]::Abs(($_.date - $buy.date).TotalDays) -le 45 -and (Norm-Name $_.name) -ne (Norm-Name $buy.name) })
    $old = @($win | Group-Object name | ForEach-Object {
      $g = $_.Group
      [ordered]@{ name = $_.Name; before = ($g | Measure-Object prev -Maximum).Maximum; after = ($g | Measure-Object cur -Minimum).Minimum }
    } | Where-Object { $_.before -ge 5 } | Sort-Object { $_.before } -Descending | Select-Object -First 4)
    if (-not $old.Count) {
      # Penjual tidak tercatat: pakai pemegang ≥20% terakhir sebelum pengambilalihan (bukan pembeli).
      $prior = $rows | Where-Object { $_.date -lt $buy.date -and ([Math]::Max($_.prev, $_.cur)) -ge 20 -and (Norm-Name $_.name) -ne (Norm-Name $buy.name) } |
               Sort-Object date -Descending | Select-Object -First 1
      if ($prior) { $old = @([ordered]@{ name = $prior.name; before = [Math]::Max($prior.prev, $prior.cur); after = $null; inferred = $true }) }
    }
  }
  return [ordered]@{
    ticker = $ticker
    sector = "$($p.classification.sector.name)"; subSector = "$($p.classification.sub_sector.name)"; industry = "$($p.classification.industry.name)"
    background = $(if ($bg.Length -gt 420) { $bg.Substring(0, 420) + "…" } else { $bg })
    takeover = $(if ($buy) { [ordered]@{ date = $buy.date.ToString("yyyy-MM-dd"); buyer = $buy.name; before = $buy.prev; after = $buy.cur } } else { $null })
    oldControllers = $old
  }
}

# Pengendali & afiliasi: identitas pengendali di riwayat pemegang saham emiten, lalu seluruh kepemilikannya
# di emiten lain (endpoint majorholder dengan parameter insider = id pemegang saham).
function Get-Controller([string]$ticker, [string]$name) {
  $ci = [Globalization.CultureInfo]::InvariantCulture
  $p = (Get-SB "/emitten/$ticker/profile").data
  $nc = Norm-Name $name
  # Cari id pemegang saham pengendali di riwayat emiten ini.
  $hid = $null; $hname = $name
  foreach ($pg in 1..8) {
    $j = Get-SB "/insider/company/majorholder?symbol=$ticker&page=$pg"
    $hit = @($j.data.movement) | Where-Object { $nc -and ((Norm-Name $_.name).Contains($nc) -or $nc.Contains((Norm-Name $_.name))) } | Select-Object -First 1
    if ($hit) { $hid = "$($hit.id)"; $hname = "$($hit.name)".Trim(); break }
    if (-not $j.data.is_more) { break }
    Start-Sleep -Milliseconds 200
  }
  # Seluruh pergerakan pemegang saham ini di semua emiten → posisi terakhir per emiten.
  $holdings = @()
  if ($hid) {
    $moves = @()
    foreach ($pg in 1..6) {
      $j = Get-SB "/insider/company/majorholder?insider=$hid&page=$pg"
      $moves += @($j.data.movement)
      if (-not $j.data.is_more) { break }
      Start-Sleep -Milliseconds 200
    }
    $rows = @($moves | ForEach-Object {
      $d = $null; try { $d = [datetime]::ParseExact("$($_.date)", "dd MMM yy", $ci) } catch {}
      [pscustomobject]@{ symbol = "$($_.symbol)"; date = $d; cur = [double]("0" + ("$($_.current.percentage)" -replace '[^\d.]', '')); action = ("$($_.action_type)" -replace 'ACTION_TYPE_', '') }
    } | Where-Object { $_.date -and $_.symbol })
    # API mengurutkan terbaru dulu (transaksi di tanggal sama tetap berurutan), jadi pakai urutan aslinya.
    $holdings = @($rows | Group-Object symbol | ForEach-Object {
      $last = $_.Group[0]
      $first = $_.Group[-1]
      [ordered]@{ symbol = $_.Name; pct = $last.cur; lastDate = $last.date.ToString("yyyy-MM-dd"); lastAction = $last.action; since = $first.date.ToString("yyyy-MM-dd") }
    } | Sort-Object { $_.pct } -Descending)
  }
  $ke = $p.key_executive
  $ctrl = @($p.shareholder | Where-Object { (Norm-Name $_.name).Contains($nc) -or $nc.Contains((Norm-Name $_.name)) }) | Select-Object -First 1
  return [ordered]@{
    ticker = $ticker; name = $hname; holderId = $hid
    pct = $(if ($ctrl) { "$($ctrl.percentage)" } else { "" }); shares = $(if ($ctrl) { "$($ctrl.value)" } else { "" })
    nationality = $(if ($ctrl) { "$($ctrl.nationality)" } else { "" })
    beneficiary = @($p.beneficiary | ForEach-Object { "$($_.name)" })
    directors = @($ke.director | ForEach-Object { "$($_.value)" })
    commissioners = @(@($ke.commissioner) + @($ke.independent_commissioner) | Where-Object { $_ } | ForEach-Object { "$($_.value)" })
    holdings = $holdings
  }
}

# Pergerakan pemegang saham >=5% dalam N hari terakhir, diringkas per pemegang (porsi awal -> akhir).
# Dipakai analisa untuk melihat apakah pengendali/afiliasi menambah atau diam-diam menjual setelah akuisisi.
function Get-Insider([string]$ticker, [int]$days = 180) {
  $ci = [Globalization.CultureInfo]::InvariantCulture
  $cutoff = (Get-Date).AddDays(-$days)
  $rows = @()
  foreach ($pg in 1..8) {
    $j = Get-SB "/insider/company/majorholder?symbol=$ticker&page=$pg"
    $page = @($j.data.movement)
    foreach ($m in $page) {
      $d = $null; try { $d = [datetime]::ParseExact("$($m.date)", "dd MMM yy", $ci) } catch {}
      if (-not $d) { continue }
      $prev = To-Num "$($m.previous.percentage)"; $cur = To-Num "$($m.current.percentage)"
      if ($prev -gt 100 -or $cur -gt 100) { continue }   # data rusak sesekali muncul > 100%
      $rows += [pscustomobject]@{ date = $d; name = "$($m.name)".Trim(); action = ("$($m.action_type)" -replace 'ACTION_TYPE_', ''); prev = $prev; cur = $cur; price = To-Num "$($m.price_formatted)" }
    }
    $oldest = @($rows | Sort-Object date)[0]
    if (-not $j.data.is_more -or ($oldest -and $oldest.date -lt $cutoff)) { break }
    Start-Sleep -Milliseconds 200
  }
  $recent = @($rows | Where-Object { $_.date -ge $cutoff })
  # API mengurutkan terbaru dulu: porsi akhir = baris pertama, porsi awal = baris terakhir per pemegang.
  $holders = @($recent | Group-Object name | ForEach-Object {
    $g = @($_.Group); $last = $g[0]; $first = $g[-1]
    $buys = @($g | Where-Object { $_.action -eq 'BUY' }).Count; $sells = @($g | Where-Object { $_.action -eq 'SELL' }).Count
    [ordered]@{ name = $_.Name; from = $first.prev; to = $last.cur; change = [Math]::Round($last.cur - $first.prev, 2)
      buys = $buys; sells = $sells; lastDate = $last.date.ToString("yyyy-MM-dd"); firstDate = $first.date.ToString("yyyy-MM-dd")
      lastPrice = $last.price }
  } | Sort-Object { [Math]::Abs($_.change) } -Descending)
  return [ordered]@{ ticker = $ticker; days = $days; holders = $holders }
}

# Benchmark backdoor: untuk tiap transaksi (kode:tanggalMulaiPTW), harga saat PTW dimulai vs puncak sesudahnya.
function Get-Benchmark([string[]]$deals) {
  $rows = @()
  foreach ($dl in $deals) {
    $sym, $start = $dl.Split(':')
    if ($sym -notmatch '^[A-Z]{4}$' -or $start -notmatch '^\d{4}-\d{2}-\d{2}$') { continue }
    try {
      $pr = Get-Prices $sym
      $d0 = [datetime]::ParseExact($start, "yyyy-MM-dd", $null)
      # Rumor dan pengumuman pengambilalihan biasanya 1–8 bulan sebelum PTW; harga dasar dicari dalam 240 hari.
      $preFrom = $d0.AddDays(-240).ToString("yyyy-MM-dd"); $runTo = $d0.AddDays(90).ToString("yyyy-MM-dd")
      $before = @($pr | Where-Object { $_.d -ge $preFrom -and $_.d -lt $start })
      $after  = @($pr | Where-Object { $_.d -ge $start })
      if ($before.Count -lt 20 -or $after.Count -lt 5) { continue }   # data sebelum PTW tidak cukup dalam jendela 1 tahun
      # Harga dasar = terendah 240 hari sebelum PTW; puncak = tertinggi dari titik itu sampai 90 hari sesudah PTW dimulai.
      $base = ($before | ForEach-Object { $_.v } | Measure-Object -Minimum).Minimum
      $baseDate = ($before | Where-Object { $_.v -eq $base } | Select-Object -First 1).d
      $peak = (@($pr | Where-Object { $_.d -ge $baseDate -and $_.d -le $runTo }) | ForEach-Object { $_.v } | Measure-Object -Maximum).Maximum
      $p0 = $after[0].v; $last = $after[-1].v
      if ($base -le 0 -or $p0 -le 0) { continue }
      $peakDate = (@($pr | Where-Object { $_.d -ge $baseDate -and $_.d -le $runTo -and $_.v -eq $peak }) | Select-Object -First 1).d
      $dayOf = { param($s) [int]([datetime]::ParseExact($s, "yyyy-MM-dd", $null) - $d0).TotalDays }
      # Deret siklus: harga ÷ harga saat PTW dimulai, diukur dalam hari dari PTW (titik tiap ±3 hari bursa agar ringan).
      $win = @($pr | Where-Object { $_.d -ge $preFrom })
      $series = @(for ($i = 0; $i -lt $win.Count; $i += 3) { ,@((& $dayOf $win[$i].d), [Math]::Round($win[$i].v / $p0, 4)) })
      $rows += [ordered]@{ ticker = $sym; start = $start; base = $base; peak = $peak; p0 = $p0; last = $last
        runupX = [Math]::Round($peak / $base, 2); postX = [Math]::Round($last / $p0, 2)
        baseDay = (& $dayOf $baseDate); peakDay = $(if ($peakDate) { & $dayOf $peakDate } else { $null }); lastDay = (& $dayOf $after[-1].d)
        series = $series }
    } catch {}
    Start-Sleep -Milliseconds 200
  }
  $q = { param($arr, $f) $s = @($arr | Sort-Object); if (-not $s.Count) { return $null }; $i = ($s.Count - 1) * $f; $lo = [Math]::Floor($i); $hi = [Math]::Ceiling($i); return [Math]::Round($s[$lo] + ($s[$hi] - $s[$lo]) * ($i - $lo), 2) }
  $rx = @($rows | ForEach-Object { $_.runupX }); $px = @($rows | ForEach-Object { $_.postX })
  return [ordered]@{ n = $rows.Count; runupQ1 = (& $q $rx 0.25); runupMedian = (& $q $rx 0.5); runupQ3 = (& $q $rx 0.75)
    postMedian = (& $q $px 0.5); deals = $rows }
}

# Ubah "Reports" Stockbit (keterbukaan informasi BEI + ringkasan AI Stockbit)
# menjadi item berita untuk menu "Update backdoor terbaru".
function Convert-Reports($res, [string]$ticker, $cfgReports) {
  $days = $(if ($cfgReports.days) { [int]$cfgReports.days } else { 180 })
  $cutoff = (Get-Date).AddDays(-$days).ToString("yyyy-MM-dd")
  $skip = "$($cfgReports.skipTitle)"
  $out = @()
  foreach ($s in @($res.data.stream)) {
    $title = ("$($s.title)" -replace '\s*\[[A-Z0-9-]+\]\s*$', '').Trim()
    $date = "$($s.created_at)".Substring(0, [Math]::Min(10, "$($s.created_at)".Length))
    if (-not $title -or $date -lt $cutoff) { continue }
    if ($skip -and $title -match $skip) { continue }   # laporan rutin yang tidak relevan

    $type = Get-NewsType $title
    $sum = $s.summary
    $text = @($sum.summary, $(if ($sum.key_takeaway) { "Inti: " + $sum.key_takeaway })) | Where-Object { $_ }
    # Poin kunci memuat rincian (nilai, porsi, jadwal) yang tidak ada di ringkasan; disimpan terpisah untuk Story Emiten.
    $points = (@($sum.key_points) | Where-Object { $_ }) -join " · "
    $out += [ordered]@{
      id = "sb-report-$($s.stream_id)"; date = $date; ticker = $ticker; type = $type
      title = $title
      summary = $(if ($text) { ($text -join " ") + " (Ringkasan AI Stockbit)" } else { "" })
      points = $points
      source = "Stockbit Reports"
      url = "https://stockbit.com/post/$($s.stream_id)"   # halaman post Stockbit Reports (bisa dibuka publik)
    }
  }
  return ,$out
}

function Handle-Api($ctx, [string]$path) {
  $cfg = Get-Config
  $ticker = ("" + $ctx.Request.QueryString["ticker"]).ToUpper()

  if ($path -eq "api/status") {
    Send-Json $ctx @{
      ok = $true
      tokenLoaded = [bool](Get-Token)
      tokenExp = Get-TokenExp
      needsToken = [bool]($cfg -and $cfg.quote -and $cfg.quote.source -ne "page")
      configured = [bool]($cfg -and $cfg.quote -and $cfg.quote.url -and $cfg.quote.url -notmatch 'GANTI')
      reports = [bool]($cfg -and $cfg.reports -and $cfg.reports.url)
      news = [bool]($cfg -and $cfg.news -and $cfg.news.sources)
      tenders = [bool]($cfg -and $cfg.tenders -and $cfg.tenders.url)
    }
    return
  }
  if ($path -eq "api/tenders") {
    # Daftar penawaran tender seluruh BEI dari Stockbit; satu baris (terbaru) per emiten.
    if (-not $cfg -or -not $cfg.tenders) { Send-Json $ctx @{ error = "Bagian tenders belum ada di stockbit.config.json." } 500; return }
    try {
      $res = Invoke-Stockbit $cfg.tenders ""
      $minPct = $(if ($cfg.tenders.minPercent) { [double]$cfg.tenders.minPercent } else { 0 })
      $by = @{}
      foreach ($t in @($res.data.tender)) {
        $sym = "$($t.company_symbol)"
        if ($sym -notmatch '^[A-Z]{4}$') { continue }
        # Tender kecil (sisa saham/sukarela) biasanya bukan pengambilalihan; batas diatur di config.
        if ([double]("0" + $t.tender_percentage) -lt $minPct) { continue }
        if (-not $by.ContainsKey($sym) -or "$($t.tender_start)" -gt "$($by[$sym].start)") {
          $by[$sym] = [ordered]@{
            ticker = $sym; name = "$($t.company_name)"; price = [double]$t.tender_price; percent = [double]$t.tender_percentage
            shares = "$($t.tender_shares)"; start = "$($t.tender_start)"; end = "$($t.tender_end)"; paydate = "$($t.tender_paydate)"
            active = [bool]$t.corp_action_active
          }
        }
      }
      # Daftar backdoor dari config: tambahkan yang belum ada, cari tender lamanya di riwayat aksi korporasi.
      $bd = $cfg.backdoor
      $include = @($(if ($bd) { $bd.include } else { @() }) | Where-Object { "$_" -match '^[A-Z]{4}$' })
      $exclude = @($(if ($bd) { $bd.exclude } else { @() }))
      foreach ($sym in $include) {
        if ($by.ContainsKey($sym)) { $by[$sym].confirmed = $true; continue }
        $entry = [ordered]@{ ticker = $sym; name = ""; confirmed = $true }
        try {
          $ca = Invoke-Stockbit ([pscustomobject]@{ source = "api"; url = $bd.corpactionUrl }) $sym
          $to = @($ca.data | Where-Object { $_.action_type -eq "tenderoffer" } | ForEach-Object { $_.action_info.tenderoffer }) |
                Sort-Object tender_start -Descending | Select-Object -First 1
          if ($to) {
            $entry.name = "$($to.company_name)"; $entry.price = [double]$to.tender_price; $entry.percent = [double]$to.tender_percentage
            $entry.shares = "$($to.tender_shares)"; $entry.start = "$($to.tender_start)"; $entry.end = "$($to.tender_end)"
            $entry.paydate = "$($to.tender_paydate)"; $entry.active = [bool]$to.corp_action_active
          }
        } catch {}
        $by[$sym] = $entry
        Start-Sleep -Milliseconds 300   # jeda antar-permintaan ke Stockbit
      }
      foreach ($x in $exclude) { $by.Remove("$x") }
      Send-Json $ctx @{ items = @($by.Values); exclude = $exclude }
    } catch {
      if ($_.Exception.Message -eq "NO_TOKEN") { Send-Json $ctx @{ error = "Token belum diisi. Simpan di file .stockbit-token." } 401; return }
      if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) { Send-Json $ctx @{ error = "Token ditolak Stockbit (kedaluwarsa?). Ambil token baru." } 401; return }
      Send-Json $ctx @{ error = "Gagal memanggil Stockbit: $($_.Exception.Message)" } 502
    }
    return
  }

  if ($path -eq "api/ohlc") {
    if (-not (Get-Token)) { Send-Json $ctx @{ error = "Token belum diisi." } 401; return }
    if ($ticker -notmatch '^[A-Z]{4}$') { Send-Json $ctx @{ error = "Kode saham harus 4 huruf." } 400; return }
    $tf = "" + $ctx.Request.QueryString["tf"]
    if ($tf -notin @("3m", "6m", "1y", "3y")) { $tf = "1y" }
    try { Send-Json $ctx @{ ticker = $ticker; tf = $tf; bars = @(Get-Ohlc $ticker $tf) } }
    catch {
      if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) { Send-Json $ctx @{ error = "Token ditolak Stockbit (kedaluwarsa?)." } 401; return }
      Send-Json $ctx @{ error = "Gagal memanggil Stockbit: $($_.Exception.Message)" } 502
    }
    return
  }

  if ($path -eq "api/insider") {
    if (-not (Get-Token)) { Send-Json $ctx @{ error = "Token belum diisi." } 401; return }
    if ($ticker -notmatch '^[A-Z]{4}$') { Send-Json $ctx @{ error = "Kode saham harus 4 huruf." } 400; return }
    # TryParse mengisi 0 bila gagal, jadi pakai variabel terpisah agar bawaan 180 hari tetap berlaku.
    $days = 180; $parsed = 0
    if ([int]::TryParse("" + $ctx.Request.QueryString["days"], [ref]$parsed)) { $days = $parsed }
    try { Send-Json $ctx (Get-Insider $ticker ([Math]::Max(30, [Math]::Min(720, $days)))) }
    catch {
      if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) { Send-Json $ctx @{ error = "Token ditolak Stockbit (kedaluwarsa?)." } 401; return }
      Send-Json $ctx @{ error = "Gagal memanggil Stockbit: $($_.Exception.Message)" } 502
    }
    return
  }

  if ($path -eq "api/controller") {
    if (-not (Get-Token)) { Send-Json $ctx @{ error = "Token belum diisi." } 401; return }
    if ($ticker -notmatch '^[A-Z]{4}$') { Send-Json $ctx @{ error = "Kode saham harus 4 huruf." } 400; return }
    try { Send-Json $ctx (Get-Controller $ticker ("" + $ctx.Request.QueryString["name"])) }
    catch {
      if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) { Send-Json $ctx @{ error = "Token ditolak Stockbit (kedaluwarsa?)." } 401; return }
      Send-Json $ctx @{ error = "Gagal memanggil Stockbit: $($_.Exception.Message)" } 502
    }
    return
  }

  if ($path -eq "api/story") {
    if (-not (Get-Token)) { Send-Json $ctx @{ error = "Token belum diisi." } 401; return }
    if ($ticker -notmatch '^[A-Z]{4}$') { Send-Json $ctx @{ error = "Kode saham harus 4 huruf." } 400; return }
    try { Send-Json $ctx (Get-Story $ticker ("" + $ctx.Request.QueryString["controller"]) ("" + $ctx.Request.QueryString["near"])) }
    catch {
      if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) { Send-Json $ctx @{ error = "Token ditolak Stockbit (kedaluwarsa?)." } 401; return }
      Send-Json $ctx @{ error = "Gagal memanggil Stockbit: $($_.Exception.Message)" } 502
    }
    return
  }

  if ($path -eq "api/ownership") {
    if (-not (Get-Token)) { Send-Json $ctx @{ error = "Token belum diisi." } 401; return }
    if ($ticker -notmatch '^[A-Z]{4}$') { Send-Json $ctx @{ error = "Kode saham harus 4 huruf." } 400; return }
    try { Send-Json $ctx (Get-Ownership $ticker) }
    catch {
      if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) { Send-Json $ctx @{ error = "Token ditolak Stockbit (kedaluwarsa?)." } 401; return }
      Send-Json $ctx @{ error = "Gagal memanggil Stockbit: $($_.Exception.Message)" } 502
    }
    return
  }

  if ($path -eq "api/profile" -or $path -eq "api/benchmark") {
    if (-not (Get-Token)) { Send-Json $ctx @{ error = "Token belum diisi. Simpan di file .stockbit-token." } 401; return }
    try {
      if ($path -eq "api/profile") {
        if ($ticker -notmatch '^[A-Z]{4}$') { Send-Json $ctx @{ error = "Kode saham harus 4 huruf." } 400; return }
        Send-Json $ctx (Get-Profile $ticker)
      } else {
        $deals = @(("" + $ctx.Request.QueryString["deals"]).Split(',') | Where-Object { $_ })
        Send-Json $ctx (Get-Benchmark $deals)
      }
    } catch {
      if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) { Send-Json $ctx @{ error = "Token ditolak Stockbit (kedaluwarsa?). Ambil token baru." } 401; return }
      Send-Json $ctx @{ error = "Gagal memanggil Stockbit: $($_.Exception.Message)" } 502
    }
    return
  }

  if ($path -eq "api/news") {
    if (-not $cfg -or -not $cfg.news) { Send-Json $ctx @{ error = "Bagian news belum ada di stockbit.config.json." } 500; return }
    # Hanya kode saham 4 huruf yang dipakai untuk pencocokan.
    $tickers = @(("" + $ctx.Request.QueryString["tickers"]).ToUpper().Split(',') | Where-Object { $_ -match '^[A-Z]{4}$' })
    Send-Json $ctx (Get-News $cfg.news $tickers)
    return
  }

  # Hanya kode saham 4 huruf yang diteruskan ke Stockbit.
  if ($ticker -notmatch '^[A-Z]{4}$') { Send-Json $ctx @{ error = "Kode saham harus 4 huruf." } 400; return }
  if (-not $cfg -or -not $cfg.quote) { Send-Json $ctx @{ error = "stockbit.config.json belum diisi." } 500; return }

  if ($path -eq "api/reports") {
    if (-not $cfg.reports) { Send-Json $ctx @{ error = "Bagian reports belum ada di stockbit.config.json." } 500; return }
    try {
      # Ambil beberapa halaman (30 laporan/halaman) sampai melewati batas hari atau maxPages.
      $maxPages = $(if ($cfg.reports.maxPages) { [int]$cfg.reports.maxPages } else { 1 })
      $days = $(if ($cfg.reports.days) { [int]$cfg.reports.days } else { 180 })
      $cutoff = (Get-Date).AddDays(-$days).ToString("yyyy-MM-dd")
      $all = @(); $cursor = 0
      for ($pg = 1; $pg -le $maxPages; $pg++) {
        $ep = [pscustomobject]@{ source = "api"; url = ($cfg.reports.url -replace 'last_stream_id=\d+', "last_stream_id=$cursor") }
        $res = Invoke-Stockbit $ep $ticker
        $page = @($res.data.stream); $all += $page
        $oldest = @($page | ForEach-Object { "$($_.created_at)".Substring(0, 10) } | Sort-Object)[0]
        if ($res.data.pagination.is_last_page -or -not $page.Count -or $oldest -lt $cutoff) { break }
        $cursor = $res.data.pagination.next_cursor
        Start-Sleep -Milliseconds 250
      }
      $merged = [pscustomobject]@{ data = [pscustomobject]@{ stream = $all } }
      Send-Json $ctx @{ ticker = $ticker; items = (Convert-Reports $merged $ticker $cfg.reports) }
    } catch {
      if ($_.Exception.Message -eq "NO_TOKEN") { Send-Json $ctx @{ error = "Token belum diisi. Simpan di file .stockbit-token." } 401; return }
      if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) { Send-Json $ctx @{ error = "Token ditolak Stockbit (kedaluwarsa?). Ambil token baru." } 401; return }
      Send-Json $ctx @{ error = "Gagal memanggil Stockbit: $($_.Exception.Message)" } 502
    }
    return
  }

  try {
    $res = Invoke-Stockbit $cfg.quote $ticker
    if ($path -eq "api/raw") {
      # Untuk mencari path field saat mengisi config. Postingan pengguna (stream) tidak ikut dikirim.
      if ($res.props -and $res.props.pageProps) { $res.props.pageProps.PSObject.Properties.Remove("posts") }
      Send-Json $ctx $res; return
    }

    $f = $cfg.quote.fields
    $num = { param($v) if ($null -eq $v -or "$v" -eq "") { $null } else { [double]("$v" -replace '[^\d\.\-]', '') } }
    $mcap = & $num (Get-ByPath $res $f.mcap)
    if ($null -ne $mcap -and $cfg.quote.mcapDivisor) { $mcap = $mcap / [double]$cfg.quote.mcapDivisor }
    Send-Json $ctx @{
      ticker = $ticker
      name   = (Get-ByPath $res $f.name)
      price  = (& $num (Get-ByPath $res $f.price))
      mcap   = $mcap
      float  = (& $num (Get-ByPath $res $f.float))
      uma    = (Get-ByPath $res $f.uma) -eq $true
      corpAction = (Get-ByPath $res $f.corpAction) -eq $true
      volume = (& $num (Get-ByPath $res $f.volume))
      avgVolume = (& $num (Get-ByPath $res $f.avgVolume))
    }
  } catch {
    $msg = $_.Exception.Message
    $code = 502
    if ($msg -eq "NO_TOKEN") { Send-Json $ctx @{ error = "Token belum diisi. Simpan di file .stockbit-token." } 401; return }
    if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) {
      Send-Json $ctx @{ error = "Token ditolak Stockbit (kedaluwarsa?). Ambil token baru." } 401; return
    }
    Send-Json $ctx @{ error = "Gagal memanggil Stockbit: $msg" } $code
  }
}

$listener = [System.Net.HttpListener]::new()
if ($Lan) { $listener.Prefixes.Add("http://+:$Port/") }        # semua antarmuka jaringan
else { $listener.Prefixes.Add("http://localhost:$Port/") }     # hanya komputer ini
try { $listener.Start() } catch {
  if ($Lan -and $_.Exception.Message -match 'denied|ditolak|Access') {
    Write-Host "Mode LAN butuh izin Windows sekali saja. Jalankan sebagai Administrator:"
    Write-Host "  netsh http add urlacl url=http://+:$Port/ user=`"$env:USERDOMAIN\$env:USERNAME`""
  } else {
    Write-Host "Port $Port sedang dipakai. Kemungkinan Radar Backdoor sudah berjalan di jendela lain;"
    Write-Host "tutup jendela itu dulu, lalu jalankan ulang (perubahan kode baru terbaca setelah restart)."
  }
  exit 1
}
Write-Host "Radar Backdoor berjalan di http://localhost:$Port"
# Kunci akses untuk perangkat lain (mode LAN). Disimpan di .lan-key (dotfile, tidak pernah disajikan).
# Wajib dipertahankan: tanpa kunci, siapa pun di jaringan yang sama bisa memakai proxy dengan token Stockbit pribadi.
$lanKey = $null
if ($Lan) {
  $keyPath = Join-Path $root ".lan-key"
  if (Test-Path $keyPath) { $lanKey = (Get-Content $keyPath -Raw).Trim() }
  if (-not $lanKey) {
    $chars = 'abcdefghjkmnpqrstuvwxyz23456789'.ToCharArray()
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $b = New-Object byte[] 10; $rng.GetBytes($b)
    $lanKey = -join ($b | ForEach-Object { $chars[$_ % $chars.Length] })
    Set-Content -Path $keyPath -Value $lanKey -NoNewline
  }
  # Alamat IPv4 semua antarmuka aktif (bukan loopback), untuk dibuka dari perangkat lain.
  $ips = @([Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
    Where-Object { $_.OperationalStatus -eq 'Up' } |
    ForEach-Object { $_.GetIPProperties().UnicastAddresses } |
    Where-Object { $_.Address.AddressFamily -eq 'InterNetwork' -and "$($_.Address)" -notmatch '^127\.' } |
    ForEach-Object { "$($_.Address)" })
  Write-Host ""
  Write-Host "LINK UNTUK DIBAGIKAN (perangkat di jaringan yang sama):"
  foreach ($ip in $ips) { Write-Host "  http://$($ip):$Port/?key=$lanKey" }
  Write-Host "Tanpa ?key=... akses dari perangkat lain ditolak. Ganti kunci: hapus file website\.lan-key lalu jalankan ulang."
}

# Perangkat lain wajib membawa kunci (di link atau cookie); komputer ini sendiri tidak perlu.
function Test-Access($ctx) {
  if (-not $lanKey) { return $true }
  $ip = $ctx.Request.RemoteEndPoint.Address
  if ([Net.IPAddress]::IsLoopback($ip)) { return $true }
  if ("" + $ctx.Request.QueryString["key"] -eq $lanKey) {
    $ctx.Response.AppendHeader("Set-Cookie", "rbkey=$lanKey; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000")
    return $true
  }
  $c = $ctx.Request.Cookies["rbkey"]
  return ($c -and $c.Value -eq $lanKey)
}
# Mode LAN: tolak permintaan dari luar jaringan lokal, karena proxy memakai token Stockbit pribadi.
function Test-LocalClient($ctx) {
  $ip = $ctx.Request.RemoteEndPoint.Address
  if ($ip.IsIPv4MappedToIPv6) { $ip = $ip.MapToIPv4() }
  $s = "$ip"
  return ($s -match '^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)' -or $s -eq '::1' -or $s -match '^fe80:')
}
Write-Host ("Token Stockbit: " + $(if (Get-Token) { "terbaca" } else { "belum ada (tidak wajib untuk mode page)" }))

$types = @{ ".html" = "text/html; charset=utf-8"; ".css" = "text/css"; ".js" = "text/javascript"; ".png" = "image/png"; ".svg" = "image/svg+xml"; ".json" = "application/json" }
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    if (-not (Test-LocalClient $ctx)) { $ctx.Response.StatusCode = 403; continue }
    if (-not (Test-Access $ctx)) {
      $msg = [Text.Encoding]::UTF8.GetBytes("<!doctype html><meta charset=utf-8><title>Radar Backdoor</title><p style='font-family:system-ui;padding:40px'>Akses ditolak. Buka link lengkap yang dibagikan (berisi <code>?key=...</code>).</p>")
      $ctx.Response.StatusCode = 401; $ctx.Response.ContentType = "text/html; charset=utf-8"
      $ctx.Response.OutputStream.Write($msg, 0, $msg.Length); continue
    }
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    $script:Fresh = ("" + $ctx.Request.QueryString["fresh"]) -eq "1"
    if ($path.StartsWith("api/")) { Handle-Api $ctx $path; continue }
    if ($path -eq "") { $path = "index.html" }
    $file = [IO.Path]::GetFullPath((Join-Path $root $path))
    $name = [IO.Path]::GetFileName($file)
    # Jangan pernah sajikan file token, dotfile, script, atau file di luar folder.
    $blocked = $name.StartsWith(".") -or $name.EndsWith(".ps1") -or $name -eq "stockbit.config.json" -or -not $file.StartsWith($root)
    if (-not $blocked -and (Test-Path $file -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file)
      $ctx.Response.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" })
      # Selalu validasi ulang ke server: tanpa ini browser memakai index.html lama setelah desain diperbarui.
      $ctx.Response.AddHeader("Cache-Control", "no-cache")
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
  } catch {
    $ctx.Response.StatusCode = 500
  } finally {
    $ctx.Response.Close()
  }
}
