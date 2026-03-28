import { z } from "zod";

export const ExtractedFactSchema = z.object({
  subjectName: z.string(),
  predicate: z.enum(['is', 'located_in', 'related_to', 'part_of', 'caused_by', 'seeks']),
  objectName: z.string(),
  certainty: z.number().min(0).max(1),
  at: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
});

export type ExtractedFact = z.infer<typeof ExtractedFactSchema>;
