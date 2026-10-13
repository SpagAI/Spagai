/**
 * @spagai/core - pure business logic for Spag AI Studio.
 * No network calls, no database, no clock reads unless you pass a Date in.
 */

export * from "./address";
export * from "./speech";
export * from "./email";
export * from "./phone";
export * from "./time";
export * from "./prompt";
export * from "./agent";
export * from "./names";
export * from "./shared/numberWords";
export { PRESETS, getPreset, presetToTemplate } from "./presets";
export * from "./voices";
