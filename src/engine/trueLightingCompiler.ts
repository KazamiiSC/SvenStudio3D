import type {Settings} from '../store';
/** Identity of a temporary lighting bake. Pure: no filesystem or renderer state.
 * Paths and SDHLRAD options matter; presentation gamma, fog and UI layout do not. */
export function lightingCompilerKey(settings:Pick<Settings,'compilerEngine'|'compilerDir'|'sdhltDir'|'sdhltAO'|'sdhltPCF'|'radAmbientTest'>):string{
  return settings.compilerEngine==='sdhlt'
    ?JSON.stringify(['sdhlt',settings.sdhltDir||'',!!settings.sdhltAO,settings.sdhltPCF||'off'])
    :JSON.stringify(['sc',settings.compilerDir||'']);
}
export function lightingCompilerLabel(engine:Settings['compilerEngine']):'SC-RAD'|'SDHLT'{return engine==='sdhlt'?'SDHLT':'SC-RAD';}
