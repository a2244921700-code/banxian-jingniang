# Headless self-test / screenshot helper for client/qimen-chart.
# Usage (Windows PowerShell 5.1):
#   powershell -NoProfile -ExecutionPolicy Bypass -File client\qimen-chart\tools\selftest.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File client\qimen-chart\tools\selftest.ps1 -Shot
# Notes: new headless mode is unreliable on this machine; use old --headless +
#        --virtual-time-budget + Start-Process and wait (see docs/APK-REVERSE-ENGINEERING.md).
# This file is intentionally ASCII-only so Windows PowerShell 5.1 can parse it
# without a UTF-8 BOM.

param(
  [string]$Edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
  [int]$Budget = 6000,
  [switch]$Shot,
  [int]$Width = 1440,
  [int]$Height = 1500
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $PSScriptRoot
$tmp = Join-Path $env:TEMP ('qimen-chart-selftest-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

if (-not (Test-Path $Edge)) { throw "Edge not found: $Edge" }

$selftest = 'file:///' + ((Join-Path $here 'selftest.html') -replace '\\', '/')
$domPath = Join-Path $tmp 'dom.html'
$errPath = Join-Path $tmp 'edge.err.log'

Start-Process -FilePath $Edge -ArgumentList @(
  '--headless', '--disable-gpu', '--no-first-run',
  ("--user-data-dir=" + $tmp + '\profile'),
  ("--virtual-time-budget=" + $Budget),
  '--dump-dom', $selftest
) -Wait -NoNewWindow -RedirectStandardOutput $domPath -RedirectStandardError $errPath

$dom = Get-Content -Raw -Encoding UTF8 $domPath
$title = '(no title)'
if ($dom -match '<title>([^<]*)</title>') { $title = $matches[1] }
$results = '(no results)'
if ($dom -match 'id="results"[^>]*>([^<]*)<') { $results = $matches[1] }

$lines = $results -split ' \| '
$fails = @($lines | Where-Object { $_ -like 'FAIL*' })

Write-Output ("SELFTEST TITLE: " + $title)
Write-Output ("SELFTEST ITEMS: " + $lines.Count + " (FAIL " + $fails.Count + ")")
foreach ($line in $lines) { Write-Output ("  " + $line) }

if ($fails.Count -gt 0) {
  Write-Output 'SELFTEST FAILED'
  exit 1
}

if ($Shot) {
  $shotPath = Join-Path $here 'preview.png'
  $index = 'file:///' + ((Join-Path $here 'index.html') -replace '\\', '/')
  Start-Process -FilePath $Edge -ArgumentList @(
    '--headless', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
    ("--user-data-dir=" + $tmp + '\profile-shot'),
    ("--virtual-time-budget=" + $Budget),
    ("--window-size=" + $Width + ',' + $Height),
    ("--screenshot=" + $shotPath), $index
  ) -Wait -NoNewWindow
  if (Test-Path $shotPath) {
    $size = (Get-Item $shotPath).Length
    Write-Output ("PREVIEW: " + $shotPath + " (" + $size + " bytes)")
  } else {
    Write-Output 'PREVIEW FAILED: preview.png not generated'
    exit 1
  }
}

Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
Write-Output 'SELFTEST OK'
