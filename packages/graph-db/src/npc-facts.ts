import { type Driver } from 'neo4j-driver';

export const getNpcFacts = async (driver: Driver, npcName: string): Promise<string[]> => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (npc:NPC {name: $npcName})-[:BELIEVES]->(f:Fact)<-[:SUBJECT_OF]-(s:Entity)
       MATCH (f)-[:OBJECT_OF]->(o:Entity)
       RETURN s.name AS subject, f.predicate AS predicate, o.name AS object`,
      { npcName },
    );
    return result.records.map(
      (r) =>
        `${r.get('subject') as string} ${r.get('predicate') as string} ${r.get('object') as string}`,
    );
  } finally {
    await session.close();
  }
};
