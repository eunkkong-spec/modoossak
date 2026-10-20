# 농사로 주간농사정보 API → data/weekly.json
# 최근 호의 hwpx를 내려받아 '요약' 표(분야별 핵심)와 날씨·저수율을 뽑아 저장합니다.
# API 키: 환경변수 NONGSARO_API_KEY (GitHub Secrets) → 없으면 프로젝트 루트의 .env 파일
# 실행: powershell -ExecutionPolicy Bypass -File scripts/fetch-weekly.ps1

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$root = Split-Path $PSScriptRoot -Parent
$outFile = Join-Path (Join-Path $root 'data') 'weekly.json'
$keep = 8  # 지난주 버튼으로 볼 수 있는 호 수

$apiKey = $env:NONGSARO_API_KEY
if (-not $apiKey) {
  $envFile = Join-Path $root '.env'
  if (Test-Path $envFile) {
    $line = Get-Content $envFile -Encoding UTF8 | Where-Object { $_ -match '^\s*NONGSARO_API_KEY\s*=' } | Select-Object -First 1
    if ($line) { $apiKey = ($line -split '=', 2)[1].Trim() }
  }
}
if (-not $apiKey) { throw 'NONGSARO_API_KEY가 없습니다. .env 파일이나 GitHub Secrets에 넣어 주세요.' }

function Get-Utf8 ([string]$url) {
  $res = Invoke-WebRequest -UseBasicParsing -Uri $url
  [Text.Encoding]::UTF8.GetString($res.RawContentStream.ToArray())
}

function Format-Text ([string]$s) {
  $s = $s -replace '[‧ㆍ・]', '·' -replace '∼', '~' -replace '\s+', ' '
  $s.Trim()
}

# hwpx(zip) 안의 section*.xml에서 문단 글자만 순서대로 꺼냄 (표 칸 안 문단 포함)
function Get-HwpxLines ([string]$path) {
  $zip = [IO.Compression.ZipFile]::OpenRead($path)
  try {
    $entries = $zip.Entries | Where-Object { $_.FullName -match '^Contents/section\d+\.xml$' } |
      Sort-Object { [int]($_.FullName -replace '\D', '') }
    foreach ($entry in $entries) {
      $reader = New-Object IO.StreamReader($entry.Open(), [Text.Encoding]::UTF8)
      try { [xml]$doc = $reader.ReadToEnd() } finally { $reader.Dispose() }
      $ns = New-Object Xml.XmlNamespaceManager $doc.NameTable
      $ns.AddNamespace('hp', 'http://www.hancom.co.kr/hwpml/2011/paragraph')
      foreach ($p in $doc.SelectNodes('//hp:p[not(ancestor::hp:p)] | //hp:subList/hp:p', $ns)) {
        $text = ($p.SelectNodes('./hp:run/hp:t', $ns) | ForEach-Object { $_.InnerText }) -join ''
        if ($text.Trim()) { $text.Trim() }
      }
    }
  } finally { $zip.Dispose() }
}

# '요 약' 표: 분야 이름 줄 다음에 '• (주제)내용' 줄이 이어짐
function Get-SummaryFields ([string[]]$lines) {
  $start = [Array]::FindIndex($lines, [Predicate[string]] { param($l) $l -match '^요\s*약$' })
  if ($start -lt 0) { return @() }
  $fields = New-Object Collections.ArrayList
  $current = $null
  for ($i = $start + 1; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    if ($line -match '^제\s*1\s*장') { break }
    if ($line -in '분야', '핵심기술 및 정보') { continue }
    if ($line -match '^[•ㆍ]\s*(.*)$') {
      $body = Format-Text $Matches[1]
      $topic = ''
      if ($body -match '^\(([^)]*)\)\s*(.*)$') { $topic = $Matches[1].Trim(); $body = $Matches[2] }
      $note = ''
      if ($body -match '^(.*?)\s*\*\s*(.*)$') { $body = $Matches[1]; $note = $Matches[2] }
      [void]$current.items.Add([ordered]@{ topic = $topic; text = $body.Trim(); note = $note.Trim() })
    } elseif ($line -match '^[*※]') {
      if ($current -and $current.items.Count) { $current.items[-1].note = Format-Text ($line -replace '^[*※]\s*', '') }
    } elseif ($current -and $current.items.Count -eq 0) {
      $current.name += ($line -replace '\s', '')  # '농업' + '정보'처럼 나뉜 분야 이름
    } else {
      $current = [ordered]@{ name = ($line -replace '\s', ''); items = (New-Object Collections.ArrayList) }
      [void]$fields.Add($current)
    }
  }
  , @($fields | Where-Object { $_.items.Count })
}

