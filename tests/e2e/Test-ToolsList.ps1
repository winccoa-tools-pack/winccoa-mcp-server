#Requires -Version 5.1
<#
.SYNOPSIS
    Verifies that the MCP server exposes all expected tools.

.DESCRIPTION
    Calls the tools/list MCP endpoint and checks that every expected tool name
    is present in the response. Fails with a non-zero exit code if any tool is missing.

.PARAMETER ServerUrl
    Base URL of the running MCP server. Defaults to $env:MCP_SERVER_URL or http://localhost:3000.
#>
[CmdletBinding()]
param(
    [string]$ServerUrl = ($env:MCP_SERVER_URL ?? "http://localhost:3000")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Expected tools (update this list as new tools are added)
# ---------------------------------------------------------------------------
$ExpectedTools = @(
    "winccoa_dp_exists"
    "winccoa_dp_get"
    "winccoa_dp_set"
    "winccoa_dp_set_timed"
    "winccoa_dp_set_period"
    "winccoa_dp_names"
    "winccoa_dp_query"
    "winccoa_dp_create"
    "winccoa_dp_delete"
    "winccoa_dp_copy"
    "winccoa_dp_types"
    "winccoa_dp_type_get"
    "winccoa_dp_type_name"
    "winccoa_dp_type_create"
    "winccoa_dp_type_change"
    "winccoa_dp_type_delete"
    "winccoa_name_check"
    "winccoa_common_get"
    "winccoa_common_set"
    "winccoa_common_delete"
    "winccoa_alarm_config_get"
    "winccoa_alarm_config_set"
    "winccoa_alarm_config_delete"
    "winccoa_alarm_log_get"
    "winccoa_archive_config_get"
    "winccoa_archive_config_set"
    "winccoa_archive_config_delete"
    "winccoa_archive_get"
    "winccoa_pv_range_get"
    "winccoa_pv_range_set"
    "winccoa_pv_range_delete"
    "winccoa_manager_list"
    "winccoa_system_info"
    "winccoa_ascii_export"
    "winccoa_ascii_import"
    "winccoa_script_execute"
)

Write-Host "=== Test-ToolsList: Checking registered tools at $ServerUrl ===" -ForegroundColor Cyan

# Call tools/list
$body = @{
    jsonrpc = "2.0"
    id      = "list-1"
    method  = "tools/list"
    params  = @{}
} | ConvertTo-Json -Depth 5 -Compress

try {
    $response = Invoke-RestMethod `
        -Method Post `
        -Uri "$ServerUrl/mcp" `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec 15
} catch {
    Write-Error "FAIL: Cannot reach MCP server at '$ServerUrl/mcp'. Error: $_"
    exit 1
}

if ($response.error) {
    Write-Error "FAIL: tools/list returned error: $($response.error | ConvertTo-Json)"
    exit 1
}

$registeredToolNames = $response.result.tools | ForEach-Object { $_.name }
Write-Host "Server has $($registeredToolNames.Count) registered tool(s)." -ForegroundColor Gray

$failures = 0
foreach ($toolName in $ExpectedTools) {
    if ($registeredToolNames -contains $toolName) {
        Write-Host "  [PASS] $toolName" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $toolName — NOT FOUND" -ForegroundColor Red
        $failures++
    }
}

if ($failures -gt 0) {
    Write-Host "`n$failures tool(s) missing from server registration." -ForegroundColor Red
    exit 1
} else {
    Write-Host "`nAll $($ExpectedTools.Count) expected tools are registered. PASS" -ForegroundColor Green
    exit 0
}
