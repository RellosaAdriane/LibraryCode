# Auto-setup script: installs Node (LTS) and PHP by attempting multiple installers
# Run as administrator. The script will try to elevate itself.

function Ensure-Admin {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Host "Restarting script as administrator..."
        Start-Process -FilePath pwsh -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File \"$PSCommandPath\"" -Verb RunAs
        Exit
    }
}

function Run-Command {
    param($cmd, $args)
    try {
        $proc = Start-Process -FilePath $cmd -ArgumentList $args -Wait -PassThru -NoNewWindow -ErrorAction Stop
        return $proc.ExitCode
    } catch {
        Write-Host "Command failed: $cmd $args" -ForegroundColor Yellow
        return 1
    }
}

function Download-File {
    param($url, $out)
    Write-Host "Downloading $url -> $out"
    try {
        $wc = New-Object System.Net.WebClient
        $wc.DownloadFile($url, $out)
        return $true
    } catch {
        Write-Host "Download failed: $url" -ForegroundColor Yellow
        return $false
    }
}

Ensure-Admin

Write-Host "Checking for package managers..."
$haveWinget = Get-Command winget -ErrorAction SilentlyContinue
$haveChoco = Get-Command choco -ErrorAction SilentlyContinue

if ($haveWinget) {
    Write-Host "Using winget to install packages..."
    $pkgs = @(
        @{ id='OpenJS.NodeJS.LTS'; name='Node.js LTS' },
        @{ id='PHP.PHP.8.1'; name='PHP 8.1' }
    )
    foreach ($p in $pkgs) {
        Write-Host "Installing $($p.name) via winget..."
        Start-Process -FilePath winget -ArgumentList 'install','--id',$p.id,'-e','--accept-package-agreements','--accept-source-agreements' -Wait
    }
} elseif ($haveChoco) {
    Write-Host "Using Chocolatey to install packages..."
    $chocoPkgs = @('nodejs-lts','php')
    foreach ($c in $chocoPkgs) {
        Run-Command 'choco' "install $c -y"
    }
} else {
    Write-Host "No winget/choco found — falling back to direct downloads. Installers may require user interaction." -ForegroundColor Yellow

    $tmp = Join-Path $env:TEMP "auto-setup"
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null

    # Node.js LTS (x64) - attempt a recent LTS URL; update if needed
    $nodeUrl = 'https://nodejs.org/dist/latest-v18.x/node-v18.20.1-x64.msi'
    $nodePath = Join-Path $tmp 'node-lts.msi'
    if (Download-File $nodeUrl $nodePath) {
        Write-Host "Running Node MSI (silent)..."
        Run-Command 'msiexec.exe' "/i `"$nodePath`" /qn /norestart"
    }

    # PHP (zip distribution)
    $phpZipUrl = 'https://windows.php.net/downloads/releases/archives/php-8.1.23-Win32-vs16-x64.zip'
    $phpZip = Join-Path $tmp 'php81.zip'
    $phpInstallDir = "C:\php81"
    if (Download-File $phpZipUrl $phpZip) {
        Write-Host "Extracting PHP to $phpInstallDir"
        New-Item -ItemType Directory -Path $phpInstallDir -Force | Out-Null
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::ExtractToDirectory($phpZip, $phpInstallDir)
        Write-Host "Adding PHP to PATH temporarily"
        $env:Path = "$phpInstallDir;" + $env:Path
    }
}

Write-Host "Checking installed versions..."
Run-Command 'node' '-v'
Run-Command 'npm' '-v'
Run-Command 'php' '-v'

Write-Host "To start the app, run npm install and npm start in the project root, then start the PHP backend with: php -S localhost:8000 -t server" -ForegroundColor Green

Write-Host "Auto-setup script finished."
