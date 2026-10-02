# Minimal static file server (no Node/Python needed). Usage: powershell -File tools\serve.ps1 [-Port 8080]
# Then open http://localhost:8080/docs/?demo=admin  (demo=lead or demo=rep to try other access levels; add &seed=1 on the Sales page for example orders)
param([int]$Port = 8080)
$root = Split-Path $PSScriptRoot -Parent
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.json'='application/json; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.md'='text/plain; charset=utf-8' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
"Serving $root at http://localhost:$Port/docs/?demo=admin"
while ($l.IsListening) {
  $ctx = $l.GetContext()
  $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  if (-not $rel) { $rel = 'docs/' }
  $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
  if (Test-Path -LiteralPath $path -PathType Container) { $path = Join-Path $path 'index.html' }
  $res = $ctx.Response
  if ($path.StartsWith($root) -and (Test-Path -LiteralPath $path -PathType Leaf)) {
    $bytes = [IO.File]::ReadAllBytes($path)
    $ext = [IO.Path]::GetExtension($path).ToLower()
    $res.ContentType = if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' }
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } else { $res.StatusCode = 404 }
  $res.Close()
}
