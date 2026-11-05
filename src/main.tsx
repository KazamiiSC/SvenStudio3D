import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {restoreOnLaunch,startRecoveryAutosave} from './engine/sessionManager';
import {ErrorBoundary} from './components/ErrorBoundary';
const root=document.getElementById('root');if(!root)throw Error('Missing #root');
async function bootstrap(){
  try{await restoreOnLaunch();}catch(error){console.warn('Recovery unavailable:',error);}
  startRecoveryAutosave();
  createRoot(root!).render(<ErrorBoundary label="SvenStudio 3D"><App/></ErrorBoundary>);
}
void bootstrap();
