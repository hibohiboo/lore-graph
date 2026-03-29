import { type Driver } from 'neo4j-driver';
import { z } from 'zod';
import { FactRecordSchema, type FactRecord } from '@repo/schema';

export type { FactRecord };

export const getAllFacts = async (driver: Driver): Promise<FactRecord[]> => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (s:Entity)-[:SUBJECT_OF]->(f:Fact)-[:OBJECT_OF]->(o:Entity)
       RETURN s.name AS subject, f.predicate AS predicate, o.name AS object
       ORDER BY s.name, f.predicate`,
    );
    return result.records.flatMap((r) => {
      const parsed = FactRecordSchema.safeParse({
        subject: r.get('subject'),
        predicate: r.get('predicate'),
        object: r.get('object'),
      });
      return parsed.success ? [parsed.data] : [];
    });
  } finally {
    await session.close();
  }
};

export const hardDeleteFact = async (
  driver: Driver,
  subjectName: string,
  predicate: string,
  objectName: string,
): Promise<void> => {
  const session = driver.session();
  try {
    await session.executeWrite((tx) =>
      tx.run(
        `MATCH (s:Entity {name: $subjectName})-[:SUBJECT_OF]->(f:Fact {predicate: $predicate})-[:OBJECT_OF]->(o:Entity {name: $objectName})
         DETACH DELETE f`,
        { subjectName, predicate, objectName },
      ),
    );
  } finally {
    await session.close();
  }
};

export const deleteNpcFact = async (
  driver: Driver,
  npcName: string,
  subjectName: string,
  predicate: string,
  objectName: string,
): Promise<void> => {
  const session = driver.session();
  try {
    await session.executeWrite((tx) =>
      tx.run(
        `MATCH (npc:NPC {name: $npcName})-[b:BELIEVES]->(f:Fact {predicate: $predicate})
         <-[:SUBJECT_OF]-(s:Entity {name: $subjectName})
         MATCH (f)-[:OBJECT_OF]->(o:Entity {name: $objectName})
         DELETE b`,
        { npcName, subjectName, predicate, objectName },
      ),
    );
  } finally {
    await session.close();
  }
};

const NpcFactRecordSchema = z.object({
  subject: z.string(),
  predicate: z.string(),
  object: z.string(),
  certainty: z.number().nullable(),
});

export const getFactsByNpc = async (driver: Driver, npcName: string): Promise<FactRecord[]> => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (npc:NPC {name: $npcName})-[:BELIEVES]->(f:Fact)<-[:SUBJECT_OF]-(s:Entity)
       MATCH (f)-[:OBJECT_OF]->(o:Entity)
       RETURN s.name AS subject, f.predicate AS predicate, o.name AS object
       ORDER BY s.name, f.predicate`,
      { npcName },
    );
    return result.records.flatMap((r) => {
      const parsed = FactRecordSchema.safeParse({
        subject: r.get('subject'),
        predicate: r.get('predicate'),
        object: r.get('object'),
      });
      return parsed.success ? [parsed.data] : [];
    });
  } finally {
    await session.close();
  }
};

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
