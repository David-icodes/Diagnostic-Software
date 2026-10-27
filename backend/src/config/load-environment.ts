import {config} from 'dotenv';
import path from 'node:path';
/** Resolve from the backend module, never the launcher's working directory. Existing injected values win. */
export function loadEnvironment(file=process.env.DOTENV_CONFIG_PATH??path.resolve(__dirname,'../../.env')) {
  const result=config({path:file,override:false});
  if(result.error&&(result.error as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('Backend environment file could not be loaded.');
}
