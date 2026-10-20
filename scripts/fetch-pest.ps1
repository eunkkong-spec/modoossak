# 농사로 병해충 발생정보 API → data/pest.json
# 최근 호의 PDF를 내려받아 첫 쪽 요약(예보·주의보·경보)과 병해충별 상세(발생 상황·방제 요령)를 뽑아 저장합니다.
# PDF 글자 추출에 Poppler의 pdftotext가 필요합니다. (PC: winget install oschwartz10612.Poppler / GitHub: apt-get install poppler-utils)
# API 키: 환경변수 NONGSARO_API_KEY (GitHub Secrets) → 없으면 프로젝트 루트의 .env 파일
# 실행: powershell -ExecutionPolicy Bypass -File scripts/fetch-pest.ps1

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$root = Split-Path $PSScriptRoot -Parent
$outFile = Join-Path (Join-Path $root 'data') 'pest.json'
$keep = 6  # 지난호 버튼으로 볼 수 있는 호 수

$apiKey = $env:NONGSARO_API_KEY
if (-not $apiKey) {
  $envFile = Join-Path $root '.env'
  if (Test-Path $envFile) {
    $line = Get-Content $envFile -Encoding UTF8 | Where-Object { $_ -match '^\s*NONGSARO_API_KEY\s*=' } | Select-Object -First 1
    if ($line) { $apiKey = ($line -split '=', 2)[1].Trim() }
  }
}
if (-not $apiKey) { throw 'NONGSARO_API_KEY가 없습니다. .env 파일이나 GitHub Secrets에 넣어 주세요.' }

# 셸을 다시 열기 전에는 PATH에 없을 수 있어 winget 설치 위치도 찾아봄
function Find-Poppler ([string]$name) {
  $path = (Get-Command $name -ErrorAction SilentlyContinue).Source
  if (-not $path -and $env:LOCALAPPDATA) {
    $path = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages') -Filter "$name.exe" -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty FullName
  }
  if (-not $path) { throw "$name 이(가) 없습니다. Poppler를 설치해 주세요." }
  $path
}
$pdftotext = Find-Poppler 'pdftotext'
$pdftohtml = Find-Poppler 'pdftohtml'
$pdftoppm = Find-Poppler 'pdftoppm'

$imageDir = Join-Path (Join-Path $root 'images') 'pests'
New-Item -ItemType Directory -Force $imageDir | Out-Null

function Get-Utf8 ([string]$url) {
  $res = Invoke-WebRequest -UseBasicParsing -Uri $url
  [Text.Encoding]::UTF8.GetString($res.RawContentStream.ToArray())
}

function Format-Text ([string]$s) {
  $s = $s -replace '[‧ㆍ・․]', '·' -replace '[∼～]', '~' -replace '\s+', ' ' -replace '\s+([,.)])', '$1' -replace '\(\s+', '(' -replace '\s*·\s*', '·'
  $s.Trim()
}

# PDF 줄바꿈은 낱말 중간에서도 끊기므로, 이어 붙일 때 띄어쓰기 여부를 추정함
$particle = '^(는|은|를|을|이|가|에|의|로|와|과|도|만|함|됨|임)([\s,.]|$)|^(으로|므로|으며|으나|이며|이고|이므로|하여|하고|하며|하면|되어|되고|되며|되는)'
$oneSyllableWord = '^(등|및|시|후|전|중|약|각|더|잘|꼭|곧|위|안|밖|앞|뒤|속|때|수|것|곳|내|외|잎|논|밭|물|흙|해|병|벼|콩|팥|깨|파|무|배|감|밤|귤)$'
$script:docText = ''  # 같은 호 본문: 붙여 쓴 낱말이 다른 줄에 있으면 붙여 씀 (예: 과수화 + 상병)
function Join-Wrapped ([string]$prev, [string]$next) {
  if ($prev -match '[가-힣]$' -and $next -match '^[가-힣]') {
    if ($next -match $particle) { return "$prev$next" }
    $last = ($prev -split '\s+')[-1]
    $first = ($next -split '\s+')[0] -replace '[^가-힣].*$', ''
    if ("$last$first".Length -ge 4 -and $script:docText.Contains("$last$first")) { return "$prev$next" }
    if ($last.Length -eq 1 -and $last -notmatch $oneSyllableWord) { return "$prev$next" }
  }
  "$prev $next"
}

