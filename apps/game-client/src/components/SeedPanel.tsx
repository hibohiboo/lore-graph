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
        style={{ width: '100%' }}
      />
      <button onClick={submit} disabled={loading || !text.trim()}>
        {loading ? '登録中...' : '登録'}
      </button>
      {error && <p style={{ color: 'red' }}>エラー: {error}</p>}
      {warning && <p style={{ color: 'orange' }}>⚠ {warning}</p>}
      {registeredFacts.length > 0 ? (
        <details open>
          <summary>今回登録されたFact ({registeredFacts.length}件)</summary>
          <ul>
            {registeredFacts.map((f, i) => (
              <li key={i}>
                {f.subjectName} — {f.predicate} — {f.objectName}
                <small> (確信度: {f.certainty})</small>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {worldFacts.length > 0 ? (
        <details open>
          <summary>登録済み世界設定 ({worldFacts.length}件)</summary>
          <ul>
            {worldFacts.map((f, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>{f}</span>
                <button onClick={() => deleteFact(f)} style={{ fontSize: '0.75rem' }}>
                  削除
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
};
