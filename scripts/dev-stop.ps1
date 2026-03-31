param(
  [int]$Port = 5174
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeDir = Join-Path $root ".runtime"
$pidPath = Join-Path $runtimeDir "vite.pid"

function Get-PortPid([int]$LocalPort) {
  $match = netstat -ano | Select-String "127\.0\.0\.1:$LocalPort\s+.*LISTENING\s+(\d+)$" | Select-Object -First 1
  if (-not $match) {
    return $null
  }

  $parts = ($match.ToString() -split "\s+") | Where-Object { $_ }
  return [int]$parts[-1]
}

$stopped = @()

if (Test-Path $pidPath) {
  $pidFromFile = [int](Get-Content $pidPath | Select-Object -First 1)
  if ($null -ne (Get-Process -Id $pidFromFile -ErrorAction SilentlyContinue)) {
    Stop-Process -Id $pidFromFile -Force
    $stopped += $pidFromFile
    Write-Output "Stopped PID $pidFromFile from $pidPath"
  }

  Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
}

$portPid = Get-PortPid $Port
if ($portPid -and ($stopped -notcontains $portPid)) {
  Stop-Process -Id $portPid -Force
  $stopped += $portPid
  Write-Output "Stopped PID $portPid listening on port $Port"
}

if ($stopped.Count -eq 0) {
  Write-Output "No dev server process found on port $Port"
}
