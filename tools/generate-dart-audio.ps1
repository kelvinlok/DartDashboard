$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$rendererPath = Join-Path $repositoryRoot "tools\render-dart-audio.py"
$outputDirectory = Join-Path $repositoryRoot "assets\audio"
$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd("\")
$tempVoiceDirectory = Join-Path $tempRoot ("dart-audio-voices-" + [guid]::NewGuid().ToString("N"))
$synthesizer = $null
$renderSucceeded = $false

try {
    $python = Get-Command python -CommandType Application -ErrorAction Stop | Select-Object -First 1
    if (-not (Test-Path -LiteralPath $rendererPath)) {
        throw "Python renderer not found: $rendererPath"
    }

    try {
        Add-Type -AssemblyName System.Speech -ErrorAction Stop
    }
    catch {
        throw "System.Speech is unavailable. Run this generator in Windows PowerShell with speech components installed."
    }

    $synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $voices = @(
        $synthesizer.GetInstalledVoices() |
            Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq "en" } |
            ForEach-Object { $_.VoiceInfo }
    )
    if ($voices.Count -eq 0) {
        throw "No enabled English System.Speech voice is installed."
    }

    $selectedVoice = $voices | Where-Object { $_.Name -like "*Microsoft Mark*" } | Select-Object -First 1
    if (-not $selectedVoice) {
        $selectedVoice = $voices | Where-Object { $_.Name -like "*Microsoft David*" } | Select-Object -First 1
    }
    if (-not $selectedVoice) {
        $selectedVoice = $voices | Select-Object -First 1
    }

    New-Item -ItemType Directory -Path $tempVoiceDirectory -Force | Out-Null
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    $synthesizer.SelectVoice($selectedVoice.Name)
    $synthesizer.Volume = 100
    $synthesizer.Rate = 3

    $voiceLines = @{
        "bullseye" = "Bullseye!"
        "bust" = "Bust!"
        "checkout" = "Game shot!"
    }
    $voicePaths = @{}
    foreach ($name in $voiceLines.Keys) {
        $voicePath = Join-Path $tempVoiceDirectory ($name + ".wav")
        $synthesizer.SetOutputToWaveFile($voicePath)
        $synthesizer.Speak($voiceLines[$name])
        $synthesizer.SetOutputToNull()
        $voicePaths[$name] = $voicePath
    }

    Write-Host "Rendering with voice: $($selectedVoice.Name)"
    & $python.Source $rendererPath `
        --bullseye-voice $voicePaths["bullseye"] `
        --bust-voice $voicePaths["bust"] `
        --checkout-voice $voicePaths["checkout"] `
        --output-dir $outputDirectory
    if ($LASTEXITCODE -ne 0) {
        throw "Python audio renderer exited with code $LASTEXITCODE."
    }
    $renderSucceeded = $true
}
catch {
    Write-Error "Dart audio generation failed: $($_.Exception.Message)"
    exit 1
}
finally {
    if ($synthesizer) {
        $synthesizer.Dispose()
    }
    if ($renderSucceeded -and (Test-Path -LiteralPath $tempVoiceDirectory)) {
        $resolvedTemp = [System.IO.Path]::GetFullPath($tempVoiceDirectory)
        $validParent = (Split-Path -Parent $resolvedTemp).TrimEnd("\") -eq $tempRoot
        $validName = (Split-Path -Leaf $resolvedTemp) -like "dart-audio-voices-*"
        if (-not ($validParent -and $validName)) {
            throw "Refusing to remove unexpected temporary path: $resolvedTemp"
        }
        Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
    }
}
