# LIFE_OS reminders — Windows toasts that fire EVEN WHEN THE BROWSER IS CLOSED.
#
# How it works: the calendar app pushes every change to state.json via the
# local server (server.py). This script reads that file and pops a Windows
# notification for any task due today whose reminder time has passed.
#
# Usage (run from this folder, or via Launch-Calendar.bat):
#   reminders.ps1 -Check                  single pass (default, no switches = -Check)
#   reminders.ps1 -Check -DryRun          print what WOULD fire, change nothing
#   reminders.ps1 -Loop                   stay running, check every 60s (Ctrl+C to stop)
#   reminders.ps1 -Install                register Task Scheduler job (every 5 min, even with tab closed)
#   reminders.ps1 -Uninstall              remove the scheduled job
#
# Notes: PC must be ON and you must be LOGGED IN for toasts to appear.
# No admin needed. No cloud. Everything stays in this folder.
param(
  [switch]$Check,
  [switch]$Loop,
  [switch]$Install,
  [switch]$Uninstall,
  [switch]$DryRun,
  [int]$IntervalSec = 60,
  [int]$TaskIntervalMin = 5
)

$ErrorActionPreference = "Stop"
$AppDir     = $PSScriptRoot
$StateFile  = Join-Path $AppDir "state.json"
$FiredFile  = Join-Path $AppDir "fired.json"
$LogFile    = Join-Path $AppDir "reminders.log"
$TaskName   = "LifeOS-Reminders"

function Log($msg) {
  $line = "{0:yyyy-MM-dd HH:mm:ss} {1}" -f (Get-Date), $msg
  $line | Out-File -FilePath $LogFile -Append -Encoding utf8
  Write-Host $line
}

function Read-Json($path) {
  if (!(Test-Path $path)) { return $null }
  try { return (Get-Content $path -Raw -Encoding utf8 | ConvertFrom-Json) }
  catch { Log ("WARN: could not parse " + $path); return $null }
}

function To-Hashtable($obj) {
  # PSCustomObject (PS 5.1) -> hashtable so we can index + add keys.
  $h = @{}
  if ($null -eq $obj) { return $h }
  foreach ($p in $obj.PSObject.Properties) { $h[$p.Name] = $p.Value }
  return $h
}

function Task-ActiveToday($t, $today) {
  $type = $t.type
  if ($type -eq "once") { return $t.date -eq $today }
  if ($type -eq "range") {
    return $t.startDate -and $t.endDate -and $today -ge $t.startDate -and $today -le $t.endDate
  }
  if ($type -eq "daily") {
    if ($t.startDate -and $today -lt $t.startDate) { return $false }
    if ($t.endDate -and $today -gt $t.endDate) { return $false }
    return $true
  }
  return $false
}

function Ensure-ToastModule {
  # Returns $true if BurntToast can be used. Installs it per-user on first run.
  if (Get-Module -ListAvailable -Name BurntToast) { return $true }
  try {
    if ((Get-PSRepository -Name PSGallery -ErrorAction SilentlyContinue).InstallationPolicy -ne "Trusted") {
      Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue
    }
    try { Install-PackageProvider -Name NuGet -Force -Scope CurrentUser -ErrorAction SilentlyContinue | Out-Null } catch {}
    Install-Module BurntToast -Scope CurrentUser -Force -AllowClobber -ErrorAction Stop | Out-Null
    return $true
  } catch {
    Log ("WARN: BurntToast install failed, will use tray balloon/log fallback. " + $_.Exception.Message)
    return $false
  }
}

function Show-Toast($title, $body, $useBurnt) {
  if ($useBurnt) {
    try {
      New-BurntToastNotification -Text $title, $body -ErrorAction Stop
      return
    } catch { Log ("WARN: BurntToast failed: " + $_.Exception.Message) }
  }
  # Fallback: tray balloon (works when interactive) + always log.
  try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    $icon = New-Object System.Windows.Forms.NotifyIcon
    $icon.Icon = [System.Drawing.SystemIcons]::Information
    $icon.Visible = $true
    $icon.ShowBalloonTip(10000, $title, $body, [System.Windows.Forms.ToolTipIcon]::Warning)
    Start-Sleep -Milliseconds 12000
    $icon.Visible = $false
    $icon.Dispose()
  } catch { Log ("WARN: tray balloon failed: " + $_.Exception.Message) }
}

