# Installs the KnowFlow git pre-commit hooks (run on staged files).
#   - secrets scan  (scripts/secrets_scan.py)  : blocks committed credentials
#   - dash scan     (scripts/dashes_scan.py)   : blocks em/en dashes in user-facing UI copy
# Run once per clone:  powershell -ExecutionPolicy Bypass -File scripts\install_hooks.ps1
$repoRoot = Split-Path -Parent $PSScriptRoot
$hookPath = Join-Path $repoRoot ".git\hooks\pre-commit"
$hook = @'
#!/bin/sh
python scripts/secrets_scan.py --staged || {
  echo ""
  echo "Commit blocked: potential secret in staged files. Move it to .env.local / env store."
  exit 1
}
python scripts/dashes_scan.py --staged || {
  echo ""
  echo "Commit blocked: em/en dash in user-facing text. Replace with a comma, period, or ASCII '-'."
  exit 1
}
'@
Set-Content -Path $hookPath -Value $hook -Encoding ascii -NoNewline
Write-Host "pre-commit hook installed at $hookPath (secrets + dashes)"