function Get-PestData ([string[]]$lines) {
  $levelPattern = '(예\s*보|주\s*의\s*보|경\s*보)'
  $summary = New-Object Collections.ArrayList
  $items = New-Object Collections.ArrayList
  $category = ''
  $inDetail = $false
  $current = $null   # 지금 채우는 상세 항목
  $bullet = $null    # 지금 이어 붙이는 문단 { list; index }
  $alert = $null     # 요약에서 이어지는 줄
  $level = ''
  $script:docText = $lines -join "`n"

  foreach ($raw in $lines) {
    # 사진 설명 【…】은 그 항목의 사진 이름으로 모아 두고, 본문에서는 떼어 냄
    if ($inDetail -and $current) {
      foreach ($m in [regex]::Matches($raw, '【([^】]+)】')) { [void]$current.captions.Add($m.Groups[1].Value.Trim()) }
    }
    $line =($raw -replace '\s{3,}【.*$', '' -replace '【[^】]*】', '').Trim()
    if (-not $line) { continue }

    if ($line -match '농약 안전사용기준') { $inDetail = $true; $alert = $null; continue }
    if ($inDetail -and $line -match '기상\s*전망|리플릿|시·도별|부적합') { break }

    if ($line -match '^(Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ|Ⅵ)\.\s*(.+)$') {
      $category = $Matches[2] -replace '\s', ''
      if (-not $inDetail) { [void]$summary.Add([ordered]@{ category = $category; alerts = (New-Object Collections.ArrayList) }) }
      $alert = $null; $bullet = $null
      continue
    }

    # 요약: '▶ (예 보) 병 : …' 한 줄형과 '▶ (예 보)' 다음 줄 '- 병 : …' 형이 섞여 있음
    if (-not $inDetail) {
      if (-not $summary.Count) { continue }
      if ($line -match "^▶\s*\(\s*$levelPattern\s*\)\s*(.*)$") {
        $level = $Matches[1] -replace '\s', ''
        $line = $Matches[2]
        $alert = $null
        if (-not $line) { continue }
      }
      if ($line -match '^(-\s*)?(병|해충|바이러스)\s*:\s*(.*)$') {
        $alert = [ordered]@{ level = $level; type = $Matches[2]; text = $Matches[3] }
        [void]$summary[-1].alerts.Add($alert)
      } elseif ($alert) {
        $sep = if ($alert.text -match '\)$' -and $line -match '^[가-힣]') { ', ' } else { '' }
        $alert.text = if ($sep) { "$($alert.text)$sep$line" } else { Join-Wrapped $alert.text $line }
      }
      continue
    }

    if ($line -match "^(\d{1,2})\s+(.+?)\s*<\s*$levelPattern\s*>$") {
      $current = [ordered]@{
        category = $category; title = (Format-Text ($Matches[2] -replace '<[^>]*>', ' ')); level = ($Matches[3] -replace '\s', '')
        situation = (New-Object Collections.ArrayList); control = (New-Object Collections.ArrayList); notes = (New-Object Collections.ArrayList)
        captions = (New-Object Collections.ArrayList)
      }
      [void]$items.Add($current)
      $bullet = $null
      continue
    }
    if (-not $current) { continue }
    if ($line -match '^<' -or $line -notmatch '[가-힣]{2}') { continue }  # 사진 제목, 세로 글자, 수치 조각

    $kind = $null
    if ($line -match '^❍\s*(.*)$') { $kind = 'situation' }
    elseif ($line -match '^⇒\s*(.*)$') { $kind = 'control' }
    elseif ($line -match '^[※*]\s*(.*)$') { $kind = 'notes' }
    elseif ($line -match '^-\s+(.*)$' -and $bullet) { $kind = $bullet.list }
    if ($kind) {
      [void]$current[$kind].Add(($Matches[1] -split '\s{6,}')[0])
      $bullet = @{ list = $kind; index = $current[$kind].Count - 1 }
    } elseif ($line -match '\s{4,}') {
      continue  # 칸이 넓게 벌어진 줄은 사진 아래 설명·표 조각
    } elseif ($bullet) {
      $list = $current[$bullet.list]
      $list[$bullet.index] = Join-Wrapped $list[$bullet.index] $line
    }
  }

  foreach ($group in $summary) {
    foreach ($a in $group.alerts) {
      $a.names = @((Format-Text $a.text) -split ',\s*(?![^()]*\))' | Where-Object { $_ })
      $a.Remove('text')
    }
  }
  foreach ($item in $items) {
    foreach ($key in 'situation', 'control', 'notes') {
      # '❍ 과수화상병'처럼 낱말 하나뿐인 소제목 줄은 뺌
      $item[$key] = @($item[$key] | ForEach-Object { Format-Text $_ } | Where-Object { $_ -match '\S\s+\S' })
    }
  }
  [ordered]@{ summary = @($summary | Where-Object { $_.alerts.Count }); items = @($items) }
}

