import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  parseArgs,
  normMeter,
  extractMeters,
  fmtCountdown,
  bar,
  colorFor,
  renderRows,
  describeError,
  ApiError,
} from "../bin/go-usage";

const CLI = join(import.meta.dir, "..", "bin", "go-usage");

describe("parseArgs", () => {
  test("defaults", () => {
    const a = parseArgs([]);
    expect(a.json).toBe(false);
    expect(a.timeout).toBe(15000);
    expect(a.accounts).toEqual([]);
  });
  test("flags e valores =", () => {
    const a = parseArgs(["--json", "--no-color", "--db=/tmp/x.db", "--account=a@b.c", "--timeout=9000"]);
    expect(a.json).toBe(true);
    expect(a.color).toBe(false);
    expect(a.db).toBe("/tmp/x.db");
    expect(a.accounts).toEqual(["a@b.c"]);
    expect(a.timeout).toBe(9000);
  });
});

describe("normMeter / extractMeters", () => {
  test("percentual", () => {
    const m = normMeter({ usedMicroCents: "3000000000", limitMicroCents: "6000000000", resetsAt: "x" });
    expect(m.percent).toBeCloseTo(50, 6);
    expect(m.used).toBe(3000000000);
    expect(m.limit).toBe(6000000000);
  });
  test("limit 0 não divide por zero", () => {
    expect(normMeter({ usedMicroCents: "5", limitMicroCents: "0" }).percent).toBe(0);
  });
  test("sem meters → null", () => {
    expect(extractMeters(null)).toBeNull();
    expect(extractMeters({})).toBeNull();
    expect(extractMeters({ access: {} })).toBeNull();
  });
  test("com meters", () => {
    const x = extractMeters({
      access: {
        meters: {
          fiveHour: { usedMicroCents: "1", limitMicroCents: "10", resetsAt: "r" },
          week: { usedMicroCents: "2", limitMicroCents: "10", resetsAt: "r" },
          month: { usedMicroCents: "3", limitMicroCents: "10", resetsAt: "r" },
        },
      },
    });
    expect(x.fiveHour.percent).toBeCloseTo(10, 6);
    expect(x.month.used).toBe(3);
  });
});

describe("fmtCountdown", () => {
  const iso = (ms) => new Date(Date.now() + ms).toISOString();
  test("dias/horas", () => expect(fmtCountdown(iso(6 * 86400e3 + 8 * 3600e3))).toBe("6d 8h"));
  test("horas/min", () => expect(fmtCountdown(iso(4 * 3600e3 + 43 * 60e3))).toBe("4h 43m"));
  test("minutos", () => expect(fmtCountdown(iso(30 * 60e3))).toBe("30m"));
  test("passado → agora", () => expect(fmtCountdown(iso(-1000))).toBe("agora"));
  test("inválido", () => expect(fmtCountdown("nope")).toBe("—"));
});

describe("bar / colorFor", () => {
  test("0% vazio", () => {
    const b = bar(0, 10, "", false);
    expect(b).toBe("░".repeat(10));
  });
  test("100% cheio", () => expect(bar(100, 10, "", false)).toBe("█".repeat(10)));
  test("1% tem ao menos 1 bloco", () => expect(bar(1, 28, "", false)).toBe("█" + "░".repeat(27)));
  test("limiares de cor", () => {
    expect(colorFor(10)).toBe("\x1b[32m");
    expect(colorFor(50)).toBe("\x1b[33m");
    expect(colorFor(80)).toBe("\x1b[31m");
  });
});

describe("renderRows", () => {
  test("inclui labels, barra e resets", () => {
    const r = {
      email: "a@b.c",
      orgName: "Org",
      product: "go",
      active: true,
      fiveHour: normMeter({ usedMicroCents: "240000000", limitMicroCents: "1200000000", resetsAt: new Date(Date.now() + 3600e3).toISOString() }),
      week: normMeter({ usedMicroCents: "0", limitMicroCents: "3000000000", resetsAt: new Date(Date.now() + 86400e3).toISOString() }),
      month: normMeter({ usedMicroCents: "3000000000", limitMicroCents: "6000000000", resetsAt: new Date(Date.now() + 86400e3).toISOString() }),
    };
    const out = renderRows(r, false).join("\n");
    expect(out).toContain("a@b.c — Org · go ●");
    expect(out).toContain("Rolling usage");
    expect(out).toContain("20% used");
    expect(out).toContain("50% used");
    expect(out).toContain("Resets in");
  });
});

