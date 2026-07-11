import { z } from "zod";

export const settingsGroupSchema = z.object({
  group: z.string().min(1),
  values: z.record(z.unknown()),
});
export type SettingsGroup = z.infer<typeof settingsGroupSchema>;

export const setSettingsGroupRequestSchema = z.object({
  values: z.record(z.unknown()),
});
export type SetSettingsGroupRequest = z.infer<typeof setSettingsGroupRequestSchema>;