# 사진 위치 찾기: pdftohtml이 주는 사진 좌표와 【캡션】 가로 위치를 맞춰, 캡션마다 사진 영역(여러 장이면 합친 영역)을 구함.
# 캡션의 세로 좌표는 글상자 기준이라 믿을 수 없어서, 같은 줄 캡션 묶음을 위에서부터 사진 줄에 차례로 맞춤
$captionKey = { param($s) $s -replace '[\s【】]', '' }
function Get-PdfFigures ([string]$pdf, [string]$workDir) {
  & $pdftohtml -xml -q -enc UTF-8 $pdf (Join-Path $workDir 'p') | Out-Null
  $settings = New-Object Xml.XmlReaderSettings
  $settings.DtdProcessing = [Xml.DtdProcessing]::Ignore
  # 글꼴 이름에 깨진 바이트가 섞여 있어, 문자열로 먼저 읽고(깨진 글자는 대체 문자로) XML로 해석
  $xmlText = [Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes((Join-Path $workDir 'p.xml')))
  $reader = [Xml.XmlReader]::Create((New-Object IO.StringReader $xmlText), $settings)
  $doc = New-Object Xml.XmlDocument
  try { $doc.Load($reader) } finally { $reader.Dispose() }

  $figures = @{}  # 캡션 → 사진 영역 목록 (같은 캡션이 여러 번 나올 수 있음)
  foreach ($page in $doc.SelectNodes('//page')) {
    $images = foreach ($img in $page.SelectNodes('image')) {
      $l = [int]$img.left; $t = [int]$img.top; $w = [int]$img.width; $h = [int]$img.height
      if ($w -lt 0) { $l += $w; $w = -$w }
      if ($h -lt 0) { $t += $h; $h = -$h }
      if ($w -ge 60 -and $h -ge 50 -and $w / $h -lt 4.5) { [pscustomobject]@{ l = $l; t = $t; w = $w; h = $h; cx = $l + $w / 2 } }
    }
    $rows = New-Object Collections.ArrayList
    foreach ($img in @($images | Sort-Object t, l)) {
      if ($rows.Count -and [Math]::Abs($rows[-1][0].t - $img.t) -le 12) { [void]$rows[-1].Add($img) }
      else { [void]$rows.Add((New-Object Collections.ArrayList (, @($img)))) }
    }

    $capRows = New-Object Collections.ArrayList
    foreach ($text in $page.SelectNodes('text')) {
      $found = [regex]::Matches($text.InnerText, '【([^】]+)】')
      for ($k = 0; $k -lt $found.Count; $k++) {
        # 한 덩어리에 캡션이 여러 개면 폭을 나눠 가로 위치를 추정
        $cap = [pscustomobject]@{ key = (& $captionKey $found[$k].Groups[1].Value); top = [int]$text.top; cx = [int]$text.left + [int]$text.width * ($k + 0.5) / $found.Count }
        if ($capRows.Count -and $capRows[-1][0].top -eq $cap.top) { [void]$capRows[-1].Add($cap) }
        else { [void]$capRows.Add((New-Object Collections.ArrayList (, @($cap)))) }
      }
    }

    $next = 0
    foreach ($capRow in $capRows) {
      for ($r = $next; $r -lt $rows.Count; $r++) {
        $row = $rows[$r]
        $fits = @($capRow | Where-Object { $c = $_; @($row | Where-Object { [Math]::Abs($_.cx - $c.cx) -le 180 }).Count }).Count -eq $capRow.Count
        if (-not $fits) { continue }
        $next = $r + 1
        $byCap = @{}
        foreach ($img in $row) {
          $nearest = $capRow | Sort-Object { [Math]::Abs($_.cx - $img.cx) } | Select-Object -First 1
          if (-not $byCap[$nearest.key]) { $byCap[$nearest.key] = New-Object Collections.ArrayList }
          [void]$byCap[$nearest.key].Add($img)
        }
        foreach ($key in $byCap.Keys) {
          $set = $byCap[$key]
          $l = ($set | Measure-Object l -Minimum).Minimum
          $t = ($set | Measure-Object t -Minimum).Minimum
          $rgt = ($set | ForEach-Object { $_.l + $_.w } | Measure-Object -Maximum).Maximum
          $btm = ($set | ForEach-Object { $_.t + $_.h } | Measure-Object -Maximum).Maximum
          if (-not $figures[$key]) { $figures[$key] = New-Object Collections.ArrayList }
          [void]$figures[$key].Add([pscustomobject]@{ page = [int]$page.number; x = $l; y = $t; w = $rgt - $l; h = $btm - $t })
        }
        break
      }
    }
  }
  $figures
}

