export interface SMDef<S extends string, E extends string> { initial: S; transitions: Record<S, Partial<Record<E, S>>>; }
export class StateMesh<S extends string, E extends string> {
constructor(private def: SMDef<S,E>, private st: S) {}
get state(){return this.st}
async send(ev: E){ const next=this.def.transitions[this.st]?.[ev]; if(!next)throw new Error("statemesh: illegal "+ev); this.st=next; }
}
export const statemesh = <S extends string, E extends string>(d: SMDef<S,E>) => new StateMesh(d, d.initial);
