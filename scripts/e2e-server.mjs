import { createServer } from "vite";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";

const server = await createServer({
  mode: "e2e",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true
  }
});

await server.listen();
server.printUrls();

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  const forceExit = setTimeout(() => process.exit(0), 250);
  forceExit.unref();
  try {
    await server.close();
  } finally {
    clearTimeout(forceExit);
    process.exit(0);
  }
}

process.on("SIGINT", () => void close());
process.on("SIGTERM", () => void close());

const maxLifetime = setTimeout(() => void close(), 60_000);
maxLifetime.unref();
