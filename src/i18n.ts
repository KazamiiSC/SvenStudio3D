/** UI strings only. Never translate game classnames, keys, WAD texture names or FGD data.
 * Each language lives in src/locales/<lang>.json and is loaded on demand, so the
 * editor bundle no longer carries every translation. English keys are the source text.
 */
import {useCallback,useEffect,useSyncExternalStore} from 'react';
import {useEditor} from './store';
import en from './locales/en.json';
export type Locale = 'es'|'en'|'ru'|'ko'|'zh'|'pt';
export type LocalePreference = Locale|'auto';

const STORAGE_KEY = 'svenstudio-locale';
const supported = new Set<string>(['es','en','ru','ko','zh','pt']);

/** Honor the browser/OS language priority; unsupported languages fall back to English. */
export function detectSystemLocale(languages:readonly string[]):Locale {
  for (const entry of languages) {
    const primary = String(entry || '').trim().replace('_','-').split('-')[0]?.toLowerCase();
    if (supported.has(primary)) return primary as Locale;
  }
  return 'en';
}

export function systemLocale():Locale {
  try {
    if (typeof navigator === 'undefined') return 'en';
    const languages = Array.isArray(navigator.languages) && navigator.languages.length
      ? [...navigator.languages] : [navigator.language];
    return detectSystemLocale(languages);
  } catch { return 'en'; }
}

/** Old saved explicit locales remain valid; no preference means automatic. */
export function readLocalePreference():LocalePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && supported.has(saved) ? saved as Locale : 'auto';
  } catch { return 'auto'; }
}

export function preferredLocale():Locale {
  const selected = readLocalePreference();
  return selected === 'auto' ? systemLocale() : selected;
}

export function saveLocalePreference(selected:LocalePreference):void {
  try {
    if (selected === 'auto') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, selected);
  } catch { /* The language still changes for this session if storage is blocked. */ }
}


export const LANGUAGES:{id:Locale;label:string}[]=[
  {id:'es',label:'Español'},{id:'en',label:'English'},{id:'ru',label:'Русский'},{id:'ko',label:'한국어'},{id:'zh',label:'简体中文'},{id:'pt',label:'Português (Brasil)'}
];

type Dictionary=Record<string,string>;
const dictionaries:Partial<Record<Locale,Dictionary>>={en};
const loaders:Record<Exclude<Locale,'en'>,()=>Promise<{default:Dictionary}>>={
  es:()=>import('./locales/es.json'),ru:()=>import('./locales/ru.json'),ko:()=>import('./locales/ko.json'),
  zh:()=>import('./locales/zh.json'),pt:()=>import('./locales/pt.json'),
};
const pending=new Map<Locale,Promise<void>>();
const listeners=new Set<()=>void>();
let version=0;
/** Load a language once; components re-render when it arrives. */
export function loadLocale(locale:Locale):Promise<void>{
  if(dictionaries[locale])return Promise.resolve();
  const existing=pending.get(locale);if(existing)return existing;
  const job=loaders[locale as Exclude<Locale,'en'>]().then(module=>{
    dictionaries[locale]=module.default;version++;listeners.forEach(listener=>listener());
  }).catch(error=>{pending.delete(locale);console.warn(`Cannot load ${locale} translations:`,error);});
  pending.set(locale,job);return job;
}
export function translate(locale:Locale,key:string):string{return dictionaries[locale]?.[key]??dictionaries.en?.[key]??key}
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}};
// Keep the translator stable while the language is unchanged. Effects depending
// on useT() must not fire after every local state update (e.g. model scans).
export function useT(){
  const locale=useEditor(s=>s.locale);
  const loaded=useSyncExternalStore(subscribe,()=>version);
  useEffect(()=>{void loadLocale(locale)},[locale]);
  return useCallback((key:string)=>translate(locale,key),[locale,loaded]);
}