const NEWS_API = 'https://hn.algolia.com/api/v1/search?tags=front_page';
const KEYWORDS = ['AI', 'Cloud', 'Security', 'DevOps', 'Web', 'Mobile', 'Data'];

const grid = document.getElementById('news-grid');
const statusEl = document.getElementById('status');
const updatedEl = document.getElementById('last-updated');
const refreshBtn = document.getElementById('refresh');
const tagRow = document.getElementById('tag-row');

const setStatus = (text) => {
  statusEl.textContent = text;
};

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

const renderTags = () => {
  tagRow.innerHTML = '';
  KEYWORDS.forEach((keyword) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = keyword;
    tagRow.appendChild(tag);
  });
};

const renderNews = (items) => {
  grid.innerHTML = '';
  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'news-card';

    const title = document.createElement('a');
    title.href = item.url;
    title.target = '_blank';
    title.rel = 'noopener noreferrer';
    title.className = 'news-title';
    title.textContent = item.title;

    const meta = document.createElement('div');
    meta.className = 'news-meta';
    meta.innerHTML = `
      <span class="score-pill">Score ${item.points}</span>
      <span>${item.author}</span>
      <span>${formatDate(item.created_at)}</span>
    `;

    card.appendChild(title);
    card.appendChild(meta);

    grid.appendChild(card);
  });
};

const fetchNews = async () => {
  setStatus('更新中…');
  try {
    const response = await fetch(NEWS_API);
    if (!response.ok) {
      throw new Error('Fetch failed');
    }
    const data = await response.json();
    const items = data.hits
      .filter((hit) => hit.url && hit.title)
      .slice(0, 12)
      .map((hit) => ({
        title: hit.title,
        url: hit.url,
        author: hit.author,
        points: hit.points ?? 0,
        created_at: hit.created_at,
      }));

    renderNews(items);
    updatedEl.textContent = `更新日時: ${formatDate(new Date().toISOString())}`;
    setStatus(`取得件数: ${items.length}`);
  } catch (error) {
    setStatus('取得失敗: しばらくしてから再度お試しください');
    grid.innerHTML = '<p class="muted">ニュースを取得できませんでした。</p>';
  }
};

renderTags();
fetchNews();
refreshBtn.addEventListener('click', fetchNews);
