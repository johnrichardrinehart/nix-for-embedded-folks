import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { URL } from "node:url";

type Action = {
  command: string[];
  description: string;
  id: string;
};

type DemoResult = {
  command: string;
  durationMs: number;
  exitCode: number;
  ok: boolean;
  output: string;
};

const repoRoot = process.env.REPO_ROOT ?? process.cwd();
const port = Number.parseInt(process.env.DEMO_SERVER_PORT ?? "4242", 10);
const demoScriptAction = (
  id: string,
  description: string,
  scriptName: string,
): Action => ({
  id,
  description,
  command: [path.join(repoRoot, "scripts/demo", scriptName)],
});

const actions: Record<string, Action> = {
  "current-system": demoScriptAction(
    "current-system",
    "Show the host system from Nix.",
    "current-system.sh",
  ),
  "slide-closure": demoScriptAction(
    "slide-closure",
    "Show the store closure size for the built deck.",
    "slide-closure.sh",
  ),
  "slide-tool-versions": demoScriptAction(
    "slide-tool-versions",
    "Inspect the pinned slide tooling from nixpkgs.",
    "slide-tool-versions.sh",
  ),
  "fetchtarball-store-path": demoScriptAction(
    "fetchtarball-store-path",
    "Evaluate builtins.fetchTarball and print the resulting store path.",
    "fetchtarball-store-path.sh",
  ),
  "fetchfromgithub-derivation": demoScriptAction(
    "fetchfromgithub-derivation",
    "Evaluate pkgs.fetchFromGitHub and inspect derivation metadata.",
    "fetchfromgithub-derivation.sh",
  ),
};

const corsHeaders = {
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET, OPTIONS, POST",
  "access-control-allow-origin": "*",
};

const writeJson = (
  response: http.ServerResponse,
  statusCode: number,
  payload: unknown,
) => {
  response.writeHead(statusCode, {
    ...corsHeaders,
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
};

const readRequestBody = async (request: http.IncomingMessage) => {
  let rawBody = "";

  for await (const chunk of request) {
    rawBody += chunk.toString();
  }

  return rawBody.length === 0 ? {} : JSON.parse(rawBody);
};

const writeSse = (
  response: http.ServerResponse,
  event: string,
  payload: unknown,
) => {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const runAction = async (action: Action) =>
  await new Promise<DemoResult>((resolve) => {
    const startedAt = Date.now();
    const child = spawn(action.command[0], action.command.slice(1), {
      cwd: repoRoot,
      env: {
        ...process.env,
        REPO_ROOT: repoRoot,
      },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1_000);
    }, 20_000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (exitCode) => {
      clearTimeout(timeout);

      const output = [stdout.trimEnd(), stderr.trimEnd()]
        .filter((chunk) => chunk.length > 0)
        .join("\n");

      resolve({
        command: action.command.join(" "),
        durationMs: Date.now() - startedAt,
        exitCode: timedOut ? 124 : (exitCode ?? 1),
        ok: !timedOut && exitCode === 0,
        output: timedOut
          ? `${output}\nCommand timed out after 20000 ms.`.trim()
          : output,
      });
    });
  });

const runActionStream = async (
  action: Action,
  request: http.IncomingMessage,
  response: http.ServerResponse,
) =>
  await new Promise<void>((resolve) => {
    const startedAt = Date.now();
    const child = spawn(action.command[0], action.command.slice(1), {
      cwd: repoRoot,
      env: {
        ...process.env,
        REPO_ROOT: repoRoot,
      },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let closed = false;

    response.writeHead(200, {
      ...corsHeaders,
      "cache-control": "no-cache",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
    });
    const scriptPath = action.command[0];
    let scriptSource = "";
    try {
      scriptSource = readFileSync(scriptPath, "utf8");
    } catch {
      scriptSource = "# source unavailable";
    }

    writeSse(response, "start", {
      command: action.command.join(" "),
      scriptPath,
      scriptSource,
      startedAt,
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1_000);
    }, 20_000);

    const onRequestClosed = () => {
      if (closed) {
        return;
      }

      closed = true;
      clearTimeout(timeout);
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1_000);
      resolve();
    };

    request.on("close", onRequestClosed);

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      writeSse(response, "stdout", { chunk: text });
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      writeSse(response, "stderr", { chunk: text });
    });

    child.on("close", (exitCode) => {
      if (closed) {
        return;
      }

      closed = true;
      clearTimeout(timeout);

      const output = [stdout.trimEnd(), stderr.trimEnd()]
        .filter((chunk) => chunk.length > 0)
        .join("\n");
      const result = {
        command: action.command.join(" "),
        durationMs: Date.now() - startedAt,
        exitCode: timedOut ? 124 : (exitCode ?? 1),
        ok: !timedOut && exitCode === 0,
        output: timedOut
          ? `${output}\nCommand timed out after 20000 ms.`.trim()
          : output,
      };

      writeSse(response, "exit", result);
      response.end();
      resolve();
    });
  });

