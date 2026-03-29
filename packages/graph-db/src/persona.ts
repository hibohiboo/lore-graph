import { type Driver } from 'neo4j-driver';
import { type NpcPersona, NpcPersonaSchema } from '@repo/schema';

const toStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

export const getPersona = async (driver: Driver, npcName: string): Promise<NpcPersona | undefined> => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (p:Persona {name: $npcName})
       RETURN p.name AS name, p.roles AS roles, p.personalities AS personalities, p.knowledgeScopes AS knowledgeScopes`,
      { npcName },
    );
    const record = result.records[0];
    if (!record) return undefined;
    const parsed = NpcPersonaSchema.safeParse({
      name: record.get('name'),
      roles: toStringArray(record.get('roles')),
      personalities: toStringArray(record.get('personalities')),
      knowledgeScopes: toStringArray(record.get('knowledgeScopes')),
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
       RETURN p.name AS name, p.roles AS roles, p.personalities AS personalities, p.knowledgeScopes AS knowledgeScopes
       ORDER BY p.name`,
    );
    return result.records.flatMap((r) => {
      const parsed = NpcPersonaSchema.safeParse({
        name: r.get('name'),
        roles: toStringArray(r.get('roles')),
        personalities: toStringArray(r.get('personalities')),
        knowledgeScopes: toStringArray(r.get('knowledgeScopes')),
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
         SET p.roles = $roles, p.personalities = $personalities, p.knowledgeScopes = $knowledgeScopes`,
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
