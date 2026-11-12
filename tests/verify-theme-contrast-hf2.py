"""Optional browser audit for the theme HF2 contrast fixture.
Requires: pip install playwright and a local Chromium executable.
Does not launch Sven Co-op, Vite, or access game files.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os

base = Path(__file__).resolve().parents[1]
html = (base / 'tests/interface-theme-hf2-fixture.html').read_text(encoding='utf-8')
for name in ['style.css', 'uiPreview2.css', 'interfaceThemes.css', 'interfaceThemeFixes.css']:
    html = html.replace(f'<link rel="stylesheet" href="../src/{name}">',
                        '<style>' + (base / 'src' / name).read_text(encoding='utf-8') + '</style>')

contrast_scan = r'''() => {
  const rgb=(s)=>{const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return null;
    const v=m[1].split(',').map(x=>parseFloat(x));return [...v.slice(0,3),v[3]===undefined?1:v[3]];};
  const luminance=(v)=>v.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;})
    .reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
  return [...document.querySelectorAll('#fixture-grid *')]
    .filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.nodeValue.trim()))
    .map(e=>{
      let fg=rgb(getComputedStyle(e).color),bg=null,parent=e;
      while(parent){const candidate=rgb(getComputedStyle(parent).backgroundColor);
        if(candidate&&candidate[3]>=.98){bg=candidate;break;} parent=parent.parentElement;}
      bg??=[255,255,255,1]; const a=luminance(fg),b=luminance(bg);
      return {text:e.textContent.trim().slice(0,46),ratio:Math.round((Math.max(a,b)+.05)/(Math.min(a,b)+.05)*100)/100};
    }).filter(x=>x.ratio<4.5);
}'''

themes = ['modern', 'win98', 'cyber', 'goldsrc', 'xp', 'midnight']
sizes = [(1366, 768), (1024, 768), (800, 900)]
failures = []
with sync_playwright() as p:
    chrome = os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium')
    browser = p.chromium.launch(headless=True, executable_path=chrome, args=['--no-sandbox','--disable-gpu'])
    page = browser.new_page(viewport={'width': 1366, 'height': 768})
    page.set_content(html)
    for theme in themes:
        page.evaluate('(theme)=>{document.documentElement.dataset.svenTheme=theme;document.documentElement.dataset.svenAccent="ice";}', theme)
        for width, height in sizes:
            page.set_viewport_size({'width':width,'height':height})
            issues=page.evaluate(contrast_scan)
            overflow=page.evaluate('document.documentElement.scrollWidth>window.innerWidth+2')
            if issues: failures.append(f'{theme} {width}px: {issues}')
            if overflow: failures.append(f'{theme} {width}px: page horizontal overflow')
            print(f'{theme:8} {width}x{height}: {len(issues)} low-contrast text nodes; overflow={overflow}')
    # Portaled Texture Studio must not eclipse an exclusive NPC modal.
    page.evaluate("document.body.insertAdjacentHTML('beforeend','<div class=\"npc-backdrop\"></div>')")
    hidden=page.evaluate("getComputedStyle(document.querySelector('.texture-studio-floating')).visibility")
    if hidden!='hidden': failures.append(f'UV palette remains visible over NPC modal: {hidden}')
    page.evaluate("document.querySelector('.npc-backdrop').remove()")
    restored=page.evaluate("getComputedStyle(document.querySelector('.texture-studio-floating')).visibility")
    if restored!='visible': failures.append(f'UV palette not restored: {restored}')
    browser.close()
print('Contrast fixture audit:', 'PASS' if not failures else 'FAIL')
for problem in failures:print('ERROR',problem)
raise SystemExit(1 if failures else 0)
