/** v2.0 user-facing release guidance. Keep game keywords/file extensions literal.
 * These six translations supplement the existing detailed editor manual; they
 * do not replace historical subsystem documentation or remappable hotkeys. */
import type {Locale} from '../i18n';
import type {Manual} from './editorManual';
import type {ReleaseGuide} from './editorReleaseGuide';

type Chapter={start:string;build:string;bsp:string;prefabs:string;resources:string;safety:string;chapters:[{title:string;description:string},{title:string;description:string},{title:string;description:string},{title:string;description:string}]};
const guide:Record<Locale,Chapter>={
 es:{
 start:'v2.0: Configuración de compilación separa Compiladores, Texturas, Destino y paquete, Recursos externos y Avanzado. Elegí Compilar en carpeta aislada, carpeta organizada, carpeta + ZIP o Instalar explícitamente. La carpeta del juego sirve para leer recursos: no autoriza a escribir allí.',
 build:'El MAP se compila en un espacio temporal. La distribución se guarda en la carpeta elegida; el BSP, WAD Smart, MAP fuente y registros se organizan fuera del juego. Abrir carpeta e Instalar en Sven Co-op aparecen al finalizar. La instalación es voluntaria, pide confirmación y rechaza reemplazar archivos diferentes. La compilación real requiere SC-CSG, SC-BSP, SC-VIS y SC-RAD del SDK.',
 bsp:'Editor BSP: Entidades modifica entidades puntuales compatibles; Caras permite Texture Studio, desplazamiento, giro y escala UV, WAD3 y exportación BSP compacta. Lightmap Studio modifica muestras RGB existentes sin recalcular sombras. Regiones agrupa superficies visibles, no recupera los brushes originales. Conservá una copia del BSP.',
 prefabs:'Estudios → Estudio de Prefabricados: elegí una carpeta de .svprefab, previsualizá objetos 3D, colocá en MAP y administrá la biblioteca interna. BSP Object Extractor ofrece sólidos completos, paneles aproximados y recuperación Hull 0 de submodelos; no promete restaurar brushes originales. Los prefabs pueden incluir WAD3; revisá dependencias y prepará el paquete antes de compilar.',
 resources:'Smart WAD reúne texturas realmente utilizadas, conserva mipmaps/paletas y puede crear un WAD externo o incrustarlas si es compatible. Recursos externos busca archivos en carpetas seleccionadas; Map Packager muestra dependencias faltantes y recursos no detectados. Los scripts dinámicos pueden requerir revisión manual.',
 safety:'Límites de v2.0: una vista previa no sustituye Sven Co-op real. Las transformaciones BSP pueden reproyectar iluminación aproximada; Hull 0 puede diferir en texturas y colisiones. Instalación limpia Windows, compilación nativa y proyectos complejos necesitan pruebas por separado.',
 chapters:[
 {title:'Smart Build 3.0 · salidas aisladas',description:'Compilá sin escribir en Sven Co-op; elegí carpeta, distribución o ZIP. Instalá el resultado terminado solamente con una acción explícita.'},
 {title:'Smart WAD y recursos externos',description:'Generá un WAD con texturas usadas y buscá modelos, sonidos, sprites, cielos y scripts en carpetas externas. Revisá faltantes en Map Packager.'},
 {title:'Editor BSP, superficies y lightmaps',description:'Inspeccioná entidades, caras, regiones, UV y luz compilada. Exportá una copia BSP; las colisiones y sombras no se reconstruyen automáticamente.'},
 {title:'Estudio de Prefabricados y extracción BSP',description:'Guardá, examiná y colocá prefabs .svprefab con WAD3. La recuperación Hull 0 es aproximada y debe validarse en el MAP y en Sven Co-op.'}]
 },
 en:{
 start:'v2.0: Build Configuration separates Compilers, Textures, Destination & Package, External Resources and Advanced. Choose isolated build, organized folder, folder + ZIP or explicit installation. The game folder is a read-only resource source unless you explicitly install.',
 build:'MAP compilation uses a temporary workspace. Distribution goes to the selected folder: BSP, Smart WAD, source MAP and logs remain outside the game. Open Folder and Install in Sven Co-op become available after a successful build. Installation is optional, asks for confirmation and blocks conflicting replacements. Native builds require the Sven Co-op SDK SC-CSG/SC-BSP/SC-VIS/SC-RAD tools.',
 bsp:'BSP Editor: Entities edits compatible point entities; Faces offers Texture Studio, UV translation/rotation/scale, WAD3 and compact BSP-copy export. Lightmap Studio adjusts existing RGB samples without recalculating shadows. Regions groups visible surfaces, not original brush identities. Keep an untouched BSP backup.',
 prefabs:'Studios → Prefab Studio: choose a .svprefab folder, preview 3D objects, place them in MAP and manage the internal library. BSP Object Extractor supports closed solids, approximate surface panels and Hull 0 submodel recovery; it cannot promise the original brushes. Prefabs may embed WAD3; review dependencies before compilation.',
 resources:'Smart WAD gathers only referenced textures, preserving palette and mipmaps, and can generate an external WAD or embed compatible textures. External Resources scans selected folders; Map Packager reports missing dependencies. Dynamically referenced scripts and files may require manual inspection.',
 safety:'v2.0 limitations: previews do not replace an actual Sven Co-op test. BSP UV edits can approximately resample existing lightmaps; recovered Hull 0 solids may differ in materials and collisions. A clean Windows install, native compilers and large maps still need separate testing.',
 chapters:[
 {title:'Smart Build 3.0 · isolated outputs',description:'Build without writing into Sven Co-op; select a folder, organized package or ZIP. Install finished output only through an explicit action.'},
 {title:'Smart WAD & external resources',description:'Pack only used textures and locate MDL, sound, sprites, sky assets and scripts in external folders. Review missing items in Map Packager.'},
 {title:'BSP Editor, surfaces & lightmaps',description:'Inspect entities, faces, regions, UVs and compiled lighting. Export a BSP copy; geometry collision and new shadows are not automatically rebuilt.'},
 {title:'Prefab Studio & BSP extraction',description:'Catalog, preview and place .svprefab with WAD3 dependencies. Hull 0 recovery is approximate and needs in-game verification.'}]
 },
 ru:{
 start:'v2.0: Настройки сборки разделены на Компиляторы, Текстуры, Папку и пакет, Внешние ресурсы и Дополнительно. Выберите изолированную сборку, папку, ZIP или явную установку. Папка игры предназначена для чтения ресурсов; запись выполняется только после выбора установки.',
 build:'MAP компилируется во временном каталоге. BSP, Smart WAD, исходный MAP и журналы сохраняются в выбранной папке вне игры. После сборки доступны «Открыть папку» и «Установить в Sven Co-op». Установка запрашивает подтверждение и блокирует конфликтующие файлы. Нужны инструменты SC-CSG/BSP/VIS/RAD из SDK.',
 bsp:'Редактор BSP: режим Сущности изменяет совместимые точечные объекты; Грани поддерживают Texture Studio, UV, WAD3 и экспорт компактной копии BSP. Lightmap Studio изменяет существующие RGB без пересчёта теней. Регионы объединяют видимые поверхности, но не восстанавливают исходные браши.',
 prefabs:'Студии → Студия префабов: выберите папку .svprefab, просматривайте модели в 3D и размещайте их в MAP. BSP Object Extractor поддерживает замкнутые тела, приблизительные панели и восстановление Hull 0; исходные браши не гарантируются. Проверяйте встроенные WAD3 и зависимости.',
 resources:'Smart WAD собирает используемые текстуры, сохраняя палитры и mipmaps, и создаёт отдельный WAD либо встроенные текстуры. Внешние ресурсы проверяют выбранные папки; Map Packager сообщает о недостающих файлах. Динамические ссылки скриптов проверяйте вручную.',
 safety:'Ограничения v2.0: предпросмотр не заменяет Sven Co-op. Изменение UV в BSP может приблизительно преобразовать lightmap; Hull 0 может изменить материалы и коллизии. Чистую установку Windows, настоящую компиляцию и большие карты нужно отдельно проверять.',
 chapters:[
 {title:'Smart Build 3.0 · изолированная сборка',description:'Компилируйте вне игры, выбирайте папку или ZIP. Установка результатов в Sven Co-op требует отдельного подтверждения.'},
 {title:'Smart WAD и внешние ресурсы',description:'Собирайте используемые текстуры, находите модели, звук, спрайты, небо и скрипты в сторонних папках. Проверяйте зависимости в Map Packager.'},
 {title:'Редактор BSP: поверхности и lightmaps',description:'Редактируйте совместимые сущности, UV и световые образцы. Экспортируйте копию BSP; коллизии и новые тени не пересчитываются автоматически.'},
 {title:'Префабы и извлечение объектов',description:'Просматривайте и размещайте .svprefab с WAD3. Восстановление Hull 0 приблизительное и требует проверки в игре.'}]
 },
 ko:{
 start:'v2.0: 빌드 설정이 컴파일러, 텍스처, 출력 및 패키지, 외부 리소스, 고급으로 나뉩니다. 독립 빌드, 정리된 폴더, ZIP 또는 명시적 설치를 선택하세요. 게임 폴더는 기본적으로 읽기 전용 리소스 출처입니다.',
 build:'MAP은 임시 작업 공간에서 컴파일됩니다. BSP, Smart WAD, 원본 MAP과 로그는 게임 밖의 선택한 폴더에 저장됩니다. 완료 후 폴더 열기와 Sven Co-op에 설치를 사용할 수 있습니다. 설치는 확인을 요구하며 다른 파일의 덮어쓰기를 차단합니다. 실제 빌드에는 SDK의 SC-CSG/BSP/VIS/RAD가 필요합니다.',
 bsp:'BSP 편집기: 엔티티 모드는 호환되는 점 엔티티를 수정하고, 면 모드는 Texture Studio, UV 이동/회전/배율, WAD3 및 압축 BSP 사본 내보내기를 지원합니다. Lightmap Studio는 기존 RGB 값만 수정하며 새 그림자는 계산하지 않습니다. 영역 선택은 원본 브러시를 복구하지 않습니다.',
 prefabs:'스튜디오 → 프리팹 스튜디오에서 .svprefab 폴더를 선택하고 3D 미리보기 후 MAP에 배치하세요. BSP 추출기는 닫힌 솔리드, 근사 패널 및 Hull 0 복원을 지원하지만 원래 브러시를 보장하지 않습니다. 포함된 WAD3와 종속 파일을 확인하세요.',
 resources:'Smart WAD는 실제 사용된 텍스처와 애니메이션 프레임을 모으고 팔레트/mipmap을 유지합니다. 외부 리소스는 선택한 폴더를 검색하며 Map Packager는 누락된 파일을 표시합니다. 스크립트의 동적 참조는 수동 점검이 필요할 수 있습니다.',
 safety:'v2.0 한계: 미리보기는 실제 Sven Co-op 테스트를 대체하지 않습니다. BSP UV 변경의 라이트맵 보정은 근사치이며 Hull 0 복원은 텍스처와 충돌이 달라질 수 있습니다. 깨끗한 Windows 설치와 실제 컴파일도 별도로 확인해야 합니다.',
 chapters:[
 {title:'Smart Build 3.0 · 독립 출력',description:'게임 폴더를 변경하지 않고 빌드하고 폴더나 ZIP으로 배포하세요. 설치할 때만 별도 확인을 요청합니다.'},
 {title:'Smart WAD 및 외부 리소스',description:'사용 중인 텍스처만 묶고 외부 폴더에서 MDL, 사운드, 스프라이트, 하늘 파일 및 스크립트를 검색합니다.'},
 {title:'BSP 편집기 · 면 및 라이트맵',description:'엔티티, 면, UV 및 기존 조명 데이터를 편집하고 BSP 사본을 내보냅니다. 충돌과 새 그림자는 자동 재계산되지 않습니다.'},
 {title:'프리팹 스튜디오 및 BSP 추출',description:'WAD3가 포함된 .svprefab을 관리하고 배치합니다. Hull 0 복원은 근사치이며 게임에서 확인해야 합니다.'}]
 },
 zh:{
 start:'v2.0：编译配置分为编译器、纹理、目标与打包、外部资源和高级设置。可选择隔离编译、整理文件夹、文件夹加 ZIP 或明确安装。游戏目录默认只作为资源来源，不会自动写入。',
 build:'MAP 在临时工作目录编译。BSP、Smart WAD、源 MAP 和日志保存在选定的游戏外文件夹。成功后可选择“打开文件夹”或“安装到 Sven Co-op”。安装需要确认，且阻止覆盖内容不同的文件。实际编译需 SDK 中的 SC-CSG/BSP/VIS/RAD。',
 bsp:'BSP 编辑器：实体模式可编辑兼容的点实体；表面模式提供 Texture Studio、UV 平移/旋转/缩放、WAD3 和压缩 BSP 副本导出。Lightmap Studio 调整已有 RGB 样本，不会生成新的阴影。区域选择并不恢复原始笔刷。',
 prefabs:'工作室 → 预制件工作室：选择 .svprefab 文件夹、3D 预览并放置到 MAP，管理内部库。BSP 对象提取支持封闭凸体、近似薄面和子模型 Hull 0 重建；不能保证恢复原始笔刷。请检查附带 WAD3 与资源依赖。',
 resources:'Smart WAD 仅收集地图实际引用的纹理及动画帧，保留调色板和 mipmap，可生成外部 WAD 或嵌入兼容纹理。外部资源可扫描选定文件夹；Map Packager 列出缺失文件。脚本动态引用可能需要人工检查。',
 safety:'v2.0 限制：预览不等于真正的 Sven Co-op 测试。BSP UV 变换会近似重采样光照贴图；Hull 0 的纹理和碰撞可能不同。全新 Windows 安装、真实编译器和大型地图仍需单独验证。',
 chapters:[
 {title:'Smart Build 3.0 · 隔离输出',description:'无需写入 Sven Co-op 即可编译，选择输出文件夹或 ZIP；安装游戏必须明确确认。'},
 {title:'Smart WAD 与外部资源',description:'只打包所用纹理，从外部文件夹寻找模型、声音、精灵、天空与脚本，在 Map Packager 检查缺失项。'},
 {title:'BSP 编辑器、表面与光照贴图',description:'检查实体、UV 和已有光照数据并导出 BSP 副本；不会自动重建碰撞和新阴影。'},
 {title:'预制件工作室与 BSP 提取',description:'管理、预览和放置带 WAD3 的 .svprefab；Hull 0 为近似重建，需在游戏中验证。'}]
 },
 pt:{
 start:'v2.0: Configuração de compilação separa Compiladores, Texturas, Destino e pacote, Recursos externos e Avançado. Escolha compilação isolada, pasta organizada, pasta + ZIP ou instalação explícita. A pasta do jogo é fonte de recursos, não um destino automático.',
 build:'O MAP é compilado em uma área temporária. BSP, Smart WAD, MAP original e logs ficam na pasta escolhida fora do jogo. Depois aparecem Abrir pasta e Instalar no Sven Co-op. A instalação exige confirmação e rejeita a substituição de arquivos diferentes. A compilação nativa exige SC-CSG/BSP/VIS/RAD do SDK.',
 bsp:'Editor BSP: Entidades altera entidades pontuais compatíveis; Faces oferece Texture Studio, deslocamento, rotação e escala UV, WAD3 e exportação compacta de cópia BSP. Lightmap Studio altera amostras RGB existentes, sem recalcular sombras. Regiões não recuperam os brushes originais.',
 prefabs:'Estúdios → Estúdio de Prefabricados: escolha uma pasta .svprefab, visualize objetos 3D, coloque no MAP e gerencie a biblioteca interna. BSP Object Extractor permite sólidos fechados, painéis aproximados e recuperação Hull 0; não garante brushes originais. Confira WAD3 e dependências.',
 resources:'Smart WAD reúne apenas texturas usadas, preservando paletas e mipmaps, e pode criar WAD externo ou incorporar texturas compatíveis. Recursos externos verifica pastas escolhidas; Map Packager mostra arquivos ausentes. Referências dinâmicas de scripts podem exigir inspeção manual.',
 safety:'Limites da v2.0: a prévia não substitui o teste real no Sven Co-op. Alterações UV em BSP podem reamostrar lightmaps aproximadamente; Hull 0 pode mudar materiais e colisões. Testes em Windows limpo, compiladores nativos e mapas grandes continuam necessários.',
 chapters:[
 {title:'Smart Build 3.0 · saídas isoladas',description:'Compile fora do jogo, escolha pasta ou ZIP e instale no Sven Co-op somente após confirmação explícita.'},
 {title:'Smart WAD e recursos externos',description:'Empacote apenas texturas usadas e procure modelos, sons, sprites, céus e scripts em pastas externas. Veja ausências no Map Packager.'},
 {title:'Editor BSP, superfícies e lightmaps',description:'Edite entidades compatíveis, UV e luz compilada e exporte cópia BSP. Colisões e sombras novas não são recalculadas.'},
 {title:'Estúdio de Prefabs e extração BSP',description:'Gerencie e coloque .svprefab com WAD3. A recuperação Hull 0 é aproximada e precisa de teste no jogo.'}]
 }
};
export function updateManualForV2(locale:Locale,manual:Manual):Manual{
 const g=guide[locale];
 return {...manual,
  first:[...manual.first.slice(0,3),g.start],
  technical:[...manual.technical.slice(0,2),g.build,g.resources,g.safety],
  studios:[...manual.studios,
   {title:locale==='es'?'Editor BSP y Lightmap Studio':'BSP Editor / Lightmap Studio',description:g.bsp},
   {title:locale==='es'?'Estudio de Prefabricados':'Prefab Studio',description:g.prefabs},
   {title:'Smart Build 3.0 / Map Packager',description:g.resources}]
 };
}
export function updateReleaseGuideForV2(locale:Locale,release:ReleaseGuide):ReleaseGuide{
 return {...release,cards:[...guide[locale].chapters,...release.cards]};
}

export const v2StudioFeatureList=(locale:Locale):string[]=>guide[locale].chapters.map(c=>`${c.title}: ${c.description}`);
