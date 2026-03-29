import { useFactList } from '../hooks/useFactList';

export const FactListPanel = () => {
  const { facts, error, deleteFact } = useFactList();

  return (
    <section>
      <h2>Fact 一覧</h2>
      {error && <p style={{ color: 'red' }}>エラー: {error}</p>}
      {facts.length === 0 ? (
        <p>登録されたFactはありません。</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>subject</th>
              <th style={{ textAlign: 'left' }}>predicate</th>
              <th style={{ textAlign: 'left' }}>object</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {facts.map((f, i) => (
              <tr key={i}>
                <td>{f.subject}</td>
                <td>{f.predicate}</td>
                <td>{f.object}</td>
                <td>
                  <button onClick={() => deleteFact(f)}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};
