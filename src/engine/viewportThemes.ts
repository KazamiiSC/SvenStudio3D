/** v2.6 3D viewport display styles: background gradient and grid colours (editor look only). */
export type ViewportThemeId='classic'|'studio'|'neutral'|'light'|'obsidian'|'midnight'|'blueprint'|'sunset'|'forest'|'paper'|'matrix';
export type ViewportTheme={id:ViewportThemeId;label:string;top:string;bottom:string;grid:string;gridMinor:string;axis?:string};
export const VIEWPORT_THEMES:ViewportTheme[]=[
  {id:'classic',label:'Classic',top:'#0b1325',bottom:'#0b1325',grid:'#57799a',gridMinor:'#30445c'},
  {id:'studio',label:'Studio',top:'#4b5058',bottom:'#22252a',grid:'#8a929c',gridMinor:'#4c525a'},
  {id:'neutral',label:'Neutral',top:'#3c3f44',bottom:'#3c3f44',grid:'#6f747b',gridMinor:'#4b4f55'},
  {id:'light',label:'Bright',top:'#e4e8ee',bottom:'#b9c1cc',grid:'#7d8794',gridMinor:'#a6afba'},
  {id:'obsidian',label:'Obsidian',top:'#121117',bottom:'#050507',grid:'#5a4f73',gridMinor:'#26212f'},
  {id:'midnight',label:'Midnight blue',top:'#16264a',bottom:'#04070f',grid:'#4f6fa8',gridMinor:'#1f2c48'},
  {id:'blueprint',label:'Blueprint',top:'#174a7c',bottom:'#0d3157',grid:'#9cc8f2',gridMinor:'#3f73a6'},
  {id:'sunset',label:'Sunset',top:'#3b2a4a',bottom:'#b8664a',grid:'#e3a37c',gridMinor:'#6a4a5c'},
  {id:'forest',label:'Forest',top:'#1f2f27',bottom:'#0c1410',grid:'#6c8f74',gridMinor:'#2c3d33'},
  {id:'paper',label:'Paper',top:'#f1ebdd',bottom:'#ddd3bd',grid:'#a08d6a',gridMinor:'#cbbd9f'},
  {id:'matrix',label:'Terminal green',top:'#020804',bottom:'#000000',grid:'#2fbf5a',gridMinor:'#0c3a1a'},
];
export const viewportTheme=(id:string|undefined)=>VIEWPORT_THEMES.find(t=>t.id===id)??VIEWPORT_THEMES[0];
export const isViewportThemeId=(v:unknown):v is ViewportThemeId=>typeof v==='string'&&VIEWPORT_THEMES.some(t=>t.id===v);
