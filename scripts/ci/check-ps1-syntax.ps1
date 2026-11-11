$failed = $false
$files = git ls-files '*.ps1'
foreach ($file in $files) {
  $tokens = $null
  $errors = $null
  [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $file), [ref]$tokens, [ref]$errors) | Out-Null
  if ($errors.Count -gt 0) {
    $failed = $true
    foreach ($e in $errors) { Write-Host "${file}:$($e.Extent.StartLineNumber): $($e.Message)" }
  }
}
if ($failed) { exit 1 }
Write-Host "OK: $($files.Count) scripts .ps1 sin errores de sintaxis."
