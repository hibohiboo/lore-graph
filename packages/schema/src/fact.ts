import { z } from "zod";

export const ExtractedFactSchema = z.object({
  subjectName: z.string(),
  predicate: z.string(),
  objectName: z.string(),
  certainty: z.number().min(0).max(1),
  at: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
});

export type ExtractedFact = z.infer<typeof ExtractedFactSchema>;
