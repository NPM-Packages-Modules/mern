export type CronTask = () => void | Promise<void>;
export interface CronReg { name: string; schedule: "daily"|"hourly"|"manual"; timezone?: string; run: CronTask }
export class CronMesh { private t: CronReg[] = []; daily(n:string,r:CronTask,tz?:string){this.t.push({name:n,schedule:"daily",timezone:tz,run:r});return this}
hourly(n:string,r:CronTask){this.t.push({name:n,schedule:"hourly",run:r});return this} list(){return this.t}}
export const cronmesh = () => new CronMesh();
