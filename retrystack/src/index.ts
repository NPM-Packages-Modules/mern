export interface RO { maxAttempts?: number; initialDelayMs?: number; factor?: number; maxDelayMs?: number; jitter?: boolean }
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export async function retrystack<T>(fn: ()=>Promise<T>, opts: RO={}): Promise<T> {
const max=opts.maxAttempts??4; let delay=opts.initialDelayMs??100; const fac=opts.factor??2; const cap=opts.maxDelayMs??30000; let last: unknown;
for(let i=0;i<max;i++){ try{return await fn();}catch(e){last=e;if(i===max-1)throw e; const j=opts.jitter?delay*(0.5+Math.random()/2):delay; await sleep(Math.min(cap,j)); delay=Math.min(cap,delay*fac);} }
throw last;
}
