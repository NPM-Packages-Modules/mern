export interface TO { retries?: number; delayMs?: (n:number)=>number }
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export async function transactly<T>(work: ()=>Promise<T>, opts?: TO): Promise<T> {
const retries=opts?.retries??2, d=opts?.delayMs??(n=>50*n); let last: unknown;
for(let i=0;i<=retries;i++){ try { return await work(); } catch(e){ last=e; if(i===retries)throw e; await sleep(d(i+1)); } } throw last; }
