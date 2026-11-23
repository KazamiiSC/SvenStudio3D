/** Test helper: source text of a top-level `function name(...)` without a TypeScript AST.
 * Skips strings, template literals and comments while matching parentheses and braces.
 */
'use strict';
function skipLiteral(src,i){
  const quote=src[i];
  if(quote==='/'&&src[i+1]==='/'){const end=src.indexOf('\n',i);return end<0?src.length:end;}
  if(quote==='/'&&src[i+1]==='*'){const end=src.indexOf('*/',i+2);return end<0?src.length:end+2;}
  if(quote!=='"'&&quote!=="'"&&quote!=='`')return -1;
  for(let j=i+1;j<src.length;j++){
    if(src[j]==='\\'){j++;continue;}
    if(quote==='`'&&src[j]==='$'&&src[j+1]==='{'){j=matchBlock(src,j+1,'{','}');continue;}
    if(src[j]===quote)return j+1;
  }
  return src.length;
}
function matchBlock(src,start,open,close){
  let depth=0;
  for(let i=start;i<src.length;){
    const skipped=skipLiteral(src,i);
    if(skipped>=0){i=skipped;continue;}
    if(src[i]===open)depth++;
    else if(src[i]===close&&--depth===0)return i;
    i++;
  }
  throw Error('Unbalanced source.');
}
function extractFunction(src,name){
  const match=new RegExp(`(?:export\\s+)?function\\s+${name}\\s*(?:<[^>]*>)?\\s*\\(`).exec(src);
  if(!match)return null;
  const paramsEnd=matchBlock(src,match.index+match[0].length-1,'(',')');
  const bodyStart=src.indexOf('{',paramsEnd);
  // A return type annotation may itself contain braces: `): {a:number} {`
  let open=bodyStart;
  const between=src.slice(paramsEnd+1,bodyStart).trim();
  if(between.startsWith(':')&&/^:\s*$/.test(between)){open=matchBlock(src,bodyStart,'{','}')+1;open=src.indexOf('{',open);}
  const end=matchBlock(src,open,'{','}');
  return src.slice(match.index,end+1);
}
module.exports={extractFunction};
