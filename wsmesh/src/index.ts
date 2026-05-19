/** Room + presence registry — wire to your WebSocket server `send(clientId, payload)`. */
export class WsMesh {
  private readonly rooms = new Map<string, Set<string>>();
  private readonly clientRooms = new Map<string, Set<string>>();

  /** Subscribe `clientId` to `room`. */
  join(room: string, clientId: string): void {
    if (!this.rooms.has(room)) this.rooms.set(room, new Set());
    this.rooms.get(room)!.add(clientId);
    if (!this.clientRooms.has(clientId)) this.clientRooms.set(clientId, new Set());
    this.clientRooms.get(clientId)!.add(room);
  }

  /** Remove `clientId` from one room. */
  leave(room: string, clientId: string): void {
    this.rooms.get(room)?.delete(clientId);
    this.clientRooms.get(clientId)?.delete(room);
    this.cleanupRoom(room);
    if (this.clientRooms.get(clientId)?.size === 0) this.clientRooms.delete(clientId);
  }

  /** Remove `clientId` from every room (disconnect / reconnect). */
  leaveAll(clientId: string): void {
    const rs = this.clientRooms.get(clientId);
    if (!rs) return;
    for (const room of [...rs]) {
      this.rooms.get(room)?.delete(clientId);
      this.cleanupRoom(room);
    }
    this.clientRooms.delete(clientId);
  }

  members(room: string): string[] {
    return [...(this.rooms.get(room) ?? [])];
  }

  countInRoom(room: string): number {
    return this.rooms.get(room)?.size ?? 0;
  }

  /** Clients with at least one room membership */
  connectedClients(): number {
    return this.clientRooms.size;
  }

  channel(room: string) {
    return {
      name: room,
      /** Invoke `deliver` for every member in room */
      each: (deliver: (clientId: string) => void) => {
        for (const id of this.members(room)) deliver(id);
      },
    };
  }

  private cleanupRoom(room: string): void {
    if (this.rooms.get(room)?.size === 0) this.rooms.delete(room);
  }
}

export function wsmesh(): WsMesh {
  return new WsMesh();
}
