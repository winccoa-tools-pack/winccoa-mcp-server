/**
 * Unit tests for PmonClient.
 *
 * Mocks the Node.js `net` module to avoid real TCP connections.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import { PmonClient } from "./pmon-client.js";
import { PmonError } from "./pmon-types.js";

// Shared mock socket that all tests can control
let currentSocket: EventEmitter & {
  connect: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

function createMockSocket() {
  const sock = new EventEmitter() as typeof currentSocket;
  sock.connect = vi.fn((_port: number, _host: string, cb?: () => void) => {
    if (cb) setImmediate(cb);
    return sock;
  });
  sock.write = vi.fn();
  sock.end = vi.fn();
  sock.destroy = vi.fn();
  currentSocket = sock;
  return sock;
}

vi.mock("net", () => ({
  Socket: vi.fn(() => createMockSocket()),
}));

describe("PmonClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends authenticated command and resolves on complete response", async () => {
    const client = new PmonClient({ user: "admin", password: "secret" });

    const promise = client.getProjectName();

    // Wait for connect callback to fire
    await new Promise((r) => setImmediate(r));

    expect(currentSocket.write).toHaveBeenCalledWith("admin#secret#SYS:PROJ_NAME\n");

    // Simulate response
    currentSocket.emit("data", Buffer.from("TestProject;"));

    const result = await promise;
    expect(result).toBe("TestProject");
  });

  it("uses ## prefix when no credentials", async () => {
    const client = new PmonClient();

    const promise = client.startManager(1);

    await new Promise((r) => setImmediate(r));

    expect(currentSocket.write).toHaveBeenCalledWith("##SINGLE_MGR:START 1\n");

    currentSocket.emit("data", Buffer.from("OK"));
    currentSocket.emit("end");

    const result = await promise;
    expect(result.success).toBe(true);
  });

  it("rejects with PmonError on ECONNREFUSED", async () => {
    const client = new PmonClient();

    const promise = client.getProjectName();

    await new Promise((r) => setImmediate(r));

    currentSocket.emit("error", new Error("connect ECONNREFUSED 127.0.0.1:4999"));

    await expect(promise).rejects.toThrow(PmonError);
  });

  it("getManagerStati parses LIST response", async () => {
    const client = new PmonClient();

    const promise = client.getManagerStati();

    await new Promise((r) => setImmediate(r));

    const response = [
      "LIST:2",
      "2;100;2;2025.01.01 00:00:00;0",
      "2;101;2;2025.01.01 00:00:01;1",
      "1 MONITOR 0 0;",
    ].join("\n");

    currentSocket.emit("data", Buffer.from(response));

    const result = await promise;
    expect(result.managers).toHaveLength(2);
    expect(result.managers[0]!.pid).toBe(100);
    expect(result.modeString).toBe("MONITOR");
  });

  it("getManagerList parses LIST response", async () => {
    const client = new PmonClient();

    const promise = client.getManagerList();

    await new Promise((r) => setImmediate(r));

    const response = [
      "LIST:1",
      "WCCOActrl;always;30;3;5;-num 1",
      ";",
    ].join("\n");

    currentSocket.emit("data", Buffer.from(response));

    const result = await promise;
    expect(result).toHaveLength(1);
    expect(result[0]!.manager).toBe("WCCOActrl");
  });

  it("addManager validates index range", async () => {
    const client = new PmonClient();
    const result = await client.addManager(0, "WCCOActrl");
    expect(result.success).toBe(false);
    expect(result.error).toContain("between 1 and 100");
  });

  it("addManager validates empty name", async () => {
    const client = new PmonClient();
    const result = await client.addManager(1, "");
    expect(result.success).toBe(false);
    expect(result.error).toContain("required");
  });

  it("removeManager validates index", async () => {
    const client = new PmonClient();
    const result = await client.removeManager(0);
    expect(result.success).toBe(false);
    expect(result.error).toContain("at least 1");
  });

  it("getManagerProperties sends correct command", async () => {
    const client = new PmonClient();

    const promise = client.getManagerProperties(3);

    await new Promise((r) => setImmediate(r));

    expect(currentSocket.write).toHaveBeenCalledWith("##SINGLE_MGR:PROP_GET 3\n");

    currentSocket.emit("data", Buffer.from("always 30 3 5 -num 1"));
    currentSocket.emit("end");

    const result = await promise;
    expect(result.startMode).toBe("always");
    expect(result.secKill).toBe(30);
  });

  it("setManagerProperties sends correct command", async () => {
    const client = new PmonClient();

    const promise = client.setManagerProperties(2, "manual", 60, 5, 10, "-opt");

    await new Promise((r) => setImmediate(r));

    expect(currentSocket.write).toHaveBeenCalledWith("##SINGLE_MGR:PROP_PUT 2 manual 60 5 10 -opt\n");

    currentSocket.emit("data", Buffer.from("OK"));
    currentSocket.emit("end");

    const result = await promise;
    expect(result.success).toBe(true);
  });
});
