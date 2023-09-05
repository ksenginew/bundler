import fs from "fs/promises";
import { PluginDriver } from "./PluginDriver.js";
import { normalizeInputOptions } from "./options.js";

const options = await normalizeInputOptions({}, true);
const driver = new PluginDriver(options, [], new Map());
console.log(await driver.resolveId("src/index"));
