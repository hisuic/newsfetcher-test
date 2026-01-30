const { useEffect, useState } = React;

const NEWS_API = 'https://hn.algolia.com/api/v1/search?tags=front_page';
const KEYWORDS = ['AI', 'Cloud', 'Security', 'DevOps', 'Web', 'Mobile', 'Data'];

const formatDate = (iso) => {
  const date = new Date(iso);
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const App = () => {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('読み込み中…');
  const [updatedAt, setUpdatedAt] = useState(null);

  const fetchNews = async () => {
    setStatus('更新中…');
    try {
      const response = await fetch(NEWS_API);
      if (!response.ok) {
        throw new Error('Fetch failed');
      }
      const data = await response.json();
      const filtered = data.hits
        .filter((hit) => hit.url && hit.title)
        .slice(0, 12)
        .map((hit) => ({
          title: hit.title,
          url: hit.url,
          author: hit.author,
          points: hit.points ?? 0,
          created_at: hit.created_at,
        }));

      setItems(filtered);
      setUpdatedAt(new Date());
      setStatus(`取得件数: ${filtered.length}`);
    } catch (error) {
      setItems([]);
      setStatus('取得失敗: しばらくしてから再度お試しください');
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  return (
    <>
      <header className="hero">
        <div className="hero__inner">
          <p className="hero__kicker">WAMODERN • IT NEWS</p>
          <h1 className="hero__title">和モダン ITニュース</h1>
          <p className="hero__sub">黒と金、木目の陰影で魅せる最新ITニュース一覧</p>
          <div className="hero__meta">
            <span id="last-updated">
              更新日時: {updatedAt ? formatDate(updatedAt.toISOString()) : '--'}
            </span>
            <button className="btn" onClick={fetchNews}>
              更新
            </button>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="panel">
          <div className="panel__head">
            <div>
              <h2>最新トピック</h2>
              <p className="muted">クリックで元記事へ移動します</p>
            </div>
            <div className="panel__status">{status}</div>
          </div>
          <div className="news-grid">
            {items.length === 0 && status.startsWith('取得失敗') ? (
              <p className="muted">ニュースを取得できませんでした。</p>
            ) : (
              items.map((item) => (
                <article className="news-card" key={item.url}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="news-title"
                  >
                    {item.title}
                  </a>
                  <div className="news-meta">
                    <span className="score-pill">Score {item.points}</span>
                    <span>{item.author}</span>
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel panel--accent">
          <div className="panel__head">
            <div>
              <h2>注目キーワード</h2>
              <p className="muted">AI / Cloud / Security などの話題を優先表示</p>
            </div>
          </div>
          <div className="tag-row">
            {KEYWORDS.map((keyword) => (
              <span className="tag" key={keyword}>
                {keyword}
              </span>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>Powered by open tech feeds • Design: Wamodern Luxury</p>
      </footer>
    </>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