# pdftohtml 좌표는 1.5배(108dpi) 기준. 180dpi로 그 영역만 잘라 JPG로 저장
function Save-Figure ([string]$pdf, $fig, [string]$outFile) {
  $s = 180 / 108
  $base = [IO.Path]::Combine([IO.Path]::GetDirectoryName($outFile), [IO.Path]::GetFileNameWithoutExtension($outFile))
  & $pdftoppm -f $fig.page -l $fig.page -r 180 -x ([int]($fig.x * $s)) -y ([int]($fig.y * $s)) -W ([int]($fig.w * $s)) -H ([int]($fig.h * $s)) -jpeg -jpegopt quality=80 -singlefile $pdf $base | Out-Null
}

# 기존 파일에 이미 있는 호는 다시 내려받지 않음
$existing = @{}
if ((Test-Path $outFile) -and (Get-Item $outFile).Length -gt 0) {
  $old = [IO.File]::ReadAllText($outFile, [Text.Encoding]::UTF8) | ConvertFrom-Json
  foreach ($issue in $old.issues) { $existing[[string]$issue.id] = $issue }
}

[xml]$list = Get-Utf8 "http://api.nongsaro.go.kr/service/dbyhsCccrrncInfo/dbyhsCccrrncInfoList?apiKey=$apiKey&numOfRows=$keep&pageNo=1"
$code = $list.response.header.resultCode
if ($code -ne '00') { throw "API 오류 $code : $($list.response.header.resultMsg)" }

