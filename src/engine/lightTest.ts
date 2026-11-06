import type {RadAmbientTest} from '../store';
export function lightTestMapName(name:string,option:RadAmbientTest):string{
 if(option==='off')return name;
 const ending={'0.08':'08','0.15':'15','0.25':'25'}[option];
 if(!ending)throw Error('Unsupported light test option');
 const candidate=`${name}_light${ending}`;
 if(candidate.length>64)throw Error('Diagnostic map name exceeds 64 characters');
 return candidate;
}
