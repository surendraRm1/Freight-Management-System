# Manual Desktop App Packaging Script
# This script creates a portable desktop application without using electron-builder

$ErrorActionPreference = "Stop"

Write-Host "Starting manual packaging..." -ForegroundColor Green

# Define paths
$projectRoot = Split-Path -Parent $PSScriptRoot
$desktopDir = $PSScriptRoot
$outputDir = Join-Path $desktopDir "dist-manual\Freight-Management-Desktop"
$backendSrc = Join-Path $projectRoot "backend"
$frontendDist = Join-Path $projectRoot "frontend\dist"

# Clean output directory
if (Test-Path $outputDir) {
    Write-Host "Cleaning existing output directory..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $outputDir
}

# Create output structure
Write-Host "Creating output directory structure..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
New-Item -ItemType Directory -Force -Path "$outputDir\resources" | Out-Null

# Step 1: Install electron locally if not present
Write-Host "Checking Electron installation..." -ForegroundColor Cyan
Push-Location $desktopDir
if (-not (Test-Path "node_modules\electron")) {
    Write-Host "Installing Electron..." -ForegroundColor Yellow
    npm install
}
Pop-Location

# Step 2: Copy Electron binaries
Write-Host "Copying Electron binaries..." -ForegroundColor Cyan
$electronPath = Join-Path $desktopDir "node_modules\electron\dist"
if (Test-Path $electronPath) {
    Copy-Item -Path "$electronPath\*" -Destination $outputDir -Recurse -Force
    # Rename electron.exe to app name
    if (Test-Path "$outputDir\electron.exe") {
        Rename-Item -Path "$outputDir\electron.exe" -NewName "Freight-Management-Desktop.exe" -Force
    }
} else {
    Write-Error "Electron binaries not found at $electronPath"
    exit 1
}

# Step 3: Copy desktop app files (main.js, preload.js, package.json)
Write-Host "Copying desktop app files..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "$outputDir\resources\app" | Out-Null
Copy-Item -Path "$desktopDir\main.js" -Destination "$outputDir\resources\app\" -Force
Copy-Item -Path "$desktopDir\preload.js" -Destination "$outputDir\resources\app\" -Force
Copy-Item -Path "$desktopDir\package.json" -Destination "$outputDir\resources\app\" -Force

# Step 4: Desktop dependencies (currently none at runtime)
Write-Host "Skipping desktop node_modules copy (no runtime dependencies)." -ForegroundColor Cyan
if (Test-Path "$outputDir\resources\app\node_modules") {
    Remove-Item -Recurse -Force "$outputDir\resources\app\node_modules"
}

# Step 5: Copy backend (excluding node_modules - will install fresh)
Write-Host "Copying backend..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "$outputDir\resources\backend" | Out-Null

# Copy backend files excluding node_modules
Get-ChildItem -Path $backendSrc -Exclude "node_modules" | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination "$outputDir\resources\backend\" -Recurse -Force -ErrorAction SilentlyContinue
}

# Install backend dependencies in the packaged location
Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
Push-Location "$outputDir\resources\backend"
npm install --production
Pop-Location

# Step 6: Copy frontend
Write-Host "Copying frontend..." -ForegroundColor Cyan
if (Test-Path $frontendDist) {
    Copy-Item -Path $frontendDist -Destination "$outputDir\resources\frontend" -Recurse -Force
} else {
    Write-Error "Frontend dist not found. Run 'npm run build' in frontend directory first."
    exit 1
}

# Step 7: Generate Prisma client for SQLite
Write-Host "Generating Prisma client for SQLite..." -ForegroundColor Cyan
Push-Location $backendSrc
npx prisma generate --schema prisma/schema.sqlite.prisma
Pop-Location

Write-Host "`nPackaging complete!" -ForegroundColor Green
Write-Host "Output location: $outputDir" -ForegroundColor Green
Write-Host "`nTo run the app, execute: $outputDir\Freight-Management-Desktop.exe" -ForegroundColor Yellow
