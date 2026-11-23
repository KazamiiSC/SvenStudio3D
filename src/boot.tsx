import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {restoreOnLaunch,startRecoveryAutosave} from './engine/sessionManager';
import {startProjectHistoryAutosave} from './engine/projectHistory';
import {ErrorBoundary} from './components/ErrorBoundary';
import {loadLocale} from './i18n';
import {useEditor} from './store';
import {startSaveTracking} from './engine/saveState';
import {startDesktopShell} from './desktopShell';
import {startSharedPreferencesSync} from './engine/sharedSettings';
/** Editor start-up. Imported by main.tsx after shared preferences reach localStorage. */
export async function bootstrap(){
  const root=document.getElementById('root');if(!root)throw Error('Missing #root');
  try{await restoreOnLaunch();}catch(error){console.warn('Recovery unavailable:',error);}
  // Load the active language before the first paint so the UI never flashes English.
  await loadLocale(useEditor.getState().locale);
  startRecoveryAutosave();
  startSaveTracking(useEditor);
  startProjectHistoryAutosave();
  createRoot(root!).render(<ErrorBoundary label="SvenStudio 3D"><App/></ErrorBoundary>);
  startDesktopShell();
  startSharedPreferencesSync();
}
