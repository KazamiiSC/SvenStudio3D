# Download an official pinned Windows x64 Node runtime WITHOUT installing Node.js.
# Used only when runtime/node.exe does not yet exist; subsequent launches are offline.
$ErrorActionPreference = 'Stop'
$locale = [System.Globalization.CultureInfo]::CurrentUICulture.TwoLetterISOLanguageName.ToLowerInvariant()
if ($locale -notin @('en','es','ru','ko','zh','pt')) { $locale = 'en' }
$messages = @'
{"en": {"down": "First launch: downloading the official Node.js runtime.", "ready": "Node.js verified. Future starts work offline.", "hash": "Official checksum was not found.", "mismatch": "SHA256 does not match the official file."}, "es": {"down": "Primer inicio: descargando el entorno oficial de Node.js.", "ready": "Node.js verificado. Los próximos inicios funcionan sin Internet.", "hash": "No se encontró la suma de verificación oficial.", "mismatch": "SHA256 no coincide con el archivo oficial."}, "ru": {"down": "Первый запуск: загрузка официальной среды Node.js.", "ready": "Node.js проверен. Следующие запуски работают без Интернета.", "hash": "Официальная контрольная сумма не найдена.", "mismatch": "SHA256 не совпадает с официальным файлом."}, "ko": {"down": "최초 실행: 공식 Node.js 실행 환경을 다운로드합니다.", "ready": "Node.js 확인 완료. 다음 실행부터 인터넷이 필요하지 않습니다.", "hash": "공식 체크섬을 찾지 못했습니다.", "mismatch": "SHA256이 공식 파일과 일치하지 않습니다."}, "zh": {"down": "首次启动：正在下载官方 Node.js 运行环境。", "ready": "Node.js 校验成功。后续启动无需网络。", "hash": "未找到官方校验和。", "mismatch": "SHA256 与官方文件不一致。"}, "pt": {"down": "Primeira execução: baixando o ambiente oficial do Node.js.", "ready": "Node.js verificado. Os próximos inícios funcionam sem Internet.", "hash": "Checksum oficial não encontrado.", "mismatch": "SHA256 não corresponde ao arquivo oficial."}}
'@
$localized = (ConvertFrom-Json -InputObject $messages).$locale

$version = 'v22.16.0'
$zipName = "node-$version-win-x64.zip"
$baseUrl = "https://nodejs.org/dist/$version"
$projectDir = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectDir 'runtime'
$nodePath = Join-Path $runtimeDir 'node.exe'
$zipPath = Join-Path $runtimeDir $zipName
$hashPath = Join-Path $runtimeDir 'SHASUMS256.txt.download'
$extractDir = Join-Path $runtimeDir 'unpack-tmp'
try {
    if (Test-Path -LiteralPath $nodePath -PathType Leaf) { exit 0 }
    New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Write-Host "[INFO] $($localized.down) $zipName (nodejs.org)"
    Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/$zipName" -OutFile $zipPath -TimeoutSec 180
    Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/SHASUMS256.txt" -OutFile $hashPath -TimeoutSec 90
    $checksumLine = Get-Content -LiteralPath $hashPath | Where-Object { $_ -match "^[a-fA-F0-9]{64}\s+$([regex]::Escape($zipName))$" } | Select-Object -First 1
    if (-not $checksumLine) { throw $localized.hash }
    $expectedSha = ($checksumLine -split '\s+')[0].ToUpperInvariant()
    $actualSha = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($expectedSha -ne $actualSha) { throw $localized.mismatch }
    if (Test-Path -LiteralPath $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force }
    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force
    $extractedNode = Join-Path $extractDir "node-$version-win-x64\node.exe"
    if (-not (Test-Path -LiteralPath $extractedNode -PathType Leaf)) { throw 'The ZIP archive does not contain node.exe.' }
    Move-Item -LiteralPath $extractedNode -Destination $nodePath -Force
    & $nodePath -e "process.exit(process.platform === 'win32' && process.arch === 'x64' && process.versions.node === '22.16.0' ? 0 : 1)"
    if ($LASTEXITCODE -ne 0) { throw 'Node.js version/platform validation failed.' }
    Write-Host "[OK] $($localized.ready)"
    exit 0
} catch {
    Write-Host "[ERROR] $($_.Exception.Message)"
    if (Test-Path -LiteralPath $nodePath) { Remove-Item -LiteralPath $nodePath -Force }
    exit 1
} finally {
    if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
    if (Test-Path -LiteralPath $hashPath) { Remove-Item -LiteralPath $hashPath -Force }
    if (Test-Path -LiteralPath $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force }
}
