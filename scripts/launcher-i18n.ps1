# Localized launcher messages based on the Windows user display language.
# Generates a temporary CMD file consumed by SvenStudio3D.bat.
$ErrorActionPreference = 'Stop'
$locale = [System.Globalization.CultureInfo]::CurrentUICulture.TwoLetterISOLanguageName.ToLowerInvariant()
if ($locale -notin @('en','es','ru','ko','zh','pt')) { $locale = 'en' }
$messages = @'
{
  "en": {
    "title": "SvenStudio 3D v2.0",
    "first": "First launch: preparing the local Node.js runtime and npm dependencies.",
    "internet": "Internet is needed for the first setup; later launches work offline.",
    "local": "Local Node.js:",
    "noglobal": "No globally installed Node.js or npm is used.",
    "server": "API server: 127.0.0.1:49177; editor: 127.0.0.1:5173.",
    "keep": "Keep this window open while using the editor.",
    "closed": "SvenStudio exited with code",
    "ended": "SvenStudio stopped normally.",
    "missing": "Incomplete project: package.json or server\\index.js is missing.",
    "modules": "Required Windows dependencies are missing from node_modules.",
    "extract": "Extract the complete ZIP; do not run npm install.",
    "download": "The local Node.js runtime could not be prepared.",
    "retry": "Connect to the Internet and run the launcher again.",
    "alternative": "Alternative: put the official Windows x64 Node.js 22.16.0 node.exe in runtime\\.",
    "invalid": "runtime\\node.exe is invalid or older than Node.js 22.",
    "folder": "Cannot access the application folder.",
    "press": "Press any key to close this window.",
    "shortcut_missing": "Missing scripts\\create-shortcut.ps1",
    "shortcut_failed": "Could not create the shortcut.",
    "shortcut_ok": "SvenStudio3D.lnk was updated in this folder.",
    "lan": "LAN mode: only use on trusted private networks."
  },
  "es": {
    "title": "SvenStudio 3D v2.0",
    "first": "Primer inicio: preparando Node.js y dependencias locales.",
    "internet": "Internet solo es necesario para la preparacion inicial; despues funciona sin conexion.",
    "local": "Node.js local:",
    "noglobal": "No se utiliza Node.js ni npm instalado en Windows.",
    "server": "Servidor API: 127.0.0.1:49177; editor: 127.0.0.1:5173.",
    "keep": "Mantené esta ventana abierta mientras usás el editor.",
    "closed": "SvenStudio se cerró con código",
    "ended": "SvenStudio finalizó normalmente.",
    "missing": "Proyecto incompleto: falta package.json o server\\index.js.",
    "modules": "Faltan dependencias de Windows en node_modules.",
    "extract": "Extraé el ZIP completo; no ejecutes npm install.",
    "download": "No se pudo preparar el entorno local de Node.js.",
    "retry": "Conectate a Internet y ejecutá el iniciador otra vez.",
    "alternative": "Alternativa: colocá node.exe oficial de Node.js 22.16.0 Windows x64 en runtime\\.",
    "invalid": "runtime\\node.exe es inválido o anterior a Node.js 22.",
    "folder": "No se puede acceder a la carpeta del programa.",
    "press": "Presioná una tecla para cerrar esta ventana.",
    "shortcut_missing": "Falta scripts\\create-shortcut.ps1",
    "shortcut_failed": "No se pudo crear el acceso directo.",
    "shortcut_ok": "SvenStudio3D.lnk se actualizó en esta carpeta.",
    "lan": "Modo LAN: usalo solo en redes privadas de confianza."
  },
  "ru": {
    "title": "SvenStudio 3D v2.0",
    "first": "Первый запуск: загрузка официальной среды Node.js.",
    "internet": "Интернет нужен только для этой загрузки.",
    "local": "Локальный Node.js:",
    "noglobal": "Установленные в Windows Node.js и npm не используются.",
    "server": "Сервер API: 127.0.0.1:49177; редактор: 127.0.0.1:5173.",
    "keep": "Не закрывайте это окно, пока работает редактор.",
    "closed": "SvenStudio завершился с кодом",
    "ended": "SvenStudio завершил работу штатно.",
    "missing": "Неполный проект: отсутствует package.json или server\\index.js.",
    "modules": "В node_modules отсутствуют необходимые зависимости для Windows.",
    "extract": "Распакуйте полный ZIP; не запускайте npm install.",
    "download": "Не удалось подготовить локальную среду Node.js.",
    "retry": "Подключитесь к Интернету и перезапустите файл BAT.",
    "alternative": "Вариант: поместите официальный node.exe Node.js 22.16.0 Windows x64 в runtime\\.",
    "invalid": "runtime\\node.exe поврежден или версия ниже Node.js 22.",
    "folder": "Не удалось открыть папку приложения.",
    "press": "Нажмите любую клавишу, чтобы закрыть окно.",
    "shortcut_missing": "Отсутствует scripts\\create-shortcut.ps1",
    "shortcut_failed": "Не удалось создать ярлык.",
    "shortcut_ok": "Ярлык SvenStudio3D.lnk обновлен в этой папке.",
    "lan": "Режим LAN: используйте только в доверенных частных сетях."
  },
  "ko": {
    "title": "SvenStudio 3D v2.0",
    "first": "최초 실행: 공식 Node.js 실행 환경을 다운로드합니다.",
    "internet": "이 다운로드에만 인터넷이 필요합니다.",
    "local": "로컬 Node.js:",
    "noglobal": "Windows에 설치된 Node.js나 npm은 사용하지 않습니다.",
    "server": "API 서버: 127.0.0.1:49177; 편집기: 127.0.0.1:5173.",
    "keep": "편집기를 사용하는 동안 이 창을 닫지 마세요.",
    "closed": "SvenStudio 종료 코드",
    "ended": "SvenStudio가 정상적으로 종료되었습니다.",
    "missing": "프로젝트가 불완전합니다: package.json 또는 server\\index.js가 없습니다.",
    "modules": "node_modules에 필요한 Windows 종속성이 없습니다.",
    "extract": "전체 ZIP을 압축 해제하세요. npm install은 실행하지 마세요.",
    "download": "로컬 Node.js 환경을 준비하지 못했습니다.",
    "retry": "인터넷에 연결한 후 BAT 파일을 다시 실행하세요.",
    "alternative": "대안: 공식 Node.js 22.16.0 Windows x64 node.exe를 runtime\\에 넣으세요.",
    "invalid": "runtime\\node.exe가 잘못되었거나 Node.js 22보다 오래되었습니다.",
    "folder": "프로그램 폴더를 열 수 없습니다.",
    "press": "아무 키나 누르면 창이 닫힙니다.",
    "shortcut_missing": "scripts\\create-shortcut.ps1 파일이 없습니다.",
    "shortcut_failed": "바로 가기를 만들 수 없습니다.",
    "shortcut_ok": "이 폴더의 SvenStudio3D.lnk 바로 가기를 업데이트했습니다.",
    "lan": "LAN 모드: 신뢰할 수 있는 사설 네트워크에서만 사용하세요."
  },
  "zh": {
    "title": "SvenStudio 3D v2.0",
    "first": "首次启动：正在下载官方 Node.js 运行环境。",
    "internet": "仅首次下载需要互联网连接。",
    "local": "本地 Node.js：",
    "noglobal": "不使用 Windows 中全局安装的 Node.js 或 npm。",
    "server": "API 服务器：127.0.0.1:49177；编辑器：127.0.0.1:5173。",
    "keep": "使用编辑器期间请保持此窗口打开。",
    "closed": "SvenStudio 退出代码",
    "ended": "SvenStudio 已正常退出。",
    "missing": "项目不完整：缺少 package.json 或 server\\index.js。",
    "modules": "node_modules 中缺少必要的 Windows 依赖项。",
    "extract": "请解压完整 ZIP；不要运行 npm install。",
    "download": "无法准备本地 Node.js 运行环境。",
    "retry": "请连接互联网后重新运行启动脚本。",
    "alternative": "替代方法：将官方 Node.js 22.16.0 Windows x64 的 node.exe 放入 runtime\\。",
    "invalid": "runtime\\node.exe 无效或版本低于 Node.js 22。",
    "folder": "无法访问程序文件夹。",
    "press": "按任意键关闭此窗口。",
    "shortcut_missing": "缺少 scripts\\create-shortcut.ps1",
    "shortcut_failed": "无法创建快捷方式。",
    "shortcut_ok": "已更新此文件夹中的 SvenStudio3D.lnk。",
    "lan": "LAN 模式：仅在可信的专用网络中使用。"
  },
  "pt": {
    "title": "SvenStudio 3D v2.0",
    "first": "Primeira execução: baixando o ambiente oficial do Node.js.",
    "internet": "A Internet é necessária apenas para esse download.",
    "local": "Node.js local:",
    "noglobal": "Não utiliza Node.js nem npm instalados no Windows.",
    "server": "Servidor API: 127.0.0.1:49177; editor: 127.0.0.1:5173.",
    "keep": "Mantenha esta janela aberta enquanto usa o editor.",
    "closed": "SvenStudio encerrou com código",
    "ended": "SvenStudio encerrou normalmente.",
    "missing": "Projeto incompleto: falta package.json ou server\\index.js.",
    "modules": "Faltam dependências do Windows em node_modules.",
    "extract": "Extraia o ZIP completo; não execute npm install.",
    "download": "Não foi possível preparar o ambiente local do Node.js.",
    "retry": "Conecte-se à Internet e execute o BAT novamente.",
    "alternative": "Alternativa: coloque o node.exe oficial Node.js 22.16.0 Windows x64 em runtime\\.",
    "invalid": "runtime\\node.exe é inválido ou anterior ao Node.js 22.",
    "folder": "Não foi possível acessar a pasta do programa.",
    "press": "Pressione qualquer tecla para fechar esta janela.",
    "shortcut_missing": "Arquivo scripts\\create-shortcut.ps1 não encontrado.",
    "shortcut_failed": "Não foi possível criar o atalho.",
    "shortcut_ok": "Atalho SvenStudio3D.lnk atualizado nesta pasta.",
    "lan": "Modo LAN: use somente em redes privadas confiáveis."
  }
}
'@
$all = ConvertFrom-Json -InputObject $messages
$selected = $all.$locale
# Build locale-specific console strings with Windows-compatible command encoding.
# CMD is set to UTF-8 (chcp 65001), hence a UTF-8 (without BOM) is used here.
$path = $args[0]
if (-not $path) { throw 'Missing output file' }
$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add('@echo off')
foreach ($entry in $selected.PSObject.Properties) {
    $name = 'MSG_' + $entry.Name.ToUpperInvariant()
    $value = [string]$entry.Value
    # All text is static and contains no CMD metacharacters.
    $lines.Add('set "' + $name + '=' + $value.Replace('%','%%') + '"')
}
[System.IO.File]::WriteAllText($path, ($lines -join "`r`n") + "`r`n", (New-Object System.Text.UTF8Encoding($false)))
