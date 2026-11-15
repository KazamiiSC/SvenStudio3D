/** Test-only Node 22 ESM resolver for the existing Vite-style TypeScript imports.
 * Production Vite/React code is unaffected. Avoid adding a bundler dependency
 * to the regression runner; preserve extensionless imports in the real source.
 */
export async function resolve(specifier,context,nextResolve){
  try{return await nextResolve(specifier,context)}
  catch(error){
    if(error.code!=='ERR_MODULE_NOT_FOUND'||!specifier.startsWith('.'))throw error;
    for(const extension of ['.ts','.tsx','.js']){
      try{return await nextResolve(specifier+extension,context)}
      catch(nextError){if(nextError.code!=='ERR_MODULE_NOT_FOUND')throw nextError}
    }
    throw error;
  }
}
