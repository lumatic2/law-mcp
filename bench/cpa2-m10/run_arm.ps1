param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('codex-with', 'codex-without', 'opus-with', 'opus-without')]
    [string]$Arm,
    [Parameter(Mandatory = $true)]
    [ValidateSet('smoke', 'solve')]
    [string]$Mode,
    [Parameter(Mandatory = $true)]
    [string]$OutputDir
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Generated = Join-Path $PSScriptRoot 'generated'
$Availability = if ($Arm.EndsWith('-with')) { 'with' } else { 'without' }
$PromptPath = Join-Path $Generated "$Mode-$Availability.txt"
$Out = [System.IO.Path]::GetFullPath($OutputDir)
$Scratch = Join-Path ([System.IO.Path]::GetTempPath()) ("law-mcp-m10-$Arm-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Out -Force | Out-Null
New-Item -ItemType Directory -Path $Scratch -Force | Out-Null

if (-not (Test-Path $PromptPath)) {
    throw "missing generated prompt: $PromptPath"
}
if (-not (Test-Path Env:LAW_API_OC) -and $Availability -eq 'with') {
    throw 'LAW_API_OC is not present in the inherited environment'
}

$Started = (Get-Date).ToUniversalTime().ToString('o')
$PromptHash = (Get-FileHash $PromptPath -Algorithm SHA256).Hash.ToLower()
$DeployPath = 'C:/Users/yusun/projects/custom-mcps/law-mcp/dist/index.js'
$DeployHash = (Get-FileHash $DeployPath -Algorithm SHA256).Hash.ToLower()
$RawPath = Join-Path $Out 'raw.jsonl'
$ErrPath = Join-Path $Out 'stderr.log'
$Prompt = Get-Content -Raw -Encoding UTF8 $PromptPath

Push-Location $Scratch
try {
    if ($Arm.StartsWith('codex-')) {
        $Args = @(
            '--ask-for-approval', 'never', 'exec', '-m', 'gpt-5.6-sol', '--ignore-user-config', '--ignore-rules', '--ephemeral',
            '--skip-git-repo-check', '--sandbox', 'read-only', '--json',
            '-c', 'web_search="disabled"', '-c', 'agents.enabled=false'
        )
        if ($Availability -eq 'with') {
            $Args += @(
                '-c', 'mcp_servers.law_mcp.command="node"',
                '-c', 'mcp_servers.law_mcp.args=["C:/Users/yusun/projects/custom-mcps/law-mcp/dist/index.js"]',
                '-c', 'mcp_servers.law_mcp.env_vars=["LAW_API_OC"]',
                '-c', 'mcp_servers.law_mcp.default_tools_approval_mode="approve"'
            )
        }
        $Args += '-'
        $Prompt | & codex @Args 1> $RawPath 2> $ErrPath
        $ExitCode = $LASTEXITCODE
        $RequestedModel = 'gpt-5.6-sol'
    } else {
        $ConfigName = if ($Availability -eq 'with') { 'claude-with.json' } else { 'claude-without.json' }
        $Config = Join-Path $PSScriptRoot $ConfigName
        $Args = @(
            '-p', '--model', 'opus', '--effort', 'high', '--mcp-config', $Config,
            '--strict-mcp-config', '--tools', '', '--no-chrome', '--disable-slash-commands',
            '--no-session-persistence', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'auto'
        )
        if ($Availability -eq 'with') {
            $Args += @('--allowedTools', 'mcp__law_mcp__search_law,mcp__law_mcp__get_law_article')
        }
        $Prompt | & claude @Args 1> $RawPath 2> $ErrPath
        $ExitCode = $LASTEXITCODE
        $RequestedModel = 'opus'
    }
} finally {
    Pop-Location
}

$Ended = (Get-Date).ToUniversalTime().ToString('o')
$Meta = [ordered]@{
    arm = $Arm
    mode = $Mode
    availability = $Availability
    requested_model = $RequestedModel
    prompt_sha256 = $PromptHash
    deployed_entry = if ($Availability -eq 'with') { $DeployPath } else { $null }
    deployed_sha256 = if ($Availability -eq 'with') { $DeployHash } else { $null }
    scratch_dir = $Scratch
    started_at = $Started
    ended_at = $Ended
    exit_code = $ExitCode
    inherited_law_api_oc = [bool](Test-Path Env:LAW_API_OC)
    forbidden_surfaces = @('web', 'chrome', 'shell', 'file', 'skills', 'agents')
}
$Meta | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $Out 'run-meta.json')
if ($ExitCode -ne 0) { exit $ExitCode }
