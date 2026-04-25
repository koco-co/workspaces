#!/usr/bin/env bun
import { VERSION } from "./index";

const command = Bun.argv[2];
if (command === "--version" || command === "-v") {
  console.log(VERSION);
  process.exit(0);
}
console.error("dtstack-cli: command required (run with --help)");
process.exit(1);
