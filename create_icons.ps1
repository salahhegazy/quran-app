Add-Type -AssemblyName System.Drawing

$srcPath = "D:\New folder\download.jpg"
if (!(Test-Path $srcPath)) {
    $srcPath = "D:\quran-app\public\icon.jpg"
}

$srcImg = [System.Drawing.Image]::FromFile($srcPath)

function Save-ResizedImage {
    param(
        [System.Drawing.Image]$src,
        [int]$width,
        [int]$height,
        [string]$destPath
    )
    $destDir = [System.IO.Path]::GetDirectoryName($destPath)
    if (!(Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $graph = [System.Drawing.Graphics]::FromImage($bmp)
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graph.Clear([System.Drawing.Color]::White)
    
    $graph.DrawImage($src, 0, 0, $width, $height)
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graph.Dispose()
    $bmp.Dispose()
    Write-Host "Saved: $destPath ($width x $height)"
}

$sizes = @(
    @{ dir="mipmap-mdpi"; w=48; h=48; fgW=108; fgH=108 },
    @{ dir="mipmap-hdpi"; w=72; h=72; fgW=162; fgH=162 },
    @{ dir="mipmap-xhdpi"; w=96; h=96; fgW=216; fgH=216 },
    @{ dir="mipmap-xxhdpi"; w=144; h=144; fgW=324; fgH=324 },
    @{ dir="mipmap-xxxhdpi"; w=192; h=192; fgW=432; fgH=432 }
)

$baseRes = "D:\New folder\quran-app\android\app\src\main\res"

foreach ($s in $sizes) {
    $targetDir = Join-Path $baseRes $s.dir
    Save-ResizedImage -src $srcImg -width $s.w -height $s.h -destPath (Join-Path $targetDir "ic_launcher.png")
    Save-ResizedImage -src $srcImg -width $s.w -height $s.h -destPath (Join-Path $targetDir "ic_launcher_round.png")
    Save-ResizedImage -src $srcImg -width $s.fgW -height $s.fgH -destPath (Join-Path $targetDir "ic_launcher_foreground.png")
}

# Public web icons
Save-ResizedImage -src $srcImg -width 512 -height 512 -destPath "D:\New folder\quran-app\public\icon.png"
Save-ResizedImage -src $srcImg -width 192 -height 192 -destPath "D:\New folder\quran-app\public\icon-192.png"
Copy-Item $srcPath "D:\New folder\quran-app\public\download.jpg" -Force

$srcImg.Dispose()
Write-Host "All icons generated successfully!"
