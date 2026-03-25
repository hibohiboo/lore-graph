import { describe, it, expect } from 'vitest';
import { setupGraphDbTestEnv } from '../test-utils/neo4j-testcontainer';

describe('Neo4j Driver', () => {
  const { getDriver } = setupGraphDbTestEnv();

  it('should connect to Neo4j and create a session', async () => {
    const driver = getDriver();
    const session = driver.session();
    try {
      // サーバーへの接続を試みる簡単なクエリを実行
      const result = await session.run('RETURN 1');
      expect(result.records).toHaveLength(1);
      expect(result.records[0].get(0).toNumber()).toBe(1);
    } finally {
      await session.close();
    }
  });
});
