import {
  InputOptions as RollupInputOptions,
  Plugin as RollupPlugin,
  PluginContext as RollupPluginContext,
} from "rollup";

export interface InputOptions extends RollupInputOptions {}
export interface Plugin extends RollupPlugin {}
export interface PluginContext extends RollupPluginContext {}
