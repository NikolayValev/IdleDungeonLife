param(
  [int]$Port = 5174,
  [string]$BindHost = "127.0.0.1",
  [switch]$ForceRestart
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeDir = Join-Path $root ".runtime"
$pidPath = Join-Path $runtimeDir "vite.pid"
$outPath = Join-Path $runtimeDir "vite.out.log"
$errPath = Join-Path $runtimeDir "vite.err.log"

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

function Get-PortPid([int]$LocalPort) {
  $hostPattern = [regex]::Escape($BindHost)
  $match = netstat -ano | Select-String "$hostPattern`:$LocalPort\s+.*LISTENING\s+(\d+)$" | Select-Object -First 1
  if (-not $match) {
    return $null
  }

  $parts = ($match.ToString() -split "\s+") | Where-Object { $_ }
  return [int]$parts[-1]
}

function Test-Pid([int]$ProcessId) {
  return $null -ne (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

if (Test-Path $pidPath) {
  $existingPid = [int](Get-Content $pidPath | Select-Object -First 1)
  if (Test-Pid $existingPid) {
    if (-not $ForceRestart) {
      Write-Output "Already running on http://${BindHost}:$Port/ (PID $existingPid)"
      Write-Output "Logs: $outPath"
      exit 0
    }

    Stop-Process -Id $existingPid -Force
    Start-Sleep -Milliseconds 500
  }

  Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
}

$portPid = Get-PortPid $Port
if ($portPid) {
  if (-not $ForceRestart) {
    throw "Port $Port is already in use by PID $portPid. Run dev-stop first or rerun dev-start with -ForceRestart."
  }

  Stop-Process -Id $portPid -Force
  Start-Sleep -Milliseconds 500
}

Remove-Item $outPath, $errPath -Force -ErrorAction SilentlyContinue

$npmCmd = Get-Command npm.cmd -CommandType Application | Select-Object -First 1 -ExpandProperty Source
$proc = Start-Process `
  -FilePath $npmCmd `
  -ArgumentList @("run", "dev", "--", "--host", $BindHost, "--port", "$Port", "--strictPort") `
  -WorkingDirectory $root `
  -PassThru `
  -WindowStyle Hidden `
  -RedirectStandardOutput $outPath `
  -RedirectStandardError $errPath

Set-Content -Path $pidPath -Value $proc.Id

Start-Sleep -Seconds 3

$runningPid = Get-PortPid $Port
if (-not $runningPid) {
  $stderr = if (Test-Path $errPath) { (Get-Content $errPath -Raw).Trim() } else { "" }
  throw "Vite did not start on port $Port. $stderr"
}

Set-Content -Path $pidPath -Value $runningPid

if (Test-Pid $proc.Id -and $proc.Id -ne $runningPid) {
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

Write-Output "Started http://${BindHost}:$Port/ (PID $runningPid)"
Write-Output "PID file: $pidPath"
Write-Output "Logs: $outPath"
if (Test-Path $outPath) {
  Get-Content $outPath -Tail 20
}
if (Test-Path $errPath) {
  Get-Content $errPath -Tail 20
}
