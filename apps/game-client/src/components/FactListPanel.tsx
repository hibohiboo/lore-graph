import { useFactList } from '../hooks/useFactList';

export const FactListPanel = () => {
  const { facts, error, deleteFact } = useFactList();

  return (
    <section>
      <h2>Fact 一覧</h2>
      {error ? <p className="inline-error">エラー: {error}</p> : null}
      {facts.length === 0 ? (
        <p>登録されたFactはありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>subject</th>
              <th>predicate</th>
              <th>object</th>
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
                  <button className="btn-sm btn-danger" onClick={() => deleteFact(f)}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};