describe("describeError", () => {
  test("unauthorized pede re-login", () => {
    expect(describeError(new ApiError("unauthorized", 401, ""), { email: "x@y.z" })).toContain("opencode console login");
  });
});

describe("integração offline (fixture)", () => {
  let server;
  let dir;
  let dbPath;
  let base;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "go-usage-"));
    dbPath = join(dir, "opencode.db");
    const db = new Database(dbPath);
    db.exec(`CREATE TABLE account(id TEXT PRIMARY KEY, email TEXT, url TEXT, access_token TEXT, refresh_token TEXT, token_expiry INTEGER)`);
    db.exec(`CREATE TABLE account_state(id TEXT, active_account_id TEXT, active_org_id TEXT)`);

    server = Bun.serve({
      port: 0,
      fetch(req) {
        const u = new URL(req.url);
        if (u.pathname === "/api/orgs") {
          return Response.json([
            { id: "org_go", name: "Com Go" },
            { id: "org_none", name: "Sem Go" },
          ]);
        }
        if (u.pathname === "/api/go/status") {
          const org = req.headers.get("x-org-id");
          if (org === "org_none") return new Response("null", { headers: { "content-type": "application/json" } });
          return Response.json({
            subscriberUserId: "user_1",
            product: "go",
            renewalProduct: "go",
            renewalPending: false,
            useBalance: false,
            access: {
              startsAt: "2026-09-30T21:20:16.000Z",
              endsAt: "2026-10-30T21:20:16.000Z",
              cancelAtPeriodEnd: false,
              meters: {
                fiveHour: { usedMicroCents: "240000000", limitMicroCents: "1200000000", resetsAt: new Date(Date.now() + 3600e3).toISOString() },
                week: { usedMicroCents: "130000000", limitMicroCents: "3000000000", resetsAt: new Date(Date.now() + 6 * 86400e3).toISOString() },
                month: { usedMicroCents: "3000000000", limitMicroCents: "6000000000", resetsAt: new Date(Date.now() + 20 * 86400e3).toISOString() },
              },
            },
          });
        }
        return new Response("not found", { status: 404 });
      },
    });
    base = `http://127.0.0.1:${server.port}`;

    db.query("INSERT INTO account VALUES(?,?,?,?,?,?)").run(
      "user_1",
      "dev@example.com",
      base,
      "sess_test",
      "rtfam_test",
      Date.now() + 86400e3
    );
    db.query("INSERT INTO account_state VALUES(?,?,?)").run("x", "user_1", "org_go");
    db.close();
  });

  afterAll(() => {
    server?.stop(true);
    rmSync(dir, { recursive: true, force: true });
  });

  async function run(args) {
    const proc = Bun.spawn(["bun", CLI, "--db", dbPath, "--no-color", ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const status = await proc.exited;
    return { status, stdout, stderr };
  }

  test("json: só orgs com Go", async () => {
    const r = await run(["--json"]);
    expect(r.status).toBe(0);
    const data = JSON.parse(r.stdout);
    expect(data.length).toBe(1);
    expect(data[0].orgName).toBe("Com Go");
    expect(data[0].product).toBe("go");
    expect(data[0].active).toBe(true);
    expect(data[0].month.percent).toBeCloseTo(50, 6);
  });

  test("tabela: mostra as três linhas", async () => {
    const r = await run([]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Rolling usage");
    expect(r.stdout).toContain("Weekly usage");
    expect(r.stdout).toContain("Monthly usage");
    expect(r.stdout).toContain("dev@example.com");
  });

  test("filtro --account inexistente → sem dados, exit 1", async () => {
    const r = await run(["--account", "ninguem@x.com"]);
    expect(r.status).toBe(1);
  });
});
