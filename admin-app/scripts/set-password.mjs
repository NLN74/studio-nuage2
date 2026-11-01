import {writeFile,chmod} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {hashPassword} from '../auth.mjs';
async function secret(){
 if(!process.stdin.isTTY){let value='';for await(const part of process.stdin)value+=part;if(value.length>2048)throw Error('Saisie trop longue.');return value.replace(/[\r\n]+$/,'')}
 process.stdout.write('Nouveau mot de passe (saisie masquée) : ');process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
 return new Promise((resolve,reject)=>{let value='';const done=()=>{process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n')};const onData=chunk=>{for(const c of chunk){if(c==='\u0003'){done();reject(Error('Opération annulée.'));return}if(c==='\r'||c==='\n'){done();resolve(value);return}if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else value+=c}};process.stdin.on('data',onData)});
}
try{const passwordHash=await hashPassword(await secret()),file=fileURLToPath(new URL('../.local-access.json',import.meta.url));await writeFile(file,JSON.stringify({version:1,passwordHash},null,2),{mode:0o600});await chmod(file,0o600);process.stdout.write('Accès configuré. Redémarrez le serveur si nécessaire.\n')}catch(e){process.stderr.write(e.message+'\n');process.exitCode=1}
