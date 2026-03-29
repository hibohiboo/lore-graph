import { useSeed } from '../hooks/useSeed';

export const SeedPanel = () => {
  const { text, setText, registeredFacts, worldFacts, loading, error, warning, submit, deleteFact } =
    useSeed();

  return (
    <section>
      <h2>世界設定の登録</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="例）酒場の名前は銀嶺亭です。オーナーは田中さんです。"
        rows={4}
      />
      <button className="btn-send" onClick={submit} disabled={loading || !text.trim()}>
        {loading ? '登録中...' : '登録'}
      </button>
      {error ? <p className="inline-error">エラー: {error}</p> : null}
      {warning ? <p className="inline-warn">⚠ {warning}</p> : null}
      {registeredFacts.length > 0 ? (
        <details open>
          <summary>今回登録されたFact ({registeredFacts.length}件)</summary>
          <ul className="fact-pill-list">
            {registeredFacts.map((f, i) => (
              <li key={i} className="fact-pill">
                <span className="fact-pill-subject">{f.subjectName}</span>
                <span className="fact-pill-predicate">—{f.predicate}—</span>
                <span className="fact-pill-object">{f.objectName}</span>
                <span className="fact-pill-certainty">{Math.round(f.certainty * 100)}%</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {worldFacts.length > 0 ? (
        <details open>
          <summary>登録済み世界設定 ({worldFacts.length}件)</summary>
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
              {worldFacts.map((f, i) => (
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
        </details>
      ) : null}
    </section>
  );
};
