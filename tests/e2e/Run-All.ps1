#Requires -Version 5.1
<#
.SYNOPSIS
    Run all E2E tests for the WinCC OA MCP server.

.DESCRIPTION
    Discovers and executes all Test-*.ps1 scripts in the same directory.
    Reports a PASS/FAIL summary and exits with code 1 if any test fails.

.PARAMETER ServerUrl
    Base URL of the running MCP server. Defaults to $env:MCP_SERVER_URL or http://localhost:3000.
#>
[CmdletBinding()]
param(
    [string]$ServerUrl = ($env:MCP_SERVER_URL ?? "http://localhost:3000")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  WinCC OA MCP Server — E2E Test Suite"       -ForegroundColor Cyan
Write-Host "  Server URL : $ServerUrl"                     -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Discover all Test-*.ps1 files (excluding this runner)
$testScripts = Get-ChildItem -Path $ScriptDir -Filter "Test-*.ps1" | Sort-Object Name

if ($testScripts.Count -eq 0) {
    Write-Warning "No test scripts found in '$ScriptDir'."
    exit 0
}

Write-Host "Found $($testScripts.Count) test script(s):`n" -ForegroundColor Gray

$passed  = 0
$failed  = 0
$results = [System.Collections.Generic.List[PSCustomObject]]::new()

foreach ($script in $testScripts) {
    Write-Host "Running: $($script.Name)" -ForegroundColor Yellow
    Write-Host ("-" * 50)

    $exitCode = 0
    try {
        & $script.FullName -ServerUrl $ServerUrl
        $exitCode = $LASTEXITCODE
        if ($null -eq $exitCode) { $exitCode = 0 }
    } catch {
        Write-Host "ERROR: $_" -ForegroundColor Red
        $exitCode = 1
    }

    Write-Host ""

    if ($exitCode -eq 0) {
        $passed++
        $results.Add([PSCustomObject]@{ Script = $script.Name; Status = "PASS" })
    } else {
        $failed++
        $results.Add([PSCustomObject]@{ Script = $script.Name; Status = "FAIL" })
    }
}

# Summary
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  RESULTS"                                    -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

foreach ($r in $results) {
    $color = if ($r.Status -eq "PASS") { "Green" } else { "Red" }
    Write-Host "  [$($r.Status)]  $($r.Script)" -ForegroundColor $color
}

Write-Host ""
Write-Host "  Passed : $passed" -ForegroundColor Green
Write-Host "  Failed : $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host "=============================================" -ForegroundColor Cyan

exit $(if ($failed -gt 0) { 1 } else { 0 })
