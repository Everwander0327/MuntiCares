Add-Type -AssemblyName System.Drawing

function Optimize-ImageFile {
    param(
        [string]$Path,
        [int]$MaxWidth = 1600,
        [int]$MaxHeight = 1200,
        [long]$Quality = 80
    )

    if (-not (Test-Path $Path)) { return }
    $fileBytes = [System.IO.File]::ReadAllBytes($Path)
    $ms = New-Object System.IO.MemoryStream($fileBytes, 0, $fileBytes.Length)
    $img = [System.Drawing.Image]::FromStream($ms)

    $w = $img.Width
    $h = $img.Height
    $origSize = $fileBytes.Length

    $ratio = [Math]::Min($MaxWidth / [double]$w, $MaxHeight / [double]$h)
    if ($ratio -gt 1.0) { $ratio = 1.0 }

    $newW = [int][Math]::Round($w * $ratio)
    $newH = [int][Math]::Round($h * $ratio)

    $newImg = New-Object System.Drawing.Bitmap($newW, $newH)
    $graphics = [System.Drawing.Graphics]::FromImage($newImg)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $graphics.DrawImage($img, 0, 0, $newW, $newH)
    $graphics.Dispose()
    $img.Dispose()
    $ms.Dispose()

    $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $Quality)

    $outMs = New-Object System.IO.MemoryStream
    $newImg.Save($outMs, $jpegCodec, $encoderParams)
    $newImg.Dispose()

    $newBytes = $outMs.ToArray()
    $outMs.Dispose()

    if ($newBytes.Length -lt $origSize) {
        [System.IO.File]::WriteAllBytes($Path, $newBytes)
        $saved = [Math]::Round(($origSize - $newBytes.Length) / 1024)
        Write-Host ("Optimized: {0} ({1}KB -> {2}KB, saved {3}KB)" -f (Split-Path $Path -Leaf), [Math]::Round($origSize/1024), [Math]::Round($newBytes.Length/1024), $saved)
    } else {
        Write-Host ("Kept original: {0} (new size was not smaller)" -f (Split-Path $Path -Leaf))
    }
}

# Optimize large landing images
Optimize-ImageFile -Path "public/images/landing/feature-verified.jpg" -MaxWidth 1200 -MaxHeight 800 -Quality 82
Optimize-ImageFile -Path "public/images/brand/hero-auth.jpg" -MaxWidth 1600 -MaxHeight 1000 -Quality 82
Optimize-ImageFile -Path "public/images/landing/hero-wash.jpg" -MaxWidth 1600 -MaxHeight 1000 -Quality 82
Optimize-ImageFile -Path "public/images/landing/service-medication.jpg" -MaxWidth 800 -MaxHeight 600 -Quality 82
Optimize-ImageFile -Path "public/images/landing/service-therapy.jpg" -MaxWidth 800 -MaxHeight 600 -Quality 82
Optimize-ImageFile -Path "public/images/landing/service-elderly.jpg" -MaxWidth 800 -MaxHeight 600 -Quality 82
