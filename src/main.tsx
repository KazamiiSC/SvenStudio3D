/** Entry point. Shared preferences (Documents/SvenStudio3D/settings.json) are written to
 * localStorage first; only then are the editor modules loaded, because their stores read
 * localStorage when they are created. */
import {applySharedPreferences} from './engine/sharedSettings';
async function start(){
  await applySharedPreferences();
  const {bootstrap}=await import('./boot');
  await bootstrap();
}
void start();
