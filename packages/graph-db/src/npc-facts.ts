import { type Driver } from 'neo4j-driver';
import { z } from 'zod';

const NpcFactRecordSchema = z.object({
  subject: z.string(),
  predicate: z.string(),
  object: z.string(),
  certainty: z.number().nullable(),
});

export const getNpcFacts = async (driver: Driver, npcName: string): Promise<string[]> => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (npc:NPC {name: $npcName})-[b:BELIEVES]->(f:Fact)<-[:SUBJECT_OF]-(s:Entity)
       MATCH (f)-[:OBJECT_OF]->(o:Entity)
       RETURN s.name AS subject, f.predicate AS predicate, o.name AS object, b.certainty AS certainty`,
      { npcName },
    );
    return result.records.flatMap((r) => {
      const parsed = NpcFactRecordSchema.safeParse({
        subject: r.get('subject'),
        predicate: r.get('predicate'),
        object: r.get('object'),
        certainty: r.get('certainty'),
      });
      if (!parsed.success) return [];
      const { subject, predicate, object: obj, certainty } = parsed.data;
      const base = `${subject} ${predicate} ${obj}`;
      return [certainty !== null && certainty < 0.8 ? `${base} (certainty:${certainty.toFixed(1)})` : base];
    });
  } finally {
    await session.close();
  }
};
