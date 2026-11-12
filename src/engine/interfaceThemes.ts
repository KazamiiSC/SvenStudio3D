/** Interface-only visual skins. These never change MAP/BSP data or Three.js rendering. */
export const INTERFACE_THEMES=['modern','win98','cyber','goldsrc','xp','midnight'] as const;
export type InterfaceTheme=typeof INTERFACE_THEMES[number];
export const DEFAULT_INTERFACE_THEME:InterfaceTheme='modern';
export const INTERFACE_THEME_NAMES:Record<InterfaceTheme,string>={
  modern:'Modern Dark',win98:'Windows 98',cyber:'Cyber Neon',
  goldsrc:'GoldSrc Workshop',xp:'Windows XP',midnight:'Midnight Minimal'
};
export function normalizeInterfaceTheme(value:unknown):InterfaceTheme{
  return typeof value==='string'&&(INTERFACE_THEMES as readonly string[]).includes(value)
    ?value as InterfaceTheme:DEFAULT_INTERFACE_THEME;
}
export const INTERFACE_THEME_SWATCHES:Record<InterfaceTheme,{bg:string,panel:string,accent:string,text:string}>={
  modern:{bg:'#101b2e',panel:'#233751',accent:'#4fbbe4',text:'#eaf3ff'},
  win98:{bg:'#c0c0c0',panel:'#d4d0c8',accent:'#000080',text:'#121212'},
  cyber:{bg:'#061723',panel:'#0b2939',accent:'#00e1ef',text:'#e7fbff'},
  goldsrc:{bg:'#252b24',panel:'#343e31',accent:'#a7bf7b',text:'#e5ecd9'},
  xp:{bg:'#c6daf3',panel:'#f0f5ff',accent:'#2674bf',text:'#182b4c'},
  midnight:{bg:'#080b10',panel:'#161c24',accent:'#8194a9',text:'#e9edf2'}
};
export type ThemeLanguage='es'|'en'|'ru'|'ko'|'zh'|'pt';
const themeCopy={
 es:{heading:'Tema de interfaz',subtitle:'Cambia el estilo de todas las herramientas, menús y ventanas sin modificar el mapa.',modern:'Profesional y equilibrado',win98:'Ventanas y botones clásicos',cyber:'Tecnología con detalles luminosos',goldsrc:'Herramientas industriales compactas',xp:'Estilo clásico azul',midnight:'Mínimo contraste decorativo'},
 en:{heading:'Interface theme',subtitle:'Restyle tools, menus and dialogs without changing the map.',modern:'Professional and balanced',win98:'Classic windows and controls',cyber:'Technology with luminous details',goldsrc:'Compact industrial tools',xp:'Classic blue styling',midnight:'Minimal visual decoration'},
 ru:{heading:'Тема интерфейса',subtitle:'Изменяет инструменты, меню и окна, не затрагивая карту.',modern:'Современная и сбалансированная',win98:'Классические окна и кнопки',cyber:'Неоновые детали',goldsrc:'Компактный индустриальный стиль',xp:'Классический синий стиль',midnight:'Минималистичное оформление'},
 ko:{heading:'인터페이스 테마',subtitle:'맵을 변경하지 않고 도구, 메뉴, 창의 디자인을 바꿉니다.',modern:'현대적이고 균형 잡힌 디자인',win98:'클래식 창과 버튼',cyber:'네온 디테일',goldsrc:'산업적인 압축형 디자인',xp:'클래식 블루 디자인',midnight:'최소한의 장식'},
 zh:{heading:'界面主题',subtitle:'更改工具、菜单和窗口的外观，不会影响地图。',modern:'专业且均衡',win98:'经典窗口和按钮',cyber:'霓虹科技风格',goldsrc:'紧凑的工业风格',xp:'经典蓝色风格',midnight:'极简装饰'},
 pt:{heading:'Tema da interface',subtitle:'Muda o visual das ferramentas, menus e janelas sem alterar o mapa.',modern:'Profissional e equilibrado',win98:'Janelas e botões clássicos',cyber:'Detalhes luminosos',goldsrc:'Ferramentas industriais compactas',xp:'Visual azul clássico',midnight:'Decoração mínima'}
} as const;
export function interfaceThemeCopy(lang:ThemeLanguage){return themeCopy[lang]??themeCopy.en;}
