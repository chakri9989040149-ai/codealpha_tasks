// CodeAlpha Social - User Profile & Follow System Controller

const Profile = {
  currentProfileUser: null,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const editBtn = document.getElementById('btn-profile-edit');
    const followBtn = document.getElementById('btn-profile-follow');
    const closeEditBtn = document.getElementById('btn-close-edit-profile-modal');
    const formEdit = document.getElementById('form-edit-profile');
    const avatarInput = document.getElementById('edit-profile-file-input');
    const statFollowing = document.getElementById('btn-stat-following');
    const statFollowers = document.getElementById('btn-stat-followers');
    const closeFollowsModal = document.getElementById('btn-close-follows-modal');

    if (editBtn) editBtn.addEventListener('click', () => this.openEditModal());
    if (closeEditBtn) closeEditBtn.addEventListener('click', () => this.closeEditModal());
    if (closeFollowsModal) closeFollowsModal.addEventListener('click', () => this.closeFollowsModal());

    // Avatar preview in edit modal
    if (avatarInput) {
      avatarInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const preview = document.getElementById('edit-profile-avatar-preview');
            if (preview) preview.src = event.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Save profile form submit
    if (formEdit) {
      formEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSaveProfile();
      });
    }

    // Follow / unfollow button on profile
    if (followBtn) {
      followBtn.addEventListener('click', async () => {
        if (!this.currentProfileUser) return;
        await this.handleToggleFollow(this.currentProfileUser._id);
      });
    }

    // Stats click opens followers / following modal
    if (statFollowers) {
      statFollowers.addEventListener('click', () => {
        if (this.currentProfileUser) {
          this.openFollowsModal(this.currentProfileUser._id, 'followers');
        }
      });
    }

    if (statFollowing) {
      statFollowing.addEventListener('click', () => {
        if (this.currentProfileUser) {
          this.openFollowsModal(this.currentProfileUser._id, 'following');
        }
      });
    }
  },

  async loadProfile(username) {
    const container = document.getElementById('profile-posts-container');
    container.innerHTML = '<div class="spinner"></div>';

    try {
      const res = await API.get(`/users/profile/${username}`);
      if (!res.success || !res.profile) {
        throw new Error('User not found');
      }

      this.currentProfileUser = res.profile;
      this.renderProfileHeader(res.profile);
      await this.loadUserPosts(res.profile.username);
    } catch (err) {
      Toast.error(err.message || 'Error loading profile');
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">Profile Not Found</div>
          <p>The user "@${username}" does not exist on CodeAlpha Social.</p>
        </div>
      `;
    }
  },

  renderProfileHeader(user) {
    const avatarEl = document.getElementById('profile-avatar');
    const nameEl = document.getElementById('profile-name');
    const handleEl = document.getElementById('profile-handle');
    const bioEl = document.getElementById('profile-bio');
    const followersEl = document.getElementById('profile-followers-count');
    const followingEl = document.getElementById('profile-following-count');
    const postsEl = document.getElementById('profile-posts-count');
    const editBtn = document.getElementById('btn-profile-edit');
    const followBtn = document.getElementById('btn-profile-follow');
    const joinedEl = document.getElementById('profile-joined-date');

    const avatarSrc = user.avatar || '/uploads/default-avatar.svg';
    if (avatarEl) avatarEl.src = avatarSrc;
    if (nameEl) nameEl.textContent = user.username;
    if (handleEl) handleEl.textContent = `@${user.username}`;
    if (bioEl) bioEl.textContent = user.bio || 'No bio yet.';
    if (followersEl) followersEl.textContent = user.followersCount || 0;
    if (followingEl) followingEl.textContent = user.followingCount || 0;
    if (postsEl) postsEl.textContent = user.postsCount || 0;

    if (joinedEl && user.createdAt) {
      const date = new Date(user.createdAt);
      joinedEl.textContent = `Joined ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    }

    // Is self vs other user
    if (user.isSelf) {
      if (editBtn) editBtn.style.display = 'inline-block';
      if (followBtn) followBtn.style.display = 'none';
    } else {
      if (editBtn) editBtn.style.display = 'none';
      if (followBtn) {
        followBtn.style.display = 'inline-block';
        if (user.isFollowing) {
          followBtn.textContent = 'Following';
          followBtn.classList.add('following');
        } else {
          followBtn.textContent = 'Follow';
          followBtn.classList.remove('following');
        }
      }
    }
  },

  async loadUserPosts(username) {
    const container = document.getElementById('profile-posts-container');
    try {
      const res = await API.get(`/posts/user/${username}`);
      if (res.success) {
        container.innerHTML = '';
        if (res.posts.length === 0) {
          container.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon">📝</div>
              <div class="empty-title">No Posts Yet</div>
              <p>@${username} hasn't shared any posts yet.</p>
            </div>
          `;
          return;
        }

        res.posts.forEach((post) => {
          container.insertAdjacentHTML('beforeend', Posts.createPostCardHTML(post));
        });
      }
    } catch (err) {
      container.innerHTML = `<div style="text-align: center; color: var(--accent-rose); padding: 2rem;">Error loading posts: ${err.message}</div>`;
    }
  },

  async handleToggleFollow(targetUserId) {
    if (!Auth.isAuthenticated()) {
      Auth.openModal('login');
      return;
    }

    const followBtn = document.getElementById('btn-profile-follow');
    const isCurrentlyFollowing = followBtn ? followBtn.classList.contains('following') : false;
    const followersEl = document.getElementById('profile-followers-count');

    // Optimistic toggle
    if (followBtn) {
      if (isCurrentlyFollowing) {
        followBtn.textContent = 'Follow';
        followBtn.classList.remove('following');
        if (followersEl) followersEl.textContent = Math.max(0, (parseInt(followersEl.textContent, 10) || 1) - 1);
      } else {
        followBtn.textContent = 'Following';
        followBtn.classList.add('following');
        if (followersEl) followersEl.textContent = (parseInt(followersEl.textContent, 10) || 0) + 1;
      }
    }

    try {
      if (isCurrentlyFollowing) {
        await API.delete(`/users/${targetUserId}/follow`);
        Toast.info('Unfollowed user');
      } else {
        await API.post(`/users/${targetUserId}/follow`);
        Toast.success('User followed!');
      }

      // Refresh sidebar recommendations
      Explore.loadSuggestedUsers();
    } catch (err) {
      // Revert on error
      if (followBtn) {
        if (isCurrentlyFollowing) {
          followBtn.textContent = 'Following';
          followBtn.classList.add('following');
        } else {
          followBtn.textContent = 'Follow';
          followBtn.classList.remove('following');
        }
      }
      Toast.error(err.message || 'Follow action failed');
    }
  },

  openEditModal() {
    if (!Auth.user) return;
    const modal = document.getElementById('modal-edit-profile');
    const inputUsername = document.getElementById('edit-profile-username');
    const inputBio = document.getElementById('edit-profile-bio');
    const avatarPreview = document.getElementById('edit-profile-avatar-preview');

    if (inputUsername) inputUsername.value = Auth.user.username;
    if (inputBio) inputBio.value = Auth.user.bio || '';
    if (avatarPreview) avatarPreview.src = Auth.user.avatar || '/uploads/default-avatar.svg';

    if (modal) modal.classList.add('open');
  },

  closeEditModal() {
    const modal = document.getElementById('modal-edit-profile');
    if (modal) modal.classList.remove('open');
  },

  async handleSaveProfile() {
    const inputUsername = document.getElementById('edit-profile-username');
    const inputBio = document.getElementById('edit-profile-bio');
    const fileInput = document.getElementById('edit-profile-file-input');
    const saveBtn = document.getElementById('btn-save-profile');

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      const formData = new FormData();
      if (inputUsername) formData.append('username', inputUsername.value.trim());
      if (inputBio) formData.append('bio', inputBio.value.trim());
      if (fileInput && fileInput.files[0]) {
        formData.append('avatar', fileInput.files[0]);
      }

      const res = await API.put('/users/profile', formData);
      if (res.success && res.user) {
        Auth.user = res.user;
        Auth.notify();
        Toast.success('Profile updated successfully!');
        this.closeEditModal();

        // Update current profile view if open
        if (window.location.hash.includes(res.user.username)) {
          this.loadProfile(res.user.username);
        } else {
          window.location.hash = `#profile/${res.user.username}`;
        }
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to update profile');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  },

  async openFollowsModal(userId, type = 'followers') {
    const modal = document.getElementById('modal-follows');
    const titleEl = document.getElementById('modal-follows-title');
    const listEl = document.getElementById('modal-follows-list');

    if (titleEl) titleEl.textContent = type === 'followers' ? 'Followers' : 'Following';
    if (listEl) listEl.innerHTML = '<div class="spinner"></div>';
    if (modal) modal.classList.add('open');

    try {
      const res = await API.get(`/users/${userId}/${type}`);
      const users = (type === 'followers' ? res.followers : res.following) || [];

      if (users.length === 0) {
        listEl.innerHTML = `
          <div style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No ${type} found.
          </div>
        `;
        return;
      }

      listEl.innerHTML = users
        .map((u) => {
          return `
            <div class="suggested-user-item">
              <div class="user-mini-flex" onclick="Profile.closeFollowsModal(); window.location.hash='#profile/${u.username}'">
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
    } catch (err) {
      listEl.innerHTML = `<div style="text-align: center; color: var(--accent-rose); padding: 1rem;">Failed to load ${type}: ${err.message}</div>`;
    }
  },

  closeFollowsModal() {
    const modal = document.getElementById('modal-follows');
    if (modal) modal.classList.remove('open');
  },

  async quickFollowUser(userId, buttonElement) {
    if (!Auth.isAuthenticated()) {
      Auth.openModal('login');
      return;
    }

    const isFollowing = buttonElement.classList.contains('following');
    buttonElement.disabled = true;

    try {
      if (isFollowing) {
        await API.delete(`/users/${userId}/follow`);
        buttonElement.classList.remove('following');
        buttonElement.textContent = 'Follow';
      } else {
        await API.post(`/users/${userId}/follow`);
        buttonElement.classList.add('following');
        buttonElement.textContent = 'Following';
      }
      Explore.loadSuggestedUsers();
    } catch (err) {
      Toast.error(err.message || 'Action failed');
    } finally {
      buttonElement.disabled = false;
    }
  },
};
