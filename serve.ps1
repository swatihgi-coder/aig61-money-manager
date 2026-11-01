# MoneyManager local preview server: serves this folder at http://localhost:5500
# Uses only what's built into Windows. Close this window (or press Ctrl+C) to stop.
$ErrorActionPreference = 'Stop'
try {
  $root = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\') + '\'
  if (-not (Test-Path -LiteralPath (Join-Path $root 'index.html'))) { throw "index.html was not found next to serve.ps1 in $root" }
  $types = @{ '.html'='text/html; charset=utf-8'; '.js'='application/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
    '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'; '.ico'='image/x-icon'; '.json'='application/json';
    '.md'='text/plain; charset=utf-8'; '.sql'='text/plain; charset=utf-8'; '.txt'='text/plain; charset=utf-8' }

  $listener = $null; $lastErr = ''
  foreach ($port in 5500..5510) {
    try {
      $l = New-Object System.Net.HttpListener
      $l.Prefixes.Add("http://localhost:$port/")
      $l.Start(); $listener = $l; $usePort = $port; break
    } catch { $lastErr = $_.Exception.Message }
  }
  if (-not $listener) { throw "Couldn't open ports 5500-5510. Last error: $lastErr" }

  $url = "http://localhost:$usePort/"
  Write-Host ""
  Write-Host "  MoneyManager is running at $url" -ForegroundColor Green
  Write-Host "  Keep this window open while you use the site. Close it to stop."
  Write-Host ""
  Start-Process $url

  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
      $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
      if ($rel -eq '') { $rel = 'index.html' }
      $file = [IO.Path]::GetFullPath((Join-Path $root $rel))
      $res = $ctx.Response
      $res.Headers.Add('Cache-Control', 'no-store')
      if ($file.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $file -PathType Leaf)) {
        $bytes = [IO.File]::ReadAllBytes($file)
        $ext = [IO.Path]::GetExtension($file).ToLower()
        $res.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' })
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        Write-Host ("  200  /" + $rel)
      } else {
        $res.StatusCode = 404
        Write-Host ("  404  /" + $rel) -ForegroundColor DarkYellow
      }
      $res.Close()
    } catch { Write-Host ("  Request error: " + $_.Exception.Message) -ForegroundColor DarkYellow }
  }
} catch {
  Write-Host ""
  Write-Host "  MoneyManager couldn't start:" -ForegroundColor Red
  Write-Host ("  " + $_.Exception.Message) -ForegroundColor Red
  Write-Host ""
  Write-Host "  You can still preview the site: double-click index.html in this folder."
  exit 1
}
