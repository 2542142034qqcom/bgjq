/* global marked */

(function () {
  const LIB_ROOT = '邦国文库';

  const elNav = document.getElementById('nav');
  const elContent = document.getElementById('content');
  const elCrumb = document.getElementById('crumb');
  const elSearch = document.getElementById('search');
  const elToggle = document.getElementById('toggleSidebar');

  const state = {
    index: null,
    items: [],
    activePath: null,
  };

  function normalizeHashPath(hash) {
    // hash: #/邦国文库/README.md
    const raw = (hash || '').replace(/^#\/?/, '');
    if (!raw) return `${LIB_ROOT}/README.md`;
    // 防止类似 // 或开头的 / 造成空段
    return raw.replace(/^\/+/, '');
  }

  function joinPath() {
    return Array.prototype.slice.call(arguments).join('/').replace(/\/+/g, '/');
  }

  async function fetchText(path) {
    const url = encodeURI(path);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`加载失败：${path} (${res.status})`);
    }
    return await res.text();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setActive(path) {
    state.activePath = path;
    const links = elNav.querySelectorAll('a.item');
    links.forEach((a) => {
      if (a.getAttribute('data-path') === path) a.classList.add('active');
      else a.classList.remove('active');
    });
  }

  function renderNav(items, filter) {
    const q = (filter || '').trim().toLowerCase();

    const groups = new Map();
    for (const it of items) {
      if (q) {
        const hay = `${it.title} ${it.path}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      if (!groups.has(it.group)) groups.set(it.group, []);
      groups.get(it.group).push(it);
    }

    const order = ['卷一-新世记', '卷二-旧世记', '卷三-刊物志', '卷四-轶事志', '附录', '其他'];

    const sections = [];
    for (const name of order) {
      const list = groups.get(name);
      if (!list || list.length === 0) continue;
      sections.push({ name, list });
    }

    // 未在 order 中的组也照样显示
    for (const [name, list] of groups.entries()) {
      if (order.includes(name)) continue;
      sections.push({ name, list });
    }

    if (sections.length === 0) {
      elNav.innerHTML = '<div class="nav-loading">没有匹配的条目</div>';
      return;
    }

    const html = sections
      .map((sec) => {
        const inner = sec.list
          .map((it) => {
            const encodedPath = it.path
              .split('/')
              .map((seg) => encodeURIComponent(seg))
              .join('/');
            const href = `#/${encodedPath}`;
            return `<a class="item" href="${href}" data-path="${escapeHtml(it.path)}">${escapeHtml(it.title)}</a>`;
          })
          .join('');
        return `<div class="section"><div class="section-title">${escapeHtml(sec.name)}</div>${inner}</div>`;
      })
      .join('');

    elNav.innerHTML = html;
    if (state.activePath) setActive(state.activePath);
  }

  function deriveTitleFromPath(p) {
    const name = p.split('/').pop() || p;
    return decodeURIComponent(name.replace(/\.md$/i, ''));
  }

  function rewriteRelativeLinks(md, basePath) {
    // 将 Markdown 内相对链接改为 hash 路由，避免在 Pages 上跳出 SPA
    // 支持：./xxx.md、../xxx.md、卷一-新世记/xxx.md
    // 不处理 http(s) / mailto / #anchor

    const baseDir = basePath.split('/').slice(0, -1).join('/');

    function resolve(rel) {
      // rel 可能含有 %20
      const relDecoded = rel;
      if (relDecoded.startsWith('#')) return relDecoded;
      if (/^(https?:|mailto:)/i.test(relDecoded)) return relDecoded;
      if (relDecoded.startsWith('/')) {
        // 站点根路径绝对路径：当作相对于当前静态根
        return `#/${relDecoded.replace(/^\//, '')}`;
      }
      // 普通相对
      const combined = joinPath(baseDir, relDecoded);
      const parts = [];
      for (const seg of combined.split('/')) {
        if (!seg || seg === '.') continue;
        if (seg === '..') parts.pop();
        else parts.push(seg);
      }
      return `#/${parts.join('/')}`;
    }

    // 处理标准 markdown link: [text](url)
    return md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, url) => {
      const u = url.trim();
      // 保留标题，如 (url "title")
      const match = u.match(/^([^\s]+)(\s+"[^"]+")?$/);
      if (!match) return m;
      const target = match[1];
      const title = match[2] || '';

      // 不改动仅锚点
      if (target.startsWith('#')) return m;
      if (/^(https?:|mailto:)/i.test(target)) return m;

      const newUrl = resolve(target);
      return `[${text}](${newUrl}${title})`;
    });
  }

  async function loadIndex() {
    // 尝试从 README.md 推断目录（不依赖额外文件）
    const readmePath = joinPath(LIB_ROOT, 'README.md');
    const md = await fetchText(readmePath);

    const items = [];

    // 匹配形如：- [标题](./卷一-新世记/法兰维亚帝国.md)
    const re = /^\s*[-*+]\s+\[([^\]]+)\]\(([^)]+\.md)\)\s*$/gim;
    let m;
    while ((m = re.exec(md)) !== null) {
      const title = m[1].trim();
      let link = m[2].trim();

      // README 里多为 ./xxx
      link = link.replace(/^\.\//, '');

      // 统一用「解码后的真实路径」作为内部 canonical path，避免出现 %2520 这种双重编码
      const path = decodeURI(joinPath(LIB_ROOT, link));

      // group 取第一级目录（卷一-新世记 等），否则归为 其他
      const parts = path.split('/');
      const group = parts.length >= 3 ? parts[1] : '其他';

      items.push({ title, path, group });
    }

    // 补充 README 与 序言（保证入口）
    items.unshift(
      { title: '总目录', path: joinPath(LIB_ROOT, 'README.md'), group: '其他' },
      { title: '序言', path: joinPath(LIB_ROOT, '序言.md'), group: '其他' }
    );

    // 去重
    const dedup = new Map();
    for (const it of items) dedup.set(it.path, it);

    state.items = Array.from(dedup.values());
    renderNav(state.items, elSearch.value);
  }

  async function loadPage(path) {
    const decoded = decodeURI(path);
    setActive(decoded);
    elCrumb.textContent = decoded;

    elContent.innerHTML = '<div class="content-loading">正在加载内容…</div>';

    try {
      const mdRaw = await fetchText(decoded);
      const md = rewriteRelativeLinks(mdRaw, decoded);

      marked.setOptions({
        gfm: true,
        breaks: false,
      });

      elContent.innerHTML = marked.parse(md);

      // 移动端：点击后自动收起
      if (window.matchMedia('(max-width: 900px)').matches) {
        document.body.classList.remove('sidebar-open');
      }
    } catch (e) {
      elContent.innerHTML = `
        <h1>加载失败</h1>
        <p style="color:#475569">${escapeHtml(e && e.message ? e.message : String(e))}</p>
        <p><a href="#/${LIB_ROOT}/README.md">返回目录</a></p>
      `;
    }
  }

  function onRoute() {
    const path = normalizeHashPath(location.hash);
    loadPage(path);
  }

  function bind() {
    window.addEventListener('hashchange', onRoute);

    elSearch.addEventListener('input', () => {
      renderNav(state.items, elSearch.value);
    });

    elToggle.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });

    // 点击内容区时，移动端可关闭侧栏
    document.addEventListener('click', (ev) => {
      if (!window.matchMedia('(max-width: 900px)').matches) return;
      const target = ev.target;
      if (!(target instanceof Element)) return;
      const sidebar = document.querySelector('.sidebar');
      const toggle = document.getElementById('toggleSidebar');
      if (!sidebar || !toggle) return;
      if (sidebar.contains(target) || toggle.contains(target)) return;
      document.body.classList.remove('sidebar-open');
    });
  }

  async function start() {
    bind();
    await loadIndex();
    onRoute();
  }

  start();
})();
