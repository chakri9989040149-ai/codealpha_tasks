// CodeAlpha Social - Explore Page & Search Controller

const Explore = {
  searchDebounceTimer: null,

  init() {
    this.bindSearchEvents();
    this.loadSuggestedUsers();
    this.bindTrendingTags();
  },

  bindSearchEvents() {
    const exploreInput = document.getElementById('explore-search-input');
    const sidebarInput = document.getElementById('sidebar-search-input');

    if (exploreInput) {
      exploreInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
          this.executeSearch(query);
        }, 300);
      });
    }

    if (sidebarInput) {
      sidebarInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const query = sidebarInput.value.trim();
          window.location.hash = '#explore';
          if (exploreInput) {
            exploreInput.value = query;
            this.executeSearch(query);
          }
        }
      });
    }
  },

  bindTrendingTags() {
    document.querySelectorAll('.trending-tag').forEach((item) => {
      item.addEventListener('click', () => {
        const tag = item.dataset.tag;
        window.location.hash = '#explore';
        const exploreInput = document.getElementById('explore-search-input');
        if (exploreInput) {
          exploreInput.value = tag;
          this.executeSearch(tag);
        }
      });
    });
  },

  async loadExploreFeed(searchQuery = '') {
    const container = document.getElementById('explore-posts-container');
    if (!container) return;
    container.innerHTML = '<div class="spinner"></div>';

    try {
      const q = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : '';
      const res = await API.get(`/posts/explore?page=1&limit=20${q}`);

      if (res.success) {
        container.innerHTML = '';
        if (res.posts.length === 0) {
          container.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon">🔍</div>
              <div class="empty-title">No Matching Posts</div>
              <p>Try searching for a different keyword or hashtag.</p>
            </div>
          `;
          return;
        }

        res.posts.forEach((post) => {
          container.insertAdjacentHTML('beforeend', Posts.createPostCardHTML(post));
        });
      }
    } catch (err) {
      container.innerHTML = `<div style="text-align: center; color: var(--accent-rose); padding: 2rem;">Error: ${err.message}</div>`;
    }
  },

  async executeSearch(query) {
    const usersSection = document.getElementById('explore-users-section');
    const usersList = document.getElementById('explore-users-list');

    if (!query) {
      if (usersSection) usersSection.style.display = 'none';
      this.loadExploreFeed('');
      return;
    }

    // Search users
    try {
      const res = await API.get(`/users/search?q=${encodeURIComponent(query)}&limit=6`);
      if (res.success && res.users && res.users.length > 0) {
        if (usersSection) usersSection.style.display = 'block';
        if (usersList) {
          usersList.innerHTML = res.users
            .map((u) => {
              return `
                <div class="suggested-user-item">
                  <div class="user-mini-flex" onclick="window.location.hash='#profile/${u.username}'">
                    <img src="${u.avatar || '/uploads/default-avatar.svg'}" class="mini-avatar" alt="${u.username}" />
                    <div class="mini-names">
                      <div class="mini-name">${u.username}</div>
                      <div class="mini-handle">${u.bio ? u.bio.slice(0, 45) + '...' : '@' + u.username}</div>
                    </div>
                  </div>
                  ${
                    !u.isSelf && Auth.isAuthenticated()
                      ? `<button class="btn-follow ${u.isFollowing ? 'following' : ''}" onclick="Profile.quickFollowUser('${u._id}', this)">
                          ${u.isFollowing ? 'Following' : 'Follow'}
                         </button>`
                      : ''
                  }
                </div>
              `;
            })
            .join('');
        }
      } else {
        if (usersSection) usersSection.style.display = 'none';
      }
    } catch (err) {
      console.warn('User search error:', err);
    }

    // Search posts
    await this.loadExploreFeed(query);
  },

  async loadSuggestedUsers() {
    const container = document.getElementById('sidebar-suggested-users');
    if (!container) return;

    try {
      const res = await API.get('/users/suggested');
      if (res.success && res.suggested) {
        if (res.suggested.length === 0) {
          container.innerHTML = '<div style="font-size: 0.82rem; color: var(--text-muted);">No suggestions right now.</div>';
          return;
        }

        container.innerHTML = res.suggested
          .map((u) => {
            return `
              <div class="suggested-user-item">
                <div class="user-mini-flex" onclick="window.location.hash='#profile/${u.username}'">
                  <img src="${u.avatar || '/uploads/default-avatar.svg'}" class="mini-avatar" alt="${u.username}" />
                  <div class="mini-names">
                    <div class="mini-name">${u.username}</div>
                    <div class="mini-handle">@${u.username}</div>
                  </div>
                </div>
                ${
                  !u.isSelf && Auth.isAuthenticated()
                    ? `<button class="btn-follow ${u.isFollowing ? 'following' : ''}" onclick="Profile.quickFollowUser('${u._id}', this)">
                        ${u.isFollowing ? 'Following' : 'Follow'}
                       </button>`
                    : ''
                }
              </div>
            `;
          })
          .join('');
      }
    } catch (err) {
      container.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-muted);">Could not load suggestions.</div>';
    }
  },
};
