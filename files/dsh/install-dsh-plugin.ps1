<#
.SYNOPSIS
  按本机 DSH 版本自动挑选兼容的 npm 插件版本并安装。

.DESCRIPTION
  插件版本不能照抄别人博客里的数字，必须和本机 DSH 主版本对上。
  本脚本读取本机 DSH 版本，拉取 npm 上该插件的全部版本，
  用每个版本声明的 peerDependencies（@deepseek-ai/dsh-*）做匹配，
  选出「满足条件的最高版本」，再调用 dsh plugin add 安装。

.EXAMPLE
  .\install-dsh-plugin.ps1 -DryRun
  # 只显示会选哪个版本，不实际安装

.EXAMPLE
  .\install-dsh-plugin.ps1 -Plugin ds-harness-remote -Profile desktop
  # 实际安装
#>
[CmdletBinding()]
param(
    [string]$Plugin = 'ds-harness-remote',
    [string]$Profile = 'desktop',
    [string]$DshCli = '',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# ---------- semver ----------
function ConvertTo-SemVer([string]$v) {
    $m = [regex]::Match($v.Trim(), '^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z\.\-]+))?(?:\+[0-9A-Za-z\.\-]+)?$')
    if (-not $m.Success) { return $null }
    [pscustomobject]@{
        Major = [int]$m.Groups[1].Value
        Minor = [int]$m.Groups[2].Value
        Patch = [int]$m.Groups[3].Value
        Pre   = if ($m.Groups[4].Success) { $m.Groups[4].Value } else { '' }
    }
}

function Compare-SemVer($a, $b) {
    if ($a.Major -ne $b.Major) { return [Math]::Sign($a.Major - $b.Major) }
    if ($a.Minor -ne $b.Minor) { return [Math]::Sign($a.Minor - $b.Minor) }
    if ($a.Patch -ne $b.Patch) { return [Math]::Sign($a.Patch - $b.Patch) }
    # 无预发布 > 有预发布
    if ($a.Pre -eq $b.Pre) { return 0 }
    if ($a.Pre -eq '') { return 1 }
    if ($b.Pre -eq '') { return -1 }
    $ai = $a.Pre -split '\.'; $bi = $b.Pre -split '\.'
    for ($i = 0; $i -lt [Math]::Max($ai.Count, $bi.Count); $i++) {
        if ($i -ge $ai.Count) { return -1 }
        if ($i -ge $bi.Count) { return 1 }
        $x = $ai[$i]; $y = $bi[$i]
        $xn = $x -match '^\d+$'; $yn = $y -match '^\d+$'
        if ($xn -and $yn) {
            $d = [int]$x - [int]$y
            if ($d -ne 0) { return [Math]::Sign($d) }
        } elseif ($xn) { return -1 }
        elseif ($yn) { return 1 }
        else {
            $c = [string]::CompareOrdinal($x, $y)
            if ($c -ne 0) { return [Math]::Sign($c) }
        }
    }
    return 0
}

function Test-Comparator([string]$range, $ver) {
    $t = $range.Trim()
    if ($t -eq '' -or $t -eq '*' -or $t -eq 'x') { return $true }
    if ($t -match '^(\^|~|>=|<=|>|<|=)?\s*v?(.+)$') {
        $op = $Matches[1]; if ($op -eq '') { $op = '=' }
        $target = ConvertTo-SemVer $Matches[2]
        if ($null -eq $target) { return $false }
        $c = Compare-SemVer $ver $target
        switch ($op) {
            '='  { return $c -eq 0 }
            '>=' { return $c -ge 0 }
            '<=' { return $c -le 0 }
            '>'  { return $c -gt 0 }
            '<'  { return $c -lt 0 }
            '^'  {
                if ($c -lt 0) { return $false }
                if ($target.Major -gt 0) { return $ver.Major -eq $target.Major }
                if ($target.Minor -gt 0) { return ($ver.Major -eq 0 -and $ver.Minor -eq $target.Minor) }
                return ($ver.Major -eq 0 -and $ver.Minor -eq 0 -and $ver.Patch -eq $target.Patch)
            }
            '~'  {
                if ($c -lt 0) { return $false }
                return ($ver.Major -eq $target.Major -and $ver.Minor -eq $target.Minor)
            }
        }
    }
    return $false
}

function Test-Satisfies([string]$range, [string]$version) {
    $ver = ConvertTo-SemVer $version
    if ($null -eq $ver) { return $false }
    # 预发布版本只有在区间本身写了同版本号预发布时才允许匹配（简化处理：
    # 若本机是预发布且区间上界为 X.Y.Z-0，仍按数值比较，符合 npm 的实际行为）
    foreach ($alt in ($range -split '\|\|')) {
        $ok = $true
        foreach ($c in ($alt.Trim() -split '\s+')) {
            if ($c -eq '') { continue }
            if (-not (Test-Comparator $c $ver)) { $ok = $false; break }
        }
        if ($ok) { return $true }
    }
    return $false
}

# ---------- 1. 定位 dsh 命令 ----------
function Resolve-DshCli {
    param([string]$Explicit)
    if ($Explicit) {
        if (Test-Path $Explicit) { return (Resolve-Path $Explicit).Path }
        throw "指定的 dsh 不存在：$Explicit"
    }
    # a) PATH 里有优先用
    $cmd = Get-Command dsh -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $cmd = Get-Command dsh.cmd -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    # b) 桌面版自带 CLI 的相对位置：<安装根>\resources\runtime\cli\bin\dsh.cmd
    $roots = @($env:LOCALAPPDATA, $env:ProgramFiles, ${env:ProgramFiles(x86)}, 'D:\', 'E:\', 'F:\') |
        Where-Object { $_ -and (Test-Path $_) }
    foreach ($root in $roots) {
        $hits = Get-ChildItem -Path $root -Filter 'dsh.cmd' -Recurse -Depth 6 -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -like '*\resources\runtime\cli\bin\dsh.cmd' } |
            Select-Object -First 1
        if ($hits) { return $hits.FullName }
    }
    throw "没找到 dsh 命令。`n请手动指定，例如：`n  .\install-dsh-plugin.ps1 -DshCli 'F:\DSH\resources\runtime\cli\bin\dsh.cmd'"
}

$DshCli = Resolve-DshCli -Explicit $DshCli
Write-Host "dsh 命令      : $DshCli" -ForegroundColor DarkGray
$dshVersion = (& $DshCli --version 2>&1 | Out-String).Trim()
Write-Host "本机 DSH 版本 : $dshVersion" -ForegroundColor Cyan

# ---------- 2. 拉取 npm 元数据 ----------
Write-Host "查询 npm      : $Plugin" -ForegroundColor Cyan
$meta = Invoke-RestMethod -Uri "https://registry.npmjs.org/$Plugin" -TimeoutSec 60
if (-not $meta.versions) { throw "npm 上没有找到包 $Plugin" }
$latest = $meta.'dist-tags'.latest
Write-Host "包最新版本    : $latest" -ForegroundColor Cyan
Write-Host ""

# ---------- 3. 逐个版本比对 peerDependencies ----------
$candidates = @()
$skipped = @()
foreach ($prop in $meta.versions.PSObject.Properties) {
    $v = $prop.Name
    $info = $prop.Value
    if ($info.deprecated) { $skipped += [pscustomobject]@{ Version = $v; Reason = '已废弃' }; continue }

    $peers = $info.peerDependencies
    $dshPeers = @{}
    if ($peers) {
        foreach ($p in $peers.PSObject.Properties) {
            if ($p.Name -like '@deepseek-ai/dsh*') { $dshPeers[$p.Name] = $p.Value }
        }
    }
    if ($dshPeers.Count -eq 0) {
        $skipped += [pscustomobject]@{ Version = $v; Reason = '未声明 dsh peer，无法判断' }
        continue
    }

    $allOk = $true; $failedOn = $null
    foreach ($k in ($dshPeers.Keys | Sort-Object)) {
        if (-not (Test-Satisfies $dshPeers[$k] $dshVersion)) { $allOk = $false; $failedOn = $k; break }
    }
    if ($allOk) {
        $candidates += [pscustomobject]@{ Version = $v; SemVer = (ConvertTo-SemVer $v); Peer = $dshPeers }
    } else {
        $skipped += [pscustomobject]@{ Version = $v; Reason = "不满足 $failedOn $($dshPeers[$failedOn])" }
    }
}

if ($candidates.Count -eq 0) {
    Write-Host "没有找到兼容 $dshVersion 的版本。" -ForegroundColor Red
    Write-Host "说明这个插件还没适配你的 DSH 版本，或者它用了别的方式声明兼容性。" -ForegroundColor Yellow
    exit 1
}

$best = $candidates | Sort-Object -Property @{ Expression = { $_.SemVer.Major } }, @{ Expression = { $_.SemVer.Minor } }, @{ Expression = { $_.SemVer.Patch } }, @{ Expression = { $_.SemVer.Pre } } -Descending | Select-Object -First 1

Write-Host "兼容 $dshVersion 的版本（共 $($candidates.Count) 个）：" -ForegroundColor Green
$candidates | Sort-Object { $_.SemVer.Major }, { $_.SemVer.Minor }, { $_.SemVer.Patch } -Descending |
    Select-Object -First 10 | ForEach-Object { Write-Host ("  - " + $_.Version) }
Write-Host ""
Write-Host "选定版本      : $($best.Version)" -ForegroundColor Green
$best.Peer.GetEnumerator() | Sort-Object Name | ForEach-Object {
    Write-Host ("  peer " + $_.Key.PadRight(42) + " " + $_.Value) -ForegroundColor DarkGray
}

if ($skipped.Count -gt 0) {
    Write-Host ""
    Write-Host "已排除（前 5 条）：" -ForegroundColor DarkYellow
    $skipped | Select-Object -First 5 | ForEach-Object { Write-Host ("  - " + $_.Version + "  " + $_.Reason) -ForegroundColor DarkYellow }
}

# ---------- 4. 安装 ----------
if ($DryRun) {
    Write-Host ""
    Write-Host "[DryRun] 将执行：" -ForegroundColor Yellow
    Write-Host "  `"$DshCli`" plugin --profile $Profile add -w $Plugin@$($best.Version)"
    exit 0
}

Write-Host ""
Write-Host "开始安装..." -ForegroundColor Cyan
& $DshCli plugin --profile $Profile add -w "$Plugin@$($best.Version)" 2>&1 | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) { throw "安装失败（exit $LASTEXITCODE）" }

Write-Host ""
Write-Host "完成。请完全退出 DSH 再重新打开，插件才会加载。" -ForegroundColor Green
