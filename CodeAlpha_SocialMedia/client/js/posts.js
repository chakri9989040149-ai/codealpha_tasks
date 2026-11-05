// CodeAlpha Social - Posts Feed & Composer Controller

const Posts = {
  activeFeedTab: 'feed', // 'feed' (following) or 'explore' (global)
  currentPage: 1,
  hasMore: false,
  isLoading: false,
  selectedImageFile: null,

  init() {
    this.bindComposerEvents();
    this.bindTabEvents();
  },

  bindTabEvents() {
    const tabHome = document.getElementById('tab-feed-home');
    const tabExplore = document.getElementById('tab-feed-explore');

    if (tabHome) {
      tabHome.addEventListener('click', () => {
        if (this.activeFeedTab === 'feed') return;
        this.activeFeedTab = 'feed';
        tabHome.classList.add('active');
        if (tabExplore) tabExplore.classList.remove('active');
        this.loadHomeFeed(1);
      });
    }

    if (tabExplore) {
      tabExplore.addEventListener('click', () => {
        if (this.activeFeedTab === 'explore') return;
        this.activeFeedTab = 'explore';
        tabExplore.classList.add('active');
        if (tabHome) tabHome.classList.remove('active');
        this.loadHomeFeed(1);
      });
    }

    const loadMoreBtn = document.getElementById('btn-home-load-more');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        if (this.hasMore && !this.isLoading) {
          this.loadHomeFeed(this.currentPage + 1, true);
        }
      });
    }
  },

  bindComposerEvents() {
    const textInput = document.getElementById('composer-input-text');
    const charCounter = document.getElementById('composer-char-counter');
    const submitBtn = document.getElementById('btn-submit-post');
    const fileInput = document.getElementById('composer-file-input');
    const attachBtn = document.getElementById('btn-composer-attach-image');
    const previewWrapper = document.getElementById('composer-preview-wrapper');
    const previewImg = document.getElementById('composer-preview-img');
    const removeImgBtn = document.getElementById('btn-composer-remove-img');
    const sidebarNewPostBtn = document.getElementById('btn-sidebar-new-post');

    // Auto-expand textarea & update char count
    if (textInput) {
      textInput.addEventListener('focus', () => {
        if (!Auth.isAuthenticated()) {
          Auth.openModal('login');
          textInput.blur();
        }
      });
      textInput.addEventListener('input', () => {
        textInput.style.height = 'auto';
        textInput.style.height = `${Math.min(textInput.scrollHeight, 200)}px`;
        const count = textInput.value.length;
        if (charCounter) charCounter.textContent = `${count} / 1000`;
        this.updateSubmitBtnState();
      });
    }

    // Attach image trigger
    if (attachBtn && fileInput) {
      attachBtn.addEventListener('click', () => {
        if (!Auth.isAuthenticated()) {
          Auth.openModal('login');
          return;
        }
        fileInput.click();
      });
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
          Toast.error('Selected image exceeds 5MB limit.');
          fileInput.value = '';
          return;
        }

        this.selectedImageFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
          if (previewImg && previewWrapper) {
            previewImg.src = event.target.result;
            previewWrapper.style.display = 'block';
          }
          this.updateSubmitBtnState();
        };
        reader.readAsDataURL(file);
      });
    }

    // Remove image preview
    if (removeImgBtn) {
      removeImgBtn.addEventListener('click', () => {
        this.selectedImageFile = null;
        if (fileInput) fileInput.value = '';
        if (previewWrapper) previewWrapper.style.display = 'none';
        if (previewImg) previewImg.src = '';
        this.updateSubmitBtnState();
      });
    }

    // Post Submit
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.handleCreatePost());
    }

    // Sidebar "New Post" button scrolls and focuses on composer
    if (sidebarNewPostBtn) {
      sidebarNewPostBtn.addEventListener('click', () => {
        if (!Auth.isAuthenticated()) {
          Auth.openModal('login');
          return;
        }
        window.location.hash = '#home';
        if (textInput) {
          textInput.scrollIntoView({ behavior: 'smooth' });
          textInput.focus();
        }
      });
    }
  },

  updateSubmitBtnState() {
    const textInput = document.getElementById('composer-input-text');
    const submitBtn = document.getElementById('btn-submit-post');
    if (!submitBtn) return;

    const hasText = textInput && textInput.value.trim().length > 0;
    const hasImage = !!this.selectedImageFile;

    submitBtn.disabled = !hasText && !hasImage;
  },

  async handleCreatePost() {
    if (!Auth.isAuthenticated()) {
      Auth.openModal('login');
      return;
    }

    const textInput = document.getElementById('composer-input-text');
    const submitBtn = document.getElementById('btn-submit-post');
    const text = textInput ? textInput.value.trim() : '';

    if (!text && !this.selectedImageFile) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';

    try {
      const formData = new FormData();
      if (text) formData.append('text', text);
      if (this.selectedImageFile) formData.append('image', this.selectedImageFile);

      const res = await API.post('/posts', formData);
      if (res.success && res.post) {
        Toast.success('Post published to feed!');

        // Reset composer
        if (textInput) {
          textInput.value = '';
          textInput.style.height = 'auto';
        }
        const counter = document.getElementById('composer-char-counter');
        if (counter) counter.textContent = '0 / 1000';

        const removeBtn = document.getElementById('btn-composer-remove-img');
        if (removeBtn) removeBtn.click();

        // Prepend new post card to home feed
        const feedContainer = document.getElementById('home-posts-container');
        if (feedContainer) {
          const emptyState = feedContainer.querySelector('.empty-state');
          if (emptyState) emptyState.remove();

          const cardHtml = this.createPostCardHTML(res.post);
          feedContainer.insertAdjacentHTML('afterbegin', cardHtml);
        }
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to publish post');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Post';
      this.updateSubmitBtnState();
    }
  },

  async loadHomeFeed(page = 1, append = false) {
    const container = document.getElementById('home-posts-container');
    const loadMoreBox = document.getElementById('home-load-more-container');
    if (!container) return;

    this.isLoading = true;
    if (!append) {
      container.innerHTML = '<div class="spinner"></div>';
    }

    try {
      let endpoint = '/posts/feed';
      // If explore tab active or user is not logged in, fetch explore endpoint
      if (this.activeFeedTab === 'explore' || !Auth.isAuthenticated()) {
        endpoint = '/posts/explore';
      }

      const res = await API.get(`${endpoint}?page=${page}&limit=10`);

      if (res.success) {
        this.currentPage = res.pagination.page;
        this.hasMore = res.pagination.hasMore;

        if (loadMoreBox) {
          loadMoreBox.classList.toggle('hidden', !this.hasMore);
        }

        if (!append) {
          container.innerHTML = '';
        }

        if (res.posts.length === 0 && !append) {
          container.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon">📭</div>
              <div class="empty-title">${this.activeFeedTab === 'feed' ? 'Your Feed is Empty' : 'No Posts Found'}</div>
              <p>${
                this.activeFeedTab === 'feed'
                  ? 'Follow creators on the Explore page or switch to Global Explore above to discover posts!'
                  : 'Be the first to publish a post!'
              }</p>
            </div>
          `;
          return;
        }

        res.posts.forEach((post) => {
          container.insertAdjacentHTML('beforeend', this.createPostCardHTML(post));
        });
      }
    } catch (err) {
      container.innerHTML = `<div style="text-align: center; color: var(--accent-rose); padding: 2rem;">Error loading posts: ${err.message}</div>`;
    } finally {
      this.isLoading = false;
    }
  },

  createPostCardHTML(post) {
    const author = post.author || {};
    const authorId = author._id ? author._id.toString() : '';
    const isOwner = Auth.isAuthenticated() && Auth.user && (
      authorId === Auth.user._id.toString() || author.username === Auth.user.username
    );

    const isLiked = !!post.isLiked;
    const likesCount = post.likesCount !== undefined ? post.likesCount : (post.likes ? post.likes.length : 0);
    const commentsCount = post.commentsCount || 0;

    return `
      <article class="post-card" id="post-${post._id}">
        <div class="post-avatar-col">
          <img
            src="${author.avatar || '/uploads/default-avatar.svg'}"
            alt="${author.username || 'User'}"
            class="post-avatar"
            onclick="window.location.hash='#profile/${author.username}'"
          />
        </div>
        <div class="post-main">
          <header class="post-header">
            <div class="post-author-info" onclick="window.location.hash='#profile/${author.username}'">
              <span class="post-author-name">${author.username || 'Anonymous'}</span>
              <span class="post-author-handle">@${author.username || 'anonymous'}</span>
              <span class="post-dot">·</span>
              <span class="post-time">${formatTimeAgo(post.createdAt)}</span>
            </div>
            ${
              isOwner
                ? `<button class="post-menu-btn" title="Delete post" onclick="Posts.handleDeletePost('${post._id}')">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                   </button>`
                : ''
            }
          </header>

          <div class="post-text">${formatPostText(post.text || '')}</div>

          ${
            post.image
              ? `<div class="post-image-container">
                  <img src="${post.image}" alt="Post attachment" class="post-image" loading="lazy" />
                 </div>`
              : ''
          }

          <footer class="post-actions">
            <!-- Like Button -->
            <button
              class="action-btn like-btn ${isLiked ? 'liked' : ''}"
              id="like-btn-${post._id}"
              title="Like"
              onclick="Posts.handleToggleLike('${post._id}')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
              <span class="like-count">${likesCount}</span>
            </button>

            <!-- Comments Button -->
            <button
              class="action-btn"
              title="Comment"
              onclick="Comments.openModal('${post._id}')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
              <span class="comment-count">${commentsCount}</span>
            </button>

            <!-- Share / Copy Link Button -->
            <button
              class="action-btn"
              title="Copy Link"
              onclick="Posts.copyPostLink('${post._id}')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
            </button>
          </footer>
        </div>
      </article>
    `;
  },

  async handleToggleLike(postId) {
    if (!Auth.isAuthenticated()) {
      Auth.openModal('login');
      return;
    }

    const btn = document.getElementById(`like-btn-${postId}`);
    const countEl = btn ? btn.querySelector('.like-count') : null;
    const isCurrentlyLiked = btn ? btn.classList.contains('liked') : false;

    // Optimistic toggle
    if (btn && countEl) {
      const curCount = parseInt(countEl.textContent, 10) || 0;
      if (isCurrentlyLiked) {
        btn.classList.remove('liked');
        countEl.textContent = Math.max(0, curCount - 1);
      } else {
        btn.classList.add('liked');
        countEl.textContent = curCount + 1;
      }
    }

    try {
      const res = await API.post(`/posts/${postId}/like`);
      if (res.success && countEl) {
        countEl.textContent = res.likesCount;
        if (res.liked) {
          btn.classList.add('liked');
        } else {
          btn.classList.remove('liked');
        }
      }
    } catch (err) {
      // Revert on error
      if (btn && countEl) {
        if (isCurrentlyLiked) {
          btn.classList.add('liked');
        } else {
          btn.classList.remove('liked');
        }
      }
      Toast.error(err.message || 'Failed to update like status');
    }
  },

  async handleDeletePost(postId) {
    if (!confirm('Are you sure you want to permanently delete this post?')) return;

    try {
      const res = await API.delete(`/posts/${postId}`);
      if (res.success) {
        Toast.info('Post deleted successfully');
        const card = document.getElementById(`post-${postId}`);
        if (card) {
          card.style.opacity = '0';
          card.style.transform = 'translateY(-10px)';
          card.style.transition = 'all 0.3s ease';
          setTimeout(() => card.remove(), 300);
        }
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to delete post');
    }
  },

  copyPostLink(postId) {
    const url = `${window.location.origin}/#post/${postId}`;
    navigator.clipboard.writeText(url).then(() => {
      Toast.success('Post link copied to clipboard!');
    }).catch(() => {
      Toast.info(`Post link: ${url}`);
    });
  },
};
