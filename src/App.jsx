import { useEffect, useMemo, useState } from 'react';

const FEEDS = [
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss' },
  { name: 'ITmedia', url: 'https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml' },
  { name: 'Gigazine', url: 'https://gigazine.net/news/rss_2.0/' },
  { name: 'Publickey', url: 'https://www.publickey1.jp/atom.xml' },
  { name: 'ZDNet Japan', url: 'https://japan.zdnet.com/rss/' },
  { name: 'Hacker News', url: 'https://hnrss.org/frontpage' },
];

const KEYWORDS = ['All', 'AI', 'Cloud', 'Security', 'DevOps', 'Web', 'Mobile', 'Data'];
const CACHE_KEY = 'wamodern-news-cache-v1';
const CACHE_TTL_MS = 10 * 60 * 1000;
const FEED_TIMEOUT_MS = 6000;

const formatDate = (date) =>
  date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const parseDate = (value) => {
  if (!value) return new Date(0);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
};

const parseFeed = (xmlText, source) => {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'text/xml');
  const itemNodes = Array.from(xml.querySelectorAll('item'));
  const entryNodes = Array.from(xml.querySelectorAll('entry'));
  const nodes = itemNodes.length > 0 ? itemNodes : entryNodes;

  return nodes
    .map((node) => {
      const getText = (selector) => node.querySelector(selector)?.textContent?.trim() || '';
      const linkNode = node.querySelector('link');
      const link = linkNode?.getAttribute('href') || linkNode?.textContent || '';
      const description = getText('description') || getText('summary') || '';
      const pubDate =
        getText('pubDate') || getText('updated') || getText('published') || getText('dc\\:date');

      return {
        title: getText('title') || 'Untitled',
        url: link,
        description,
        publishedAt: parseDate(pubDate),
        source,
      };
    })
    .filter((item) => item.url);
};

const stripHtml = (value) => value.replace(/<[^>]*>/g, '').trim();

const fetchFeed = async (feed, signal) => {
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feed.url)}`;
  const response = await fetch(proxyUrl, { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${feed.name}`);
  }
  const text = await response.text();
  return parseFeed(text, feed.name);
};

const mergeItems = (baseItems, incoming) => {
  const deduped = new Map(baseItems.map((item) => [item.url, item]));
  incoming.forEach((item) => {
    if (!deduped.has(item.url)) {
      deduped.set(item.url, item);
    }
  });

  return Array.from(deduped.values()).sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
  );
};

const loadCache = () => {
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.items || !parsed.updatedAt) return null;
    const updatedAt = new Date(parsed.updatedAt);
    if (Number.isNaN(updatedAt.getTime())) return null;
    if (Date.now() - updatedAt.getTime() > CACHE_TTL_MS) return null;
    const items = parsed.items.map((item) => ({
      ...item,
      publishedAt: new Date(item.publishedAt),
    }));
    return { items, updatedAt };
  } catch (error) {
    return null;
  }
};

const saveCache = (items, updatedAt) => {
  const payload = {
    updatedAt: updatedAt.toISOString(),
    items: items.map((item) => ({
      ...item,
      publishedAt: item.publishedAt.toISOString(),
    })),
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
};

const App = () => {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('読み込み中…');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [selectedKeyword, setSelectedKeyword] = useState('All');
  const [selectedSource, setSelectedSource] = useState('All');
  const [isLoading, setIsLoading] = useState(false);

  const fetchNews = async () => {
    if (isLoading) return;
    setIsLoading(true);
    const cached = loadCache();
    if (cached) {
      setItems(cached.items);
      setUpdatedAt(cached.updatedAt);
      setStatus('キャッシュ表示中…');
    } else {
      setStatus('更新中…');
    }
    try {
      let completed = 0;
      let failed = 0;
      let nextItems = cached ? cached.items : [];

      await Promise.all(
        FEEDS.map(async (feed) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
          try {
            const feedItems = await fetchFeed(feed, controller.signal);
            nextItems = mergeItems(nextItems, feedItems);
            setItems(nextItems);
            completed += 1;
          } catch (error) {
            failed += 1;
          } finally {
            clearTimeout(timeoutId);
            setStatus(`取得中: ${completed}/${FEEDS.length} 失敗: ${failed}`);
          }
        })
      );

      const updated = new Date();
      setUpdatedAt(updated);
      setStatus(`取得件数: ${nextItems.length} 失敗: ${failed}`);
      saveCache(nextItems, updated);
    } catch (error) {
      setItems([]);
      setStatus('取得失敗: しばらくしてから再度お試しください');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const sources = useMemo(() => ['All', ...FEEDS.map((feed) => feed.name)], []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const description = item.description || '';
      const keywordMatch =
        selectedKeyword === 'All' ||
        item.title.toLowerCase().includes(selectedKeyword.toLowerCase()) ||
        description.toLowerCase().includes(selectedKeyword.toLowerCase());
      const sourceMatch = selectedSource === 'All' || item.source === selectedSource;
      return keywordMatch && sourceMatch;
    });
  }, [items, selectedKeyword, selectedSource]);

  return (
    <>
      <div className="bg-wood" />
      <div className="bg-ink" />

      <header className="hero">
        <div className="hero__inner">
          <h1 className="hero__title">IT最新ニュース一覧</h1>
          <div className="hero__meta">
            <span id="last-updated">
              更新日時: {updatedAt ? formatDate(updatedAt) : '--'}
            </span>
            <button className="btn" onClick={fetchNews} disabled={isLoading}>
              {isLoading ? '取得中…' : '更新'}
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

          <div className="filters">
            <div className="filter-group">
              <span className="filter-label">Keyword</span>
              <div className="filter-tags">
                {KEYWORDS.map((keyword) => (
                  <button
                    key={keyword}
                    className={`filter-tag ${selectedKeyword === keyword ? 'is-active' : ''}`}
                    onClick={() => setSelectedKeyword(keyword)}
                  >
                    {keyword}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <span className="filter-label">Source</span>
              <select
                className="filter-select"
                value={selectedSource}
                onChange={(event) => setSelectedSource(event.target.value)}
              >
                {sources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="news-grid">
            {filteredItems.length === 0 && status.startsWith('取得失敗') ? (
              <p className="muted">ニュースを取得できませんでした。</p>
            ) : (
              filteredItems.slice(0, 18).map((item) => (
                <article className="news-card" key={item.url}>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="news-title">
                    {item.title}
                  </a>
                  <p className="news-desc">{stripHtml(item.description || '').slice(0, 120)}</p>
                  <div className="news-meta">
                    <span className="score-pill">{item.source}</span>
                    <span>{formatDate(item.publishedAt)}</span>
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
            {KEYWORDS.filter((keyword) => keyword !== 'All').map((keyword) => (
              <span className="tag" key={keyword}>
                {keyword}
              </span>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>Powered by curated RSS feeds • Design: Wamodern Luxury</p>
      </footer>
    </>
  );
};

export default App;
