# PowerShell script to install the git pre-commit hook on Windows
$HookDir = ".git/hooks"
$HookFile = "$HookDir/pre-commit"

if (-not (Test-Path ".git")) {
    Write-Error "❌ Error: .git directory not found. Please run this script from the repository root."
    Exit
}

Write-Host "Installing git pre-commit hook..."
Copy-Item -Path "scripts/pre-commit" -Destination $HookFile -Force

Write-Host "✅ Git pre-commit hook installed successfully!"
