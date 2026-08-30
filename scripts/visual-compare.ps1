param(
  [string]$ConfigPath = ".visual-reference.local.json",
  [string]$OutputDir = "artifacts/visual"
)

Add-Type -AssemblyName System.Drawing
$config = Get-Content -Raw -Encoding UTF8 $ConfigPath | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

foreach ($item in $config.pages) {
  $actualPath = Join-Path $OutputDir "$($item.name)-actual.png"
  if (-not (Test-Path -LiteralPath $actualPath)) { throw "Missing actual screenshot: $actualPath" }

  $actual = [System.Drawing.Bitmap]::FromFile((Resolve-Path -LiteralPath $actualPath))
  $reference = [System.Drawing.Image]::FromFile($item.reference)
  $normalized = New-Object System.Drawing.Bitmap($actual.Width, $actual.Height)
  $graphics = [System.Drawing.Graphics]::FromImage($normalized)
  $graphics.Clear([System.Drawing.Color]::White)
  $clip = $item.referenceClip
  $graphics.DrawImage($reference, (New-Object System.Drawing.Rectangle(0, 0, $actual.Width, $actual.Height)), $clip.x, $clip.y, $clip.width, $clip.height, [System.Drawing.GraphicsUnit]::Pixel)
  $graphics.Dispose()
  $referenceOut = Join-Path $OutputDir "$($item.name)-reference.png"
  $normalized.Save($referenceOut, [System.Drawing.Imaging.ImageFormat]::Png)

  $diff = New-Object System.Drawing.Bitmap($actual.Width, $actual.Height)
  $changed = 0
  for ($y = 0; $y -lt $actual.Height; $y++) {
    for ($x = 0; $x -lt $actual.Width; $x++) {
      $a = $actual.GetPixel($x, $y)
      $r = $normalized.GetPixel($x, $y)
      $delta = [Math]::Abs($a.R - $r.R) + [Math]::Abs($a.G - $r.G) + [Math]::Abs($a.B - $r.B)
      if ($delta -gt 30) {
        $changed++
        $diff.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, 228, 78, 88))
      } else {
        $diff.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, 250, 250, 250))
      }
    }
  }
  $diff.Save((Join-Path $OutputDir "$($item.name)-diff.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $totalPixels = $actual.Width * $actual.Height
  $diff.Dispose()
  $normalized.Dispose()
  $actual.Dispose()
  $ratio = [Math]::Round(($changed / $totalPixels) * 100, 2)
  Write-Output "$($item.name): $ratio% pixels differ"
}