$tmpPdf = Join-Path ([IO.Path]::GetTempPath()) "pest-$PID.pdf"
$tmpTxt = Join-Path ([IO.Path]::GetTempPath()) "pest-$PID.txt"
$issues = foreach ($item in $list.SelectNodes('//items/item')) {
  $get = { param($name) $item.SelectSingleNode($name).InnerText.Trim() }
  $id = & $get 'cntntsNo'
  if ($existing.ContainsKey($id)) { $existing[$id]; continue }

  $subject = & $get 'cntntsSj'
  $pdf = (& $get 'downFile') -replace '^http://', 'https://'
  $no = if ($subject -match '제\s*(\d+)\s*호') { [int]$Matches[1] } else { 0 }
  $startDate = ''; $endDate = ''
  if ($subject -match '(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*~\s*(\d{1,2})\.\s*(\d{1,2})') {
    $s = Get-Date -Year $Matches[1] -Month $Matches[2] -Day $Matches[3]
    $e = Get-Date -Year $Matches[1] -Month $Matches[4] -Day $Matches[5]
    if ($e -lt $s) { $e = $e.AddYears(1) }
    $startDate = $s.ToString('yyyy-MM-dd'); $endDate = $e.ToString('yyyy-MM-dd')
  }

  Write-Host "내려받는 중: $subject"
  Invoke-WebRequest -UseBasicParsing -Uri $pdf -OutFile $tmpPdf
  & $pdftotext -layout -enc UTF-8 $tmpPdf $tmpTxt
  $data = Get-PestData ([IO.File]::ReadAllLines($tmpTxt, [Text.Encoding]::UTF8))
  if (-not $data.items.Count) { Write-Warning "병해충 상세를 찾지 못했습니다: $subject" }

  # 항목마다 캡션에 맞는 사진을 잘라 images/pests/{id}-{순번}.jpg로 저장
  $workDir = Join-Path ([IO.Path]::GetTempPath()) "pest-$PID-html"
  New-Item -ItemType Directory -Force $workDir | Out-Null
  $figures = Get-PdfFigures $tmpPdf $workDir
  $n = 0; $missing = 0
  foreach ($pest in $data.items) {
    $pest.images = @(foreach ($caption in $pest.captions) {
      $queue = $figures[(& $captionKey $caption)]
      if (-not $queue -or -not $queue.Count) { $missing++; continue }
      $fig = $queue[0]; $queue.RemoveAt(0)
      $n++
      Save-Figure $tmpPdf $fig (Join-Path $imageDir "$id-$n.jpg")
      [ordered]@{ src = "images/pests/$id-$n.jpg"; alt = $caption }
    })
    $pest.Remove('captions')
  }
  if ($missing) { Write-Warning "사진을 찾지 못한 캡션 $missing 개: $subject" }
  Remove-Item $tmpPdf, $tmpTxt -Force
  Remove-Item $workDir -Recurse -Force

  [ordered]@{
    id = $id; no = $no; subject = $subject
    start = $startDate; end = $endDate; regDt = (& $get 'registDt'); pdf = $pdf
    summary = $data.summary; items = $data.items
  }
}

# 목록에서 빠진 옛 호의 사진은 지움
$used = @{}
foreach ($issue in $issues) { foreach ($pest in $issue.items) { foreach ($img in $pest.images) { $used[[IO.Path]::GetFileName($img.src)] = $true } } }
Get-ChildItem $imageDir -Filter '*.jpg' | Where-Object { -not $used[$_.Name] } | Remove-Item -Force

$data = [ordered]@{ source = '농촌진흥청 농사로 병해충 발생정보'; issues = @($issues) }
$json = $data | ConvertTo-Json -Depth 8
# PowerShell 버전마다 들여쓰기가 달라서, 줄 맞춤을 뺀 내용끼리 비교함
$prev = if ((Test-Path $outFile) -and (Get-Item $outFile).Length -gt 0) {
  [IO.File]::ReadAllText($outFile, [Text.Encoding]::UTF8) | ConvertFrom-Json | ConvertTo-Json -Depth 8 -Compress
} else { '' }
if (($data | ConvertTo-Json -Depth 8 -Compress) -ne $prev) {
  [IO.File]::WriteAllText($outFile, $json, (New-Object Text.UTF8Encoding $false))
  Write-Host "저장했습니다: $outFile (최신 $($issues[0].subject))"
} else {
  Write-Host '바뀐 내용이 없습니다.'
}
