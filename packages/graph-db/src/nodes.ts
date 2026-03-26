import { type Driver } from 'neo4j-driver';

export type LoreNodeRow = {
  id: string;
  label: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export const getAllNodes = async (driver: Driver): Promise<LoreNodeRow[]> => {
  const session = driver.session();
  try {
    const result = await session.run('MATCH (n:LoreNode) RETURN n');
    return result.records.map((record) => {
      const node = record.get('n');
      return node.properties as LoreNodeRow;
    });
  } finally {
    await session.close();
  }
};
