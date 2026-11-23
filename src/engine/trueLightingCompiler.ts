import type {Settings} from '../store';
/** Identity of a temporary lighting bake. Pure: no filesystem or renderer state.
 * Paths and SDHLRAD options matter; presentation gamma, fog and UI layout do not. */
export function lightingCompilerKey(settings:Pick<Settings,'compilerEngine'|'compilerDir'|'sdhltDir'|'sdhltAO'|'sdhltPCF'|'radAmbientTest'>):string{
  if(settings.compilerEngine==='zhlt')return JSON.stringify(['zhlt',settings.compilerDir||'']);
  return settings.compilerEngine==='sdhlt'
    ?JSON.stringify(['sdhlt',settings.sdhltDir||'',!!settings.sdhltAO,settings.sdhltPCF||'off'])
    :JSON.stringify(['sc',settings.compilerDir||'']);
}
export function lightingCompilerLabel(engine:Settings['compilerEngine']):'SC-RAD'|'SDHLT'|'ZHLT'{return engine==='zhlt'?'ZHLT':engine==='sdhlt'?'SDHLT':'SC-RAD';}
