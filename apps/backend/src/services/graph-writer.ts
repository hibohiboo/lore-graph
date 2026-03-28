import { type Driver } from 'neo4j-driver';
import { type ExtractedFact } from '@repo/schema';

export const mergeFactsToGraph = async (
  driver: Driver,
  npcName: string,
  facts: ExtractedFact[],
): Promise<void> => {
  if (facts.length === 0) return;

  const session = driver.session();
  try {
    await session.executeWrite(async (tx) => {
      for (const fact of facts) {
        await tx.run(
          `MERGE (subj:Entity {name: $subjectName})
           MERGE (obj:Entity {name: $objectName})
           MERGE (subj)-[:SUBJECT_OF]->(f:Fact {predicate: $predicate})-[:OBJECT_OF]->(obj)
           ON CREATE SET f.at = $at, f.since = $since, f.until = $until
           MERGE (npc:NPC {name: $npcName})
           MERGE (npc)-[b:BELIEVES]->(f)
           ON CREATE SET b.certainty = $certainty, b.heardAt = datetime()`,
          {
            subjectName: fact.subjectName,
            objectName: fact.objectName,
            predicate: fact.predicate,
            at: fact.at ?? null,
            since: fact.since ?? null,
            until: fact.until ?? null,
            npcName,
            certainty: fact.certainty,
          },
        );
      }
    });
  } finally {
    await session.close();
  }
};