const runShellStream = async (
  command: string,
  request: http.IncomingMessage,
  response: http.ServerResponse,
) =>
  await new Promise<void>((resolve) => {
    const startedAt = Date.now();
    const shell = process.env.SHELL ?? "bash";
    const child = spawn(shell, ["-lc", command], {
      cwd: repoRoot,
      env: {
        ...process.env,
        REPO_ROOT: repoRoot,
      },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let closed = false;

    response.writeHead(200, {
      ...corsHeaders,
      "cache-control": "no-cache",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
    });
    writeSse(response, "start", {
      command,
      scriptPath: null,
      scriptSource: null,
      startedAt,
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1_000);
    }, 30_000);

    const onRequestClosed = () => {
      if (closed) {
        return;
      }

      closed = true;
      clearTimeout(timeout);
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1_000);
      resolve();
    };

    request.on("close", onRequestClosed);

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      writeSse(response, "stdout", { chunk: text });
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      writeSse(response, "stderr", { chunk: text });
    });

    child.on("close", (exitCode) => {
      if (closed) {
        return;
      }

      closed = true;
      clearTimeout(timeout);

      const output = [stdout.trimEnd(), stderr.trimEnd()]
        .filter((chunk) => chunk.length > 0)
        .join("\n");
      const result = {
        command,
        durationMs: Date.now() - startedAt,
        exitCode: timedOut ? 124 : (exitCode ?? 1),
        ok: !timedOut && exitCode === 0,
        output: timedOut
          ? `${output}\nCommand timed out after 30000 ms.`.trim()
          : output,
      };

      writeSse(response, "exit", result);
      response.end();
      resolve();
    });
  });

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");

  if (request.method === "GET" && requestUrl.pathname === "/health") {
    writeJson(response, 200, {
      actions: Object.values(actions).map(({ description, id }) => ({
        description,
        id,
      })),
      port,
      repoRoot,
      status: "ok",
    });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/run") {
    try {
      const payload = (await readRequestBody(request)) as { action?: string };
      const action = payload.action ? actions[payload.action] : null;

      if (!action) {
        writeJson(response, 400, { error: "unknown action" });
        return;
      }

      writeJson(response, 200, await runAction(action));
      return;
    } catch (error) {
      writeJson(response, 500, {
        error:
          error instanceof Error ? error.message : "unexpected demo failure",
      });
      return;
    }
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/run-stream") {
    const actionId = requestUrl.searchParams.get("action");
    const action = actionId ? actions[actionId] : null;

    if (!action) {
      writeJson(response, 400, { error: "unknown action" });
      return;
    }

    await runActionStream(action, request, response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/shell-stream") {
    const command = requestUrl.searchParams.get("command")?.trim() ?? "";
    if (command.length === 0) {
      writeJson(response, 400, { error: "missing command" });
      return;
    }

    await runShellStream(command, request, response);
    return;
  }

  writeJson(response, 404, { error: "not found" });
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    process.stderr.write(
      `demo server could not bind 127.0.0.1:${port} because the port is already in use\n`,
    );
    process.exit(98);
  }

  throw error;
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(
    `demo server listening on http://127.0.0.1:${port} with repo root ${repoRoot}\n`,
  );
});
