import minimist from "minimist";
import { dev } from "./dev.js";

export function cli() {
  if (process.argv[2] === "dev") dev(minimist(process.argv.slice(2)));
  else dev(minimist(process.argv.slice(3)));
}
