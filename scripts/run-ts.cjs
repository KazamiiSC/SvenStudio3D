/** Node-only development runner for TS utilities. Avoids native esbuild/Vite binary dependency. */
const fs=require('node:fs');const ts=require('typescript');const path=require('node:path');
require.extensions['.ts']=(mod,file)=>{const code=fs.readFileSync(file,'utf8');const out=ts.transpileModule(code,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;mod._compile(out,file)};
require(path.resolve(process.argv[2]));
