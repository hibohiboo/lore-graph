import { Neo4jContainer, StartedNeo4jContainer } from '@testcontainers/neo4j';
import { auth, driver as createDriver, Driver } from 'neo4j-driver';
import { afterAll, beforeAll } from 'vitest';

/**
 * graph-database用Neo4jテスト環境のセットアップユーティリティ
 * Neo4j Testcontainerを起動し、ドライバーを提供します
 */
export interface SetupGraphDbTestEnvOptions {
  /**
   * テスト前の追加セットアップ処理
   */
  beforeSetup?: (driver: Driver) => Promise<void>;
}

export interface Neo4jTestConfig {
  url: string;
  user: string;
  password: string;
  driver: Driver;
}

/**
 * graph-database用Neo4jテスト環境のセットアップを行います
 * @param options セットアップオプション
 * @returns Neo4jドライバーと設定情報を取得する関数
 */
export const setupGraphDbTestEnv = (options?: SetupGraphDbTestEnvOptions) => {
  let neo4jContainer: StartedNeo4jContainer;
  let neo4jConfig: Neo4jTestConfig;

  // テスト開始前にNeo4jコンテナを起動
  beforeAll(async () => {
    // Neo4jコンテナを起動
    const container = await new Neo4jContainer('neo4j').start();
    neo4jContainer = container;

    // Neo4j接続設定を生成
    const url = neo4jContainer.getBoltUri();
    const user = container.getUsername();
    const password = container.getPassword();

    // Neo4jドライバーを作成
    const driver = createDriver(url, auth.basic(user, password));

    neo4jConfig = {
      url,
      user,
      password,
      driver,
    };

    // 追加のセットアップ処理があれば実行
    if (options?.beforeSetup) {
      await options.beforeSetup(driver);
    }
  }, 60000); // 60秒のタイムアウトを設定（コンテナ起動に時間がかかるため）

  // テスト終了後にNeo4jコンテナとドライバーを停止
  afterAll(async () => {
    if (neo4jConfig?.driver) {
      await neo4jConfig.driver.close();
    }
    if (neo4jContainer) {
      await neo4jContainer.stop();
    }
  });

  return {
    getDriver: () => neo4jConfig.driver,
    getConfig: () => neo4jConfig,
    getUrl: () => neo4jConfig.url,
    getCredentials: () => ({
      user: neo4jConfig.user,
      password: neo4jConfig.password,
    }),
  };
};
