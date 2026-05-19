import { describe, expect, it, afterEach } from "vitest";
import WebSocket from "ws";
import { SyncServer, SyncoraClient } from "../src/index.js";

const servers: SyncServer[] = [];
const clients: SyncoraClient[] = [];

afterEach(async () => {
  for (const c of clients) c.close();
  clients.length = 0;
  while (servers.length) {
    const s = servers.pop()!;
    await s.close();
  }
});

function startServer(): Promise<{ server: SyncServer; url: string }> {
  return new Promise((resolve) => {
    const server = new SyncServer();
    servers.push(server);
    setTimeout(() => {
      const addr = server.address();
      if (!addr) throw new Error("server has no address");
      resolve({ server, url: `ws://${addr.host}:${addr.port}` });
    }, 25);
  });
}

function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("timeout"));
      setTimeout(tick, 10);
    };
    tick();
  });
}

describe("SyncServer + SyncoraClient (end-to-end)", () => {
  it("delivers initial snapshot and live inserts", async () => {
    const { server, url } = await startServer();
    server.store.insert("todos", { _id: "a", title: "first" });
    const client = new SyncoraClient({ url, WebSocket: WebSocket as unknown as never });
    clients.push(client);
    await waitFor(() => client.isConnected());

    const sub = client.subscribe<{ _id: string; title: string }>("todos");
    await waitFor(() => sub.data.length === 1);
    expect(sub.data[0]!.title).toBe("first");

    server.store.insert("todos", { _id: "b", title: "second" });
    await waitFor(() => sub.data.length === 2);
    expect(sub.data.map((d) => d._id).sort()).toEqual(["a", "b"]);
  });

  it("supports mutations from the client", async () => {
    const { server, url } = await startServer();
    const client = new SyncoraClient({ url, WebSocket: WebSocket as unknown as never });
    clients.push(client);
    await waitFor(() => client.isConnected());
    const sub = client.subscribe("todos");
    await waitFor(() => sub.version >= 0);

    await client.mutate("todos", "insert", { document: { _id: "x", title: "hello" } });
    await waitFor(() => sub.data.length === 1);
    expect(server.store.find("todos")).toHaveLength(1);

    await client.mutate("todos", "update", { documentId: "x", patch: { title: "world" } });
    await waitFor(() => {
      const doc = sub.data[0] as { title?: string } | undefined;
      return doc?.title === "world";
    });

    await client.mutate("todos", "delete", { documentId: "x" });
    await waitFor(() => sub.data.length === 0);
  });

  it("respects subscription filters", async () => {
    const { server, url } = await startServer();
    server.store.insert("todos", { _id: "a", done: true });
    server.store.insert("todos", { _id: "b", done: false });
    const client = new SyncoraClient({ url, WebSocket: WebSocket as unknown as never });
    clients.push(client);
    await waitFor(() => client.isConnected());
    const sub = client.subscribe("todos", { filter: { done: true } });
    await waitFor(() => sub.data.length === 1);
    expect(sub.data[0]!._id).toBe("a");
  });

  it("rejects unauthorized connections", async () => {
    const server = new SyncServer({ authorize: () => false });
    servers.push(server);
    await new Promise((r) => setTimeout(r, 25));
    const addr = server.address()!;
    const url = `ws://${addr.host}:${addr.port}`;

    let errored = false;
    let closed = false;
    const client = new SyncoraClient({
      url,
      WebSocket: WebSocket as unknown as never,
      onError: () => { errored = true; },
      onDisconnect: () => { closed = true; },
      reconnectDelayMs: 1_000_000,
    });
    clients.push(client);
    await waitFor(() => closed || errored, 2000);
    expect(closed || errored).toBe(true);
  });
});
