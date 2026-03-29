import { type Driver } from 'neo4j-driver';
import { type NpcPersona, NpcPersonaSchema } from '@repo/schema';

export const getPersona = async (driver: Driver, npcName: string): Promise<NpcPersona | undefined> => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (p:Persona {name: $npcName})
       RETURN p.name AS name, p.role AS role, p.personality AS personality, p.knowledgeScope AS knowledgeScope`,
      { npcName },
    );
    const record = result.records[0];
    if (!record) return undefined;
    const parsed = NpcPersonaSchema.safeParse({
      name: record.get('name'),
      role: record.get('role'),
      personality: record.get('personality'),
      knowledgeScope: record.get('knowledgeScope'),
    });
    return parsed.success ? parsed.data : undefined;
  } finally {
    await session.close();
  }
};

export const getAllPersonas = async (driver: Driver): Promise<NpcPersona[]> => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (p:Persona)
       RETURN p.name AS name, p.role AS role, p.personality AS personality, p.knowledgeScope AS knowledgeScope
       ORDER BY p.name`,
    );
    return result.records.flatMap((r) => {
      const parsed = NpcPersonaSchema.safeParse({
        name: r.get('name'),
        role: r.get('role'),
        personality: r.get('personality'),
        knowledgeScope: r.get('knowledgeScope'),
      });
      return parsed.success ? [parsed.data] : [];
    });
  } finally {
    await session.close();
  }
};

export const upsertPersona = async (driver: Driver, persona: NpcPersona): Promise<void> => {
  const session = driver.session();
  try {
    await session.executeWrite((tx) =>
      tx.run(
        `MERGE (p:Persona {name: $name})
         SET p.role = $role, p.personality = $personality, p.knowledgeScope = $knowledgeScope`,
        persona,
      ),
    );
  } finally {
    await session.close();
  }
};

export const deletePersona = async (driver: Driver, npcName: string): Promise<void> => {
  const session = driver.session();
  try {
    await session.executeWrite((tx) =>
      tx.run(`MATCH (p:Persona {name: $npcName}) DELETE p`, { npcName }),
    );
  } finally {
    await session.close();
  }
};
