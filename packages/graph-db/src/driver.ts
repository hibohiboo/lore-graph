// Neo4j データベースへの接続を管理します。
// 環境変数から接続情報を取得するように実装する必要があります。
import neo4j, { type Driver } from 'neo4j-driver';

let driver: Driver;
export const getDriver = (
  ur = process.env.NEO4J_URL,
  us = process.env.NEO4J_USER,
  p = process.env.NEO4J_PASSWORD,
) => {
  console.debug('Connecting to Neo4j...');
  if (ur === undefined || us === undefined || p === undefined) {
    throw new Error('Missing required environment variables');
  }
  driver = neo4j.driver(ur, neo4j.auth.basic(us, p));
  console.debug('Connected to Neo4j');
  return driver;
};
// アプリケーション終了時にドライバーを閉じる
process.on('exit', async () => {
  console.debug('Closing Neo4j driver...');
  if (!driver) {
    console.warn('No Neo4j driver to close');
    return;
  }
  await driver.close();
  console.debug('Neo4j driver closed');
});