function Invoke-Check($useBurnt) {
  $state = Read-Json $StateFile
  $tasks = $null
  if ($state) { $tasks = $state.tasks }
  if ($null -eq $tasks) { Log "state.json has no tasks yet (open the calendar once via Launch-Calendar)."; return 0 }
  $fired = To-Hashtable (Read-Json $FiredFile)
  $today = (Get-Date).ToString("yyyy-MM-dd")
  $hm    = (Get-Date).ToString("HH:mm")
  $n = 0
  foreach ($t in $tasks) {
    $rt = $t.remindTime
    if (-not $rt) { continue }
    if (-not (Task-ActiveToday $t $today)) { continue }
    $done = $false
    if ($t.completions) { $done = [bool]$t.completions.$today }
    if ($done) { continue }
    if ($rt -gt $hm) { continue }  # not yet time
    $key = "{0}@{1}" -f $t.id, $today
    if ($fired[$key]) { continue }  # already reminded today
    $title = "[LIFE_OS] " + $t.title
    $body  = "{0} - {1} @{2}. Open the calendar to cross it off." -f $t.type, $today, $rt
    if ($DryRun) {
      Write-Host ("WOULD FIRE: {0} | {1}" -f $title, $body)
    } else {
      Show-Toast $title $body $useBurnt
      Log ("FIRED: " + $title)
    }
    $fired[$key] = (Get-Date).ToString("o")
    $n++
  }
  # todos with a reminder datetime ("YYYY-MM-DDTHH:MM", local wall time)
  $now = (Get-Date).ToString("yyyy-MM-ddTHH:mm")
  $todos = $null
  if ($state) { $todos = $state.todos }
  foreach ($td in @($todos)) {
    if (-not $td) { continue }
    if ($td.done -or -not $td.remindAt) { continue }
    if ($td.remindAt -gt $now) { continue }  # not yet time
    $key = "todo@{0}" -f $td.id
    if ($fired[$key]) { continue }  # one-shot
    $title = "[LIFE_OS] " + $td.title
    $body  = "TODO due {0}. Cross it off in the inbox." -f $td.remindAt
    if ($DryRun) {
      Write-Host ("WOULD FIRE: {0} | {1}" -f $title, $body)
    } else {
      Show-Toast $title $body $useBurnt
      Log ("FIRED: " + $title)
    }
    $fired[$key] = (Get-Date).ToString("o")
    $n++
  }
  if (-not $DryRun -and $n -gt 0) {
    ($fired | ConvertTo-Json -Depth 10) | Out-File -FilePath $FiredFile -Encoding utf8
  }
  if ($n -eq 0) { Write-Host "ok: no reminders due (today=$today now=$hm)." }
  return $n
}

# ---------- modes ----------
if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "removed scheduled task '$TaskName' (if it existed)."
  return
}

if ($Install) {
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument (
    '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' +
    (Join-Path $AppDir "reminders.ps1") + '" -Check')
  $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes $TaskIntervalMin) `
    -RepetitionDuration (New-TimeSpan -Days 3650)
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries -StartWhenAvailable
  $settings.ExecutionTimeLimit = "PT5M"
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Settings $settings -Description "LIFE_OS calendar reminders (local only)" -Force | Out-Null
  Write-Host "installed: scheduled task '$TaskName' runs every $TaskIntervalMin min while you are logged in."
  Write-Host "Test it now:  powershell -File reminders.ps1 -Check -DryRun"
  return
}

if ($Loop) {
  $useBurnt = Ensure-ToastModule
  Write-Host "reminder loop running every $IntervalSec sec. Ctrl+C to stop."
  while ($true) { Invoke-Check $useBurnt | Out-Null; Start-Sleep -Seconds $IntervalSec }
  return
}

# default: single -Check pass
$useBurnt = $true
if (-not $DryRun) { $useBurnt = Ensure-ToastModule }
Invoke-Check $useBurnt | Out-Null
