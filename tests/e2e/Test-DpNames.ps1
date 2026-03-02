#Requires -Version 5.1
<#
.SYNOPSIS
    E2E test for winccoa_dp_names tool: verifies pagination response shape.

.DESCRIPTION
    Calls winccoa_dp_names with a default pattern and checks the shape of the response.
    Does NOT validate specific DP names — those depend on the running WinCC OA project.

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
$invokeTool = Join-Path $ScriptDir "Invoke-McpTool.ps1"

function Assert-Field {
    param($Object, [string]$Field, [string]$Context = "")
    if ($null -eq $Object.$Field) {
        throw "FAIL $Context`: Expected field '$Field' to be present in response"
    }
}

Write-Host "=== Test-DpNames ===" -ForegroundColor Cyan

$failures = 0

# ---- Test 1: Basic call returns pagination shape ----
try {
    Write-Host "Test 1: Basic call returns pagination shape..." -NoNewline
    $result = & $invokeTool -ServerUrl $ServerUrl -ToolName "winccoa_dp_names" `
        -Arguments @{ dpPattern = "*"; limit = 10; offset = 0 }

    $content = $result.content[0].text | ConvertFrom-Json

    Assert-Field $content "pattern"  "Test1"
    Assert-Field $content "total"    "Test1"
    Assert-Field $content "offset"   "Test1"
    Assert-Field $content "limit"    "Test1"
    Assert-Field $content "count"    "Test1"
    Assert-Field $content "dpNames"  "Test1"

    if ($content.limit -ne 10) { throw "FAIL Test1: Expected limit=10, got $($content.limit)" }
    if ($content.offset -ne 0)  { throw "FAIL Test1: Expected offset=0, got $($content.offset)" }
    if ($content.dpNames.Count -gt 10) { throw "FAIL Test1: dpNames.Count exceeded limit" }

    Write-Host " PASS" -ForegroundColor Green
} catch {
    Write-Host " FAIL: $_" -ForegroundColor Red
    $failures++
}

# ---- Test 2: Offset advances the page ----
try {
    Write-Host "Test 2: Offset parameter advances the page..." -NoNewline

    $page1 = (& $invokeTool -ServerUrl $ServerUrl -ToolName "winccoa_dp_names" `
        -Arguments @{ dpPattern = "*"; limit = 3; offset = 0 }).content[0].text | ConvertFrom-Json

    $page2 = (& $invokeTool -ServerUrl $ServerUrl -ToolName "winccoa_dp_names" `
        -Arguments @{ dpPattern = "*"; limit = 3; offset = 3 }).content[0].text | ConvertFrom-Json

    if ($page1.total -ne $page2.total) {
        throw "FAIL Test2: total mismatch across pages ($($page1.total) vs $($page2.total))"
    }

    if ($page1.dpNames.Count -gt 0 -and $page2.dpNames.Count -gt 0) {
        $overlap = $page1.dpNames | Where-Object { $page2.dpNames -contains $_ }
        if ($overlap.Count -gt 0) {
            throw "FAIL Test2: pages overlap — same DP appeared on both pages: $($overlap -join ', ')"
        }
    }

    Write-Host " PASS" -ForegroundColor Green
} catch {
    Write-Host " FAIL: $_" -ForegroundColor Red
    $failures++
}

# ---- Test 3: includeTypeName enrichment (only valid for ≤50 results) ----
try {
    Write-Host "Test 3: includeTypeName enrichment..." -NoNewline

    $result = (& $invokeTool -ServerUrl $ServerUrl -ToolName "winccoa_dp_names" `
        -Arguments @{ dpPattern = "*"; limit = 5; offset = 0; includeTypeName = $true }).content[0].text | ConvertFrom-Json

    if ($result.count -le 50) {
        # Enrichment should have run
        if ($null -eq $result.typeNames) {
            throw "FAIL Test3: Expected typeNames in response when count ≤ 50"
        }
    } else {
        if ($null -eq $result.enrichmentSkipped) {
            throw "FAIL Test3: Expected enrichmentSkipped when count > 50"
        }
    }

    Write-Host " PASS" -ForegroundColor Green
} catch {
    Write-Host " FAIL: $_" -ForegroundColor Red
    $failures++
}

# Summary
Write-Host ""
if ($failures -gt 0) {
    Write-Host "Test-DpNames: $failures test(s) failed." -ForegroundColor Red
    exit 1
} else {
    Write-Host "Test-DpNames: All tests passed." -ForegroundColor Green
    exit 0
}
