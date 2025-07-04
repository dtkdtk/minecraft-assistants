import { spawn } from "child_process";

const botProcess = spawn("node.exe", ["./test_bot.js"], {
  detached: false,
  stdio: "inherit"
});

botProcess.ref();
