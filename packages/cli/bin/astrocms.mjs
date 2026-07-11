#!/usr/bin/env node
import "tsx/esm";

const { main } = await import("../src/main.ts");
await main();
