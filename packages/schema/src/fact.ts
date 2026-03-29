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

export const FactRecordSchema = z.object({
  subject: z.string(),
  predicate: z.string(),
  object: z.string(),
});

export type FactRecord = z.infer<typeof FactRecordSchema>;

export const ConversationMessageSchema = z.object({
  role: z.enum(['player', 'npc']),
  content: z.string(),
  timestamp: z.string().optional(),
});

export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

export const NpcPersonaSchema = z.object({
  name: z.string(),
  roles: z.array(z.string()),
  personalities: z.array(z.string()),
  knowledgeScopes: z.array(z.string()),
});

export type NpcPersona = z.infer<typeof NpcPersonaSchema>;
