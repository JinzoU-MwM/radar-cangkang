# Tes cache SQLite serve.ps1 (tanpa menjalankan server): pwsh -NoProfile -File test-cache.ps1
$ast = [System.Management.Automation.Language.Parser]::ParseFile("$PSScriptRoot/website/serve.ps1", [ref]$null, [ref]$null)
foreach ($f in $ast.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -in 'Test-MarketOpen', 'Get-CacheTtl', 'Read-Cache', 'Get-CachedText' }, $true)) {
  . ([scriptblock]::Create($f.Extent.Text))
}
$sqlite = (Get-Command sqlite3).Source
$cacheDb = [IO.Path]::GetTempFileName()
& $sqlite $cacheDb "CREATE TABLE http_cache(url TEXT PRIMARY KEY, body TEXT NOT NULL, fetched_at INTEGER NOT NULL);"
$script:Fresh = $false
$u = "https://example.test/it's?x=1"
$calls = 0
$a = Get-CachedText $u { $script:calls++; "isi baru`nbaris 2 é" }
$b = Get-CachedText $u { $script:calls++; "tidak boleh dipanggil" }
if ($a -ne "isi baru`nbaris 2 é" -or $b -ne $a -or $calls -ne 1) { throw "cache hit gagal: '$b' calls=$calls" }
$script:Fresh = $true
$c = Get-CachedText $u { throw "Stockbit 429" }   # sumber gagal: salinan lama dipakai
if ($c -ne $a) { throw "fallback basi gagal: '$c'" }
$threw = $false; try { Get-CachedText "https://example.test/baru" { throw "putus" } | Out-Null } catch { $threw = $true }
if (-not $threw) { throw "tanpa salinan lama, error harus diteruskan" }
Remove-Item $cacheDb
"ok"
