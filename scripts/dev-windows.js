const { existsSync } = require("fs");
const { join } = require("path");
const { spawn } = require("child_process");

const isWindows = process.platform === "win32";
const localAppData = process.env.LOCALAPPDATA || "";

const preferredNode22Path = join(
  localAppData,
  "Microsoft",
  "WinGet",
  "Packages",
  "OpenJS.NodeJS.22_Microsoft.Winget.Source_8wekyb3d8bbwe",
  "node-v22.22.2-win-x64",
  "node.exe",
);

const nextBin = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const nodeExecutable = isWindows && existsSync(preferredNode22Path)
  ? preferredNode22Path
  : process.execPath;

const child = spawn(nodeExecutable, [nextBin, "dev", "--webpack"], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