function Get-Weather ($fields, [string[]]$lines) {
  $cards = New-Object Collections.ArrayList
  $info = $fields | Where-Object { $_.name -eq '농업정보' } | Select-Object -First 1
  if (-not $info) { return , @() }
  $forecast = $info.items | Where-Object { $_.topic -eq '기상' } | Select-Object -First 1
  $reservoir = $info.items | Where-Object { $_.topic -eq '저수율' } | Select-Object -First 1

  if ($forecast -and $forecast.text -match '기온은\s*평년\(([^)]*)\)(.*?겠)') {
    $desc = "평년 $($Matches[1])"
    if ($forecast.note) { $desc += " · $($forecast.note)" }
    [void]$cards.Add([ordered]@{ type = 'temp'; tag = '기온'; title = "평년$($Matches[2])음"; desc = $desc })
  }
  if ($forecast -and $forecast.text -match '강수량은\s*평년\(([^)]*)\)(.*?겠)') {
    $title = "평년$($Matches[2])음"
    $desc = "평년 $($Matches[1])"
    $month = [Array]::FindIndex($lines, [Predicate[string]] { param($l) $l -match '1개월 전망' })
    if ($month -ge 0) {
      $rain = $lines[($month + 1)..([Math]::Min($month + 6, $lines.Count - 1))] | Where-Object { $_ -match '^-\s*강수량은\s*(.+)$' } | Select-Object -First 1
      if ($rain -match '^-\s*강수량은\s*(.+)$') { $desc += " · 한 달 전망: $($Matches[1].Trim())" }
    }
    [void]$cards.Add([ordered]@{ type = 'rain'; tag = '강수'; title = $title; desc = $desc })
  }
  if ($reservoir -and $reservoir.text -match '([\d.]+)%\s*\(평년\s*([\d.]+)%의\s*([\d.]+)%\)') {
    $title = "저수율 $($Matches[1])% (평년의 $([Math]::Round([double]$Matches[3]))%)"
    $desc = '물 관리에 신경 쓰세요'
    $recent = $lines | Where-Object { $_ -match '강수량은\s*([\d.]+)㎜로\s*평년\(([\d.,]+)\).*?\(([\d.]+)%\)' } | Select-Object -First 1
    if ($recent -match '강수량은\s*([\d.]+)㎜로\s*평년\(([\d.,]+)\).*?\(([\d.]+)%\)') {
      $desc = "최근 한 달 강수량 $($Matches[1])㎜ (평년의 $([Math]::Round([double]$Matches[3]))%)"
    }
    [void]$cards.Add([ordered]@{ type = 'alert'; tag = '저수율'; title = $title; desc = $desc })
  }
  , @($cards)
}

# 기존 파일에 이미 있는 호는 다시 내려받지 않음
$existing = @{}
if ((Test-Path $outFile) -and (Get-Item $outFile).Length -gt 0) {
  $old = [IO.File]::ReadAllText($outFile, [Text.Encoding]::UTF8) | ConvertFrom-Json
  foreach ($issue in $old.issues) { $existing[[string]$issue.id] = $issue }
}

[xml]$list = Get-Utf8 "http://api.nongsaro.go.kr/service/weekFarmInfo/weekFarmInfoList?apiKey=$apiKey&numOfRows=$keep&pageNo=1"
$code = $list.response.header.resultCode
if ($code -ne '00') { throw "API 오류 $code : $($list.response.header.resultMsg)" }

$tmp = Join-Path ([IO.Path]::GetTempPath()) "weekly-$PID.hwpx"
$issues = foreach ($item in $list.SelectNodes('//items/item')) {
  $get = { param($name) $item.SelectSingleNode($name).InnerText.Trim() }
  $id = & $get 'cntntsNo'
  if ($existing.ContainsKey($id)) { $existing[$id]; continue }

  $subject = & $get 'subject'
  $names = (& $get 'fileName') -split '\|'
  $urls = (& $get 'downUrlList') -split '\|'
  $fileUrl = @{}
  for ($i = 0; $i -lt $names.Count; $i++) { $fileUrl[[IO.Path]::GetExtension($names[$i]).ToLower()] = $urls[$i] }

  $no = if ($subject -match '제\s*(\d+)\s*호') { [int]$Matches[1] } else { 0 }
  $startDate = ''; $endDate = ''
  if ($subject -match '(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*~\s*(\d{1,2})\.\s*(\d{1,2})') {
    $s = Get-Date -Year $Matches[1] -Month $Matches[2] -Day $Matches[3]
    $e = Get-Date -Year $Matches[1] -Month $Matches[4] -Day $Matches[5]
    if ($e -lt $s) { $e = $e.AddYears(1) }
    $startDate = $s.ToString('yyyy-MM-dd'); $endDate = $e.ToString('yyyy-MM-dd')
  }

  $fields = @(); $weather = @()
  if ($fileUrl['.hwpx']) {
    Write-Host "내려받는 중: $subject"
    Invoke-WebRequest -UseBasicParsing -Uri $fileUrl['.hwpx'] -OutFile $tmp
    $lines = [string[]]@(Get-HwpxLines $tmp)
    $fields = Get-SummaryFields $lines
    $weather = Get-Weather $fields $lines
    Remove-Item $tmp -Force
    if (-not $fields.Count) { Write-Warning "요약 표를 찾지 못했습니다: $subject" }
  }

  [ordered]@{
    id = $id; no = $no; subject = $subject
    start = $startDate; end = $endDate; regDt = (& $get 'regDt')
    pdf = $fileUrl['.pdf']; hwpx = $fileUrl['.hwpx']
    weather = $weather; fields = $fields
  }
}

$json = [ordered]@{ source = '농촌진흥청 농사로 주간농사정보'; issues = @($issues) } | ConvertTo-Json -Depth 8
$prev = if (Test-Path $outFile) { [IO.File]::ReadAllText($outFile, [Text.Encoding]::UTF8) } else { '' }
if ($json -ne $prev) {
  [IO.File]::WriteAllText($outFile, $json, (New-Object Text.UTF8Encoding $false))
  Write-Host "저장했습니다: $outFile (최신 $($issues[0].subject))"
} else {
  Write-Host '바뀐 내용이 없습니다.'
}
