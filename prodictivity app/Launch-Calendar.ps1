# LIFE_OS one-click launcher (Windows).
# Double-click Launch-Calendar.bat (or run this script): it starts the local
# server if needed, makes sure closed-tab reminders are scheduled, and opens
# the calendar in your default browser.
param(
  [switch]$SkipReminders,   # do not install/check the reminder task
  [switch]$NoBrowser        # do not open the browser
)

$ErrorActionPreference = "Continue"
$AppDir = $PSScriptRoot
$Port   = 8765
$Url    = "http://127.0.0.1:$Port"

function Port-Open($port) {
  try {
    $c = New-Object Net.Sockets.TcpClient
    $r = $c.BeginConnect("127.0.0.1", $port, $null, $null)
    $ok = $r.AsyncWaitHandle.WaitOne(800)
    $c.Close()
    return $ok
  } catch { return $false }
}

# 1. server
if (Port-Open $Port) {
  Write-Host "[1/3] server already running on $Port - reusing it."
} else {
  $py = $null
  foreach ($cmd in @("py", "python", "python3")) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) { $py = $cmd; break }
  }
  if (-not $py) { Write-Host "ERROR: no Python found. Install Python 3 (any version) and retry."; return }
  Write-Host ("[1/3] starting server with '{0}' ..." -f $py)
  if ($py -eq "py") { Start-Process -FilePath $py -ArgumentList "-3", "`"$AppDir\server.py`"" -WindowStyle Hidden -WorkingDirectory $AppDir }
  else { Start-Process -FilePath $py -ArgumentList "`"$AppDir\server.py`"" -WindowStyle Hidden -WorkingDirectory $AppDir }
  $tries = 0
  while (-not (Port-Open $Port) -and $tries -lt 20) { Start-Sleep -Milliseconds 500; $tries++ }
  if (Port-Open $Port) { Write-Host "[1/3] server up at $Url" }
  else { Write-Host "ERROR: server did not start. Run manually to see the error:  $py `"$AppDir\server.py`""; return }
}

# 2. reminders (closed-tab toasts)
if ($SkipReminders) {
  Write-Host "[2/3] reminders skipped (-SkipReminders)."
} else {
  $exists = Get-ScheduledTask -TaskName "LifeOS-Reminders" -ErrorAction SilentlyContinue
  if ($exists) { Write-Host "[2/3] reminders scheduled (LifeOS-Reminders) - fires even with tab closed." }
  else {
    Write-Host "[2/3] installing reminder schedule ..."
    try { & powershell -NoProfile -ExecutionPolicy Bypass -File "$AppDir\reminders.ps1" -Install }
    catch { Write-Host ("WARN: could not install reminders: " + $_.Exception.Message) }
  }
}

# 3. browser
if ($NoBrowser) { Write-Host "[3/3] browser skipped. Open $Url yourself." }
else { Write-Host "[3/3] opening $Url ..."; Start-Process $Url }

Write-Host ""
Write-Host "LIFE_OS running. Keep this window or close it - the server stays up."
