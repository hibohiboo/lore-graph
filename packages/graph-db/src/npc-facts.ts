import { type Driver } from 'neo4j-driver';

export const getNpcFacts = async (driver: Driver, npcName: string): Promise<string[]> => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (npc:NPC {name: $npcName})-[b:BELIEVES]->(f:Fact)<-[:SUBJECT_OF]-(s:Entity)
       MATCH (f)-[:OBJECT_OF]->(o:Entity)
       RETURN s.name AS subject, f.predicate AS predicate, o.name AS object, b.certainty AS certainty`,
      { npcName },
    );
    return result.records.map((r) => {
      const certainty = r.get('certainty') as number | null;
      const base = `${r.get('subject') as string} ${r.get('predicate') as string} ${r.get('object') as string}`;
      if (certainty !== null && certainty < 0.8) {
        return `${base} (certainty:${certainty.toFixed(1)})`;
      }
      return base;
    });
  } finally {
    await session.close();
  }
};
