#Requires -Version 5.1
<#
.SYNOPSIS
    Invokes a single MCP tool on the running WinCC OA MCP server and returns the parsed result.

.DESCRIPTION
    Sends a JSON-RPC 2.0 call to the MCP server's Streamable HTTP endpoint.
    The server must be running and reachable at the configured URL.

.PARAMETER ToolName
    The name of the MCP tool to invoke (e.g. "winccoa_dp_names").

.PARAMETER Arguments
    A hashtable of arguments to pass to the tool. Will be serialised to JSON.

.PARAMETER ServerUrl
    Base URL of the running MCP server. Defaults to $env:MCP_SERVER_URL or http://localhost:3000.

.PARAMETER TimeoutSec
    HTTP request timeout in seconds. Default: 30.

.OUTPUTS
    The parsed tool result (PSCustomObject or array).

.EXAMPLE
    .\Invoke-McpTool.ps1 -ToolName "winccoa_dp_names" -Arguments @{ dpPattern = "*"; limit = 5 }
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ToolName,

    [hashtable]$Arguments = @{},

    [string]$ServerUrl = ($env:MCP_SERVER_URL ?? "http://localhost:3000"),

    [int]$TimeoutSec = 30
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Build JSON-RPC 2.0 request body
$requestId = [System.Guid]::NewGuid().ToString()
$body = @{
    jsonrpc = "2.0"
    id      = $requestId
    method  = "tools/call"
    params  = @{
        name      = $ToolName
        arguments = $Arguments
    }
} | ConvertTo-Json -Depth 20 -Compress

$uri = "$ServerUrl/mcp"

try {
    $response = Invoke-RestMethod `
        -Method Post `
        -Uri $uri `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec $TimeoutSec

    if ($null -eq $response) {
        throw "Empty response from server"
    }

    if ($response.error) {
        throw "MCP error [$($response.error.code)]: $($response.error.message)"
    }

    return $response.result
} catch [System.Net.WebException] {
    Write-Error "Cannot reach MCP server at '$uri'. Is it running? Error: $_"
    exit 1
}
