import { z } from "zod";

export const NodeSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  properties: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Node = z.infer<typeof NodeSchema>;
