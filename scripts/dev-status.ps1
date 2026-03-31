param(
  [int]$Port = 5174,
  [string]$BindHost = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeDir = Join-Path $root ".runtime"
$pidPath = Join-Path $runtimeDir "vite.pid"
$outPath = Join-Path $runtimeDir "vite.out.log"
$errPath = Join-Path $runtimeDir "vite.err.log"

function Get-PortPid([int]$LocalPort) {
  $hostPattern = [regex]::Escape($BindHost)
  $match = netstat -ano | Select-String "$hostPattern`:$LocalPort\s+.*LISTENING\s+(\d+)$" | Select-Object -First 1
  if (-not $match) {
    return $null
  }

  $parts = ($match.ToString() -split "\s+") | Where-Object { $_ }
  return [int]$parts[-1]
}

$pidFromFile = if (Test-Path $pidPath) { [int](Get-Content $pidPath | Select-Object -First 1) } else { $null }
$portPid = Get-PortPid $Port

if ($portPid) {
  Write-Output "Running on http://${BindHost}:$Port/ (PID $portPid)"
} else {
  Write-Output "Not running on http://${BindHost}:$Port/"
}

if ($pidFromFile) {
  Write-Output "PID file: $pidPath -> $pidFromFile"
} else {
  Write-Output "PID file: missing"
}

if (Test-Path $outPath) {
  Write-Output "Last output:"
  Get-Content $outPath -Tail 10
}

if (Test-Path $errPath) {
  $errText = Get-Content $errPath -Raw
  if ($null -ne $errText -and $errText.Trim()) {
    Write-Output "Last error output:"
    Get-Content $errPath -Tail 10
  }
}
