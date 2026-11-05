// CodeAlpha Social - Comments Component & Modal Handler

const Comments = {
  currentPostId: null,

  async openModal(postId) {
    this.currentPostId = postId;
    const modal = document.getElementById('modal-comments');
    if (!modal) return;
    modal.classList.add('open');

    // Reset list and load
    const listEl = document.getElementById('modal-comments-list');
    listEl.innerHTML = '<div class="spinner"></div>';

    // Display preview of target post
    const postPreviewEl = document.getElementById('comments-modal-post-preview');
    try {
      const postData = await API.get(`/posts/${postId}`);
      if (postData.success && postData.post) {
        const p = postData.post;
        const author = p.author || {};
        postPreviewEl.innerHTML = `
          <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
            <img src="${author.avatar || '/uploads/default-avatar.svg'}" class="mini-avatar" alt="Author" />
            <div>
              <div style="font-weight: 600; font-size: 0.95rem;">${author.username || 'User'} <span style="color: var(--text-muted); font-size: 0.8rem;">· ${formatTimeAgo(p.createdAt)}</span></div>
              <div style="font-size: 0.92rem; color: #e5e7eb; margin-top: 0.3rem;">${formatPostText(p.text || '')}</div>
            </div>
          </div>
        `;
      }
    } catch (err) {
      postPreviewEl.innerHTML = '';
    }

    await this.loadComments(postId);
  },

  closeModal() {
    const modal = document.getElementById('modal-comments');
    if (modal) modal.classList.remove('open');
    this.currentPostId = null;
  },

  async loadComments(postId) {
    const listEl = document.getElementById('modal-comments-list');
    try {
      const data = await API.get(`/comments/post/${postId}`);
      if (data.success) {
        this.renderComments(data.comments || []);
      }
    } catch (err) {
      listEl.innerHTML = `<div style="text-align: center; color: var(--accent-rose); padding: 1rem;">Failed to load comments: ${err.message}</div>`;
    }
  },

  renderComments(comments) {
    const listEl = document.getElementById('modal-comments-list');
    if (!comments || comments.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 2rem 1rem;">
          No comments yet. Start the conversation!
        </div>
      `;
      return;
    }

    listEl.innerHTML = comments
      .map((c) => {
        const author = c.author || {};
        const isOwner = Auth.isAuthenticated() && Auth.user && (
          (author._id && author._id.toString() === Auth.user._id.toString()) ||
          (author.username === Auth.user.username)
        );

        return `
          <div class="comment-item" id="comment-${c._id}">
            <img src="${author.avatar || '/uploads/default-avatar.svg'}" class="comment-avatar" alt="${author.username || 'User'}" />
            <div class="comment-content">
              <div class="comment-header">
                <div>
                  <span class="comment-author-name" style="cursor: pointer;" onclick="window.location.hash='#profile/${author.username}'">
                    ${author.username || 'Anonymous'}
                  </span>
                  <span class="comment-time">· ${formatTimeAgo(c.createdAt)}</span>
                </div>
                ${
                  isOwner
                    ? `<button class="comment-delete-btn" title="Delete comment" onclick="Comments.deleteComment('${c._id}')">🗑️</button>`
                    : ''
                }
              </div>
              <div class="comment-text">${formatPostText(c.text)}</div>
            </div>
          </div>
        `;
      })
      .join('');
  },

  async addComment(text) {
    if (!Auth.isAuthenticated()) {
      Auth.openModal('login');
      return;
    }

    if (!this.currentPostId || !text.trim()) return;

    try {
      const data = await API.post(`/comments/post/${this.currentPostId}`, { text: text.trim() });
      if (data.success) {
        Toast.success('Comment posted!');
        document.getElementById('input-comment-text').value = '';
        await this.loadComments(this.currentPostId);

        // Update comment counter in post card
        const countEl = document.querySelector(`#post-${this.currentPostId} .comment-count`);
        if (countEl) {
          const current = parseInt(countEl.textContent, 10) || 0;
          countEl.textContent = current + 1;
        }
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to post comment');
    }
  },

  async deleteComment(commentId) {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const data = await API.delete(`/comments/${commentId}`);
      if (data.success) {
        Toast.info('Comment deleted');
        const el = document.getElementById(`comment-${commentId}`);
        if (el) el.remove();

        // Decrement comment counter in post card
        if (this.currentPostId) {
          const countEl = document.querySelector(`#post-${this.currentPostId} .comment-count`);
          if (countEl) {
            const current = parseInt(countEl.textContent, 10) || 1;
            countEl.textContent = Math.max(0, current - 1);
          }
        }
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to delete comment');
    }
  },
};

// Bind Comments UI Events
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('btn-close-comments-modal');
  if (closeBtn) closeBtn.addEventListener('click', () => Comments.closeModal());

  const formAdd = document.getElementById('form-add-comment');
  if (formAdd) {
    formAdd.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('input-comment-text');
      if (input && input.value) {
        Comments.addComment(input.value);
      }
    });
  }
});
