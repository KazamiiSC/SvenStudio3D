# Creates a relocatable-by-regeneration Windows shortcut beside the launcher.
# The launcher remains a normal .bat; Windows shortcuts support custom icons.
$ErrorActionPreference = 'Stop'
$folder = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$script = Join-Path $folder 'SvenStudio3D.bat'
$icon = Join-Path $folder 'SvenStudio3D.ico'
$shortcut = Join-Path $folder 'SvenStudio3D.lnk'
if (!(Test-Path $script) -or !(Test-Path $icon)) { exit 1 }
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($shortcut)
$link.TargetPath = $script
$link.WorkingDirectory = $folder
$link.IconLocation = "$icon,0"
$link.Description = 'SvenStudio 3D — GoldSrc / Sven Co-op map editor'
$link.Save()
Write-Host "Created $shortcut"
