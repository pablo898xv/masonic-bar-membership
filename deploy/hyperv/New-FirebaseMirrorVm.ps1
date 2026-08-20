#Requires -RunAsAdministrator
#Requires -Modules Hyper-V
<#
.SYNOPSIS
    Create a small Ubuntu Hyper-V VM for a local Firebase Hosting mirror.

.DESCRIPTION
    Builds a Generation 2 Linux VM on the Hyper-V Default Switch (NAT, no extra
    networking cost). After Ubuntu is installed, clone this repo in the guest
    and run: bash deploy/hyperv/bootstrap.sh

    Sizing is kept modest on purpose: 2 vCPU, 4 GB startup / 6 GB max dynamic
    memory, 40 GB disk. The Firestore emulator is Java; do not go below 4 GB.

.PARAMETER VmName
    Hyper-V VM name.

.PARAMETER IsoPath
    Ubuntu Server 24.04 live ISO. Downloaded if the file does not exist.

.PARAMETER VhdPath
    Destination VHDX path.

.PARAMETER MemoryStartupBytes
    Startup RAM. Default 4 GB.

.PARAMETER ProcessorCount
    vCPU count. Default 2.

.EXAMPLE
    .\New-FirebaseMirrorVm.ps1

.EXAMPLE
    .\New-FirebaseMirrorVm.ps1 -IsoPath D:\ISO\ubuntu-24.04.3-live-server-amd64.iso
#>
[CmdletBinding()]
param(
    [string]$VmName = 'masonic-firebase-mirror',
    [string]$IsoPath = (Join-Path $env:USERPROFILE 'Downloads\ubuntu-24.04.3-live-server-amd64.iso'),
    [string]$VhdPath = (Join-Path (Get-VMHost).VirtualHardDiskPath 'masonic-firebase-mirror.vhdx'),
    [int64]$MemoryStartupBytes = 4GB,
    [int]$ProcessorCount = 2
)

$ErrorActionPreference = 'Stop'

$ubuntuIsoUri = 'https://releases.ubuntu.com/24.04/ubuntu-24.04.3-live-server-amd64.iso'
$switchName = 'Default Switch'

if (-not (Get-VMSwitch -Name $switchName -ErrorAction SilentlyContinue)) {
    throw "Hyper-V switch '$switchName' was not found. It is created when Hyper-V is enabled."
}

if (Get-VM -Name $VmName -ErrorAction SilentlyContinue) {
    throw "A VM named '$VmName' already exists. Remove it first or pass -VmName."
}

if (-not (Test-Path -LiteralPath $IsoPath)) {
    $isoDir = Split-Path -Parent $IsoPath
    if (-not (Test-Path -LiteralPath $isoDir)) {
        New-Item -ItemType Directory -Path $isoDir | Out-Null
    }
    Write-Host "Downloading Ubuntu Server 24.04 ISO to $IsoPath"
    Write-Host 'This is a one-time download (~3 GB).'
    Invoke-WebRequest -Uri $ubuntuIsoUri -OutFile $IsoPath
}

Write-Host "Creating VHDX $VhdPath (40 GB, dynamically expanding)"
New-VHD -Path $VhdPath -SizeBytes 40GB -Dynamic | Out-Null

Write-Host "Creating VM $VmName"
New-VM -Name $VmName -Generation 2 -MemoryStartupBytes $MemoryStartupBytes -VHDPath $VhdPath -SwitchName $switchName | Out-Null

Set-VM -Name $VmName -AutomaticCheckpointsEnabled $false -CheckpointType Disabled
Set-VMProcessor -VMName $VmName -Count $ProcessorCount
Set-VMMemory -VMName $VmName -DynamicMemoryEnabled $true -MinimumBytes 2GB -StartupBytes $MemoryStartupBytes -MaximumBytes 6GB
Set-VMFirmware -VMName $VmName -EnableSecureBoot On -SecureBootTemplate 'MicrosoftUEFICertificateAuthority'
Add-VMDvdDrive -VMName $VmName -Path $IsoPath

$dvd = Get-VMDvdDrive -VMName $VmName
Set-VMFirmware -VMName $VmName -FirstBootDevice $dvd

Write-Host
Write-Host 'VM created. Next steps:'
Write-Host "  1. vmconnect localhost '$VmName'   (or Hyper-V Manager > Connect)"
Write-Host '  2. Start the VM and install Ubuntu Server (minimal, OpenSSH enabled).'
Write-Host '  3. Inside the guest:'
Write-Host '       sudo apt-get update && sudo apt-get install -y git'
Write-Host '       git clone <this-repo-url> && cd masonic-bar-membership'
Write-Host '       bash deploy/hyperv/bootstrap.sh'
Write-Host '  4. From Windows, open http://<guest-ip>:3000  (ip addr in the guest).'
Write-Host
Write-Host "Start-VM -Name '$VmName'"
