/** Test helper: real TypeScript when installed, otherwise a small esbuild-based shim.
 * The portable edition ships esbuild (Vite) but not TypeScript, so regression tests that
 * only need transpileModule/createSourceFile keep running offline.
 * Tests that walk the TypeScript AST check `ts.hasAst` and skip without the real compiler.
 */
'use strict';
let real=null;
try{real=require('typescript');}catch{/* not installed: use the shim */}

if(real){
  real.hasAst=true;
  module.exports=real;
}else{
  const esbuild=require('esbuild');
  const ModuleKind={None:0,CommonJS:1,AMD:2,UMD:3,System:4,ES2015:5,ES2020:6,ES2022:7,ESNext:99,Node16:100,NodeNext:199};
  const ScriptTarget={ES3:0,ES5:1,ES2015:2,ES2016:3,ES2017:4,ES2018:5,ES2019:6,ES2020:7,ES2021:8,ES2022:9,ESNext:99,Latest:99};
  const ScriptKind={Unknown:0,JS:1,JSX:2,TS:3,TSX:4,External:5,JSON:6};
  const JsxEmit={None:0,Preserve:1,React:2,ReactNative:3,ReactJSX:4,ReactJSXDev:5};
  const DiagnosticCategory={Warning:0,Error:1,Suggestion:2,Message:3};
  const loaderFor=(fileName='',kind)=>kind===ScriptKind.TSX||/\.tsx$/i.test(fileName)?'tsx':kind===ScriptKind.JSX||/\.jsx$/i.test(fileName)?'jsx':/\.m?js$/i.test(fileName)?'js':'ts';
  const diagnosticsFrom=error=>(error?.errors||[{text:String(error?.message||error)}]).map(e=>({category:DiagnosticCategory.Error,messageText:e.text,start:0,length:0,file:undefined}));
  function transpileModule(source,options={}){
    const compilerOptions=options.compilerOptions||{};
    const esm=[ModuleKind.ES2015,ModuleKind.ES2020,ModuleKind.ES2022,ModuleKind.ESNext].includes(compilerOptions.module);
    // ModuleKind.None: plain script (top-level declarations stay global), no module conversion.
    const plain=compilerOptions.module===ModuleKind.None;
    const result=esbuild.transformSync(source,{loader:loaderFor(options.fileName),...(plain?{}:{format:esm?'esm':'cjs'}),target:'es2022',jsx:'automatic',sourcefile:options.fileName||'module.ts',logLevel:'silent'});
    // Match tsc output conventions the tests rely on: single-quoted module specifiers...
    // tsc keeps the source quotes in ESM imports (the project uses '...') and emits require("...") in CommonJS.
    let code=esm||plain
      ?result.code.replace(/((?:\bfrom|\bimport)\s*\(?\s*)"([^"\n]+)"/g,"$1'$2'")
      :result.code.replace(/\brequire\(\s*'([^'\n]+)'\s*\)/g,'require("$1")');
    // ...and CommonJS that fills the caller's `exports` (esbuild reassigns module.exports).
    if(!esm&&!plain)code=`(function(){var __m={exports:{}};(function(module,exports){${code}\n})(__m,__m.exports);`+
      `var __t=typeof exports!=='undefined'?exports:(typeof module!=='undefined'?module.exports:null);`+
      `if(__t)Object.assign(__t,__m.exports);if(typeof module!=='undefined'&&module.exports&&module.exports!==__t)Object.assign(module.exports,__m.exports);})();`;
    return {outputText:code,diagnostics:[],sourceMapText:undefined};
  }
  function createSourceFile(fileName,text,_target,_setParents,kind){
    let parseDiagnostics=[];
    try{esbuild.transformSync(text,{loader:loaderFor(fileName,kind),sourcefile:fileName,logLevel:'silent'});}
    catch(error){parseDiagnostics=diagnosticsFrom(error);}
    return {fileName,text,parseDiagnostics,statements:[]};
  }
  const flattenDiagnosticMessageText=(message)=>typeof message==='string'?message:String(message?.messageText??message);
  module.exports={hasAst:false,ModuleKind,ScriptTarget,ScriptKind,JsxEmit,DiagnosticCategory,transpileModule,createSourceFile,flattenDiagnosticMessageText};
}
