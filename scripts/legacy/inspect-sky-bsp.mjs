import {inspectBspFile} from '../server/bspAudit.js';
import path from 'node:path';
const file=process.argv[2];
if(!file){console.error('Uso: node scripts/inspect-sky-bsp.mjs ruta/al/mapa.bsp');process.exit(2)}
try{console.log(JSON.stringify({file:path.resolve(file),...await inspectBspFile(file)},null,2))}
catch(e){console.error(e.message);process.exit(1)}
