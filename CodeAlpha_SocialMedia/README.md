# CodeAlpha Social — Modern Full-Stack Mini Social Media Application

[![Node.js](https://img.shields.io/badge/Node.js-v24.x-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-v4.21-lightgrey.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-brightgreen.svg)](https://mongoosejs.com/)
[![Vanilla JS](https://img.shields.io/badge/Frontend-Vanilla%20JS%20%2B%20CSS3-blue.svg)](#frontend)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A high-performance, responsive mini social media platform built for developers, creators, and tech enthusiasts. Designed with a sleek glassmorphic dark theme, micro-interactions, pure HTML5/CSS3/Vanilla JavaScript on the frontend, and a secure Express.js + MongoDB backend.

---

## 🌟 Key Features

1. **Authentication & Security**
   - User registration and login with input validation (`express-validator`).
   - Secure password hashing with `bcryptjs`.
   - Stateless session management with JSON Web Tokens (`jsonwebtoken`).
   - Rate limiting on authentication routes to prevent brute-force attacks (`express-rate-limit`).
   - Security HTTP headers enabled via `helmet` and Cross-Origin Resource Sharing with `cors`.
   - Quick one-click demo logins for 5 seeded developer accounts.

2. **User Profiles**
   - Dynamic user profile view with cover backdrop, profile avatar, custom bio, and joined date.
   - Live clickable follower and following counts.
   - Comprehensive profile edit modal allowing instant bio and avatar image uploads.
   - Tabbed view showing all posts authored by the user.

3. **Feed & Content Discovery**
   - **Personalized Home Feed**: Chronological feed showing posts from accounts the user follows plus their own posts.
   - **Global Explore Feed**: Browse recent public posts across the entire network with instant keyword and hashtag filtering.
   - **Infinite Pagination**: Smooth "Load More" pagination support.

4. **Rich Post Creation & Media Uploads**
   - Create posts up to 1000 characters with interactive character counter.
   - Image attachment upload with live thumbnail preview and file validation powered by `multer` (served from `/uploads`).
   - Full post deletion rights reserved exclusively for the author with ownership verification.

5. **Live Likes & Interactions**
   - Toggle like/unlike with animated heart effect, per-user state persistence, and instant live count updates.
   - Interactive comment threads with reply submission and author-exclusive comment deletion.

6. **Follow System**
   - Follow and unfollow other creators directly from their profile, search results, or the "Who to follow" sidebar widget.
   - Dedicated modal listing followers and following with quick follow action buttons.

7. **Universal Database Architecture**
   - Native integration with MongoDB through `Mongoose`.
   - Zero-config automatic In-Memory Store fallback when external MongoDB is not present, allowing the app to run and test out of the box in any environment without database blockers.

---

## 🛠️ Tech Stack

### Frontend
- **HTML5**: Clean semantic document layout (`<header>`, `<nav>`, `<main>`, `<aside>`, `<section>`, `<article>`).
- **CSS3**: Modern CSS design system featuring custom properties, glassmorphism, flexbox, CSS grid, and micro-animations. No heavyweight CSS frameworks.
- **Vanilla JavaScript**: Pure ES6+ modules (`api.js`, `auth.js`, `posts.js`, `comments.js`, `profile.js`, `explore.js`, `app.js`) with client-side hash routing (`#home`, `#explore`, `#profile/:username`).
- **Typography**: Google Fonts (*Inter* & *Outfit*).

### Backend
- **Runtime**: Node.js
- **Web Framework**: Express.js (REST API following MVC separation)
- **Database & ODM**: MongoDB with Mongoose
- **File Uploads**: Multer (file type and size constraints)
- **Authentication**: JWT (JSON Web Tokens) & BcryptJS
- **Security & Utilities**: Helmet, CORS, Express-Rate-Limit, Express-Validator, Morgan

---

## 📁 Project Structure

```text
CodeAlpha_SocialMedia/
├── .env.example              # Environment variables template
├── .env                      # Local environment configuration
├── .gitignore                # Git ignore rules
├── package.json              # Project metadata, dependencies & scripts
├── README.md                 # Project documentation
├── server/
│   ├── config/
│   │   └── db.js             # Resilient database connection manager
│   ├── controllers/
│   │   ├── authController.js    # Register, login, getMe
│   │   ├── commentController.js # Add, get, delete comments
│   │   ├── postController.js    # Create, feed, explore, like, delete
│   │   └── userController.js    # Profiles, follow/unfollow, search
│   ├── middleware/
│   │   ├── auth.js           # JWT verification & optional auth
│   │   ├── errorHandler.js   # Centralized error handler
│   │   ├── rateLimiter.js    # Auth & API rate limiters
│   │   ├── upload.js         # Multer image upload configuration
│   │   └── validators.js     # Express-validator schemas
│   ├── models/
│   │   ├── Comment.js        # Mongoose Comment schema
│   │   ├── Post.js           # Mongoose Post schema
│   │   ├── User.js           # Mongoose User schema
│   │   └── store.js          # Universal Mongoose + In-Memory store
│   ├── routes/
│   │   ├── authRoutes.js     # /api/auth routes
│   │   ├── commentRoutes.js  # /api/comments routes
│   │   ├── postRoutes.js     # /api/posts routes
│   │   └── userRoutes.js     # /api/users routes
│   ├── scripts/
│   │   └── seed.js           # Seeds 5 demo users, posts, comments, likes, follows
│   ├── uploads/              # Uploaded media storage
│   └── server.js             # Express application entry point
└── client/
    ├── css/
    │   └── style.css         # Glassmorphic dark styling & responsive rules
    ├── js/
    │   ├── api.js            # Fetch wrapper, JWT token headers & toasts
    │   ├── auth.js           # Auth state & quick-login actions
    │   ├── comments.js       # Comment modal & thread management
    │   ├── explore.js        # Search debouncing & recommendations
    │   ├── posts.js          # Post cards & composer interactions
    │   ├── profile.js        # User profiles & follow actions
    │   └── app.js            # Hash router & coordinator
    └── index.html            # Main single-page application shell
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18.x or later recommended)
- **NPM** (v9.x or later)
- *(Optional)* **MongoDB** (Local `mongod` service or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster URI)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/YourUsername/CodeAlpha_SocialMedia.git
cd CodeAlpha_SocialMedia
npm install
```

### 3. Environment Setup
Copy the example environment file:
```bash
cp .env.example .env
```
Default configuration values in `.env`:
```env
PORT=3002
MONGODB_URI=mongodb://localhost:27017/codealpha_social
JWT_SECRET=codealpha_super_secret_jwt_key_2026_dev_secure_random
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3002
MAX_FILE_SIZE_MB=5
```
> **Note on MongoDB**: If a MongoDB instance is running at `MONGODB_URI`, the server will connect automatically. If no external database is detected, the application smoothly engages its In-Memory Document Store so you can immediately explore and test every feature without friction!

### 4. Seed Demo Data
To populate 5 demo users with posts, comments, likes, and follower networks:
```bash
npm run seed
```

### 5. Running the Application
To run in production mode:
```bash
npm start
```
To run in development mode with automatic restart on file changes:
```bash
npm run dev
```

Open your browser at:
```text
http://localhost:3002
```

---

## 👥 Demo User Credentials

All demo users share the default password: `Password123!`

| Username | Email | Role |
| :--- | :--- | :--- |
| **`alex_dev`** | `alex@codealpha.io` | Full-stack Engineer |
| **`sarah_design`** | `sarah@codealpha.io` | Product & UX Designer |
| **`marcus_cloud`** | `marcus@codealpha.io` | Cloud Architect & DevOps |
| **`elena_ai`** | `elena@codealpha.io` | AI/ML Researcher |
| **`liam_code`** | `liam@codealpha.io` | Frontend Artisan |

*Tip: You can also use the one-click demo login buttons directly inside the Sign-In modal in the app!*

---

## 📡 REST API Reference

All API routes are prefixed under `/api`.

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new user account | No |
| `POST` | `/api/auth/login` | Authenticate with username/email & password | No |
| `GET` | `/api/auth/me` | Fetch currently authenticated user | Yes |

### Users (`/api/users`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users/profile/:username` | Get public user profile & metrics | Optional |
| `PUT` | `/api/users/profile` | Update profile bio/username or avatar image | Yes |
| `POST` | `/api/users/:id/follow` | Follow a user | Yes |
| `DELETE` | `/api/users/:id/follow` | Unfollow a user | Yes |
| `GET` | `/api/users/:id/followers` | Get user's followers list | Optional |
| `GET` | `/api/users/:id/following` | Get user's following list | Optional |
| `GET` | `/api/users/search?q=:query` | Search users by username or bio | Optional |
| `GET` | `/api/users/suggested` | Get recommended accounts to follow | Optional |

### Posts (`/api/posts`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/posts/feed?page=1` | Get home feed (following + self) | Yes |
| `GET` | `/api/posts/explore?page=1&search=` | Get global explore posts | Optional |
| `GET` | `/api/posts/user/:username` | Get posts by a specific user | Optional |
| `GET` | `/api/posts/:id` | Get single post details | Optional |
| `POST` | `/api/posts` | Create new post (text + optional image) | Yes |
| `DELETE` | `/api/posts/:id` | Delete post (author ownership enforced) | Yes |
| `POST` | `/api/posts/:id/like` | Toggle like/unlike on a post | Yes |
| `DELETE` | `/api/posts/:id/like` | Unlike a post | Yes |

### Comments (`/api/comments`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/comments/post/:postId` | Get all comments on a post | Optional |
| `POST` | `/api/comments/post/:postId` | Add a comment to a post | Yes |
| `DELETE` | `/api/comments/:id` | Delete comment (author ownership enforced) | Yes |

---

## 📸 Screenshots

*(Place application screenshots in `client/assets/` or link live previews)*

| Home Feed & Composer | User Profile & Follows |
| :---: | :---: |
| ![Home Feed](https://via.placeholder.com/600x380/111827/ffffff?text=CodeAlpha+Feed+Preview) | ![Profile View](https://via.placeholder.com/600x380/111827/ffffff?text=User+Profile+Preview) |

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
