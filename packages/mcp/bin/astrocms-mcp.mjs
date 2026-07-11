#!/usr/bin/env node
import "tsx/esm";

const { startStdioServer } = await import("../src/index.ts");
await startStdioServer();
