require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Store = require('../models/store');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');

const demoUsersData = [
  {
    username: 'alex_dev',
    email: 'alex@codealpha.io',
    password: 'Password123!',
    bio: '⚡ Full-stack engineer & open-source builder. Loving Node, MongoDB, and high-performance Web APIs.',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    username: 'sarah_design',
    email: 'sarah@codealpha.io',
    password: 'Password123!',
    bio: '🎨 Product & UX Designer. Crafting accessible, sleek dark mode interfaces and fluid micro-interactions.',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    username: 'marcus_cloud',
    email: 'marcus@codealpha.io',
    password: 'Password123!',
    bio: '☁️ Cloud Architect & DevOps enthusiast. Automating infrastructure with Docker, K8s, and Terraform.',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    username: 'elena_ai',
    email: 'elena@codealpha.io',
    password: 'Password123!',
    bio: '🤖 AI/ML Researcher. Exploring agentic workflows, LLMs, and neural network representations.',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    username: 'liam_code',
    email: 'liam@codealpha.io',
    password: 'Password123!',
    bio: '🚀 Frontend artisan & creative coder. Vanilla JavaScript enthusiast, web standards fan & CSS wizard.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&h=200&q=80',
  },
];

const seedData = async (options = { silent: false }) => {
  const isSilent = options.silent;
  const log = (...args) => {
    if (!isSilent) console.log(...args);
  };

  try {
    // If running standalone seed script, ensure DB connection
    if (!mongoose.connection.readyState && Store.isMongooseActive()) {
      await connectDB();
    }

    // Check if users already exist
    const alex = await Store.findUserByUsername('alex_dev');
    if (alex) {
      log('ℹ️ Demo seed data already present. Skipping creation.');
      return;
    }

    log('🌱 Seeding 5 demo users with posts, comments, likes, and follows...');

    const salt = await bcrypt.genSalt(10);
    const createdUsers = [];

    // 1. Create Users
    for (const userData of demoUsersData) {
      const passwordHash = await bcrypt.hash(userData.password, salt);
      const user = await Store.createUser({
        username: userData.username,
        email: userData.email,
        passwordHash,
        bio: userData.bio,
        avatar: userData.avatar,
      });
      createdUsers.push(user);
    }

    log(`✅ Created ${createdUsers.length} demo users: ${createdUsers.map((u) => u.username).join(', ')}`);

    const [alexUser, sarahUser, marcusUser, elenaUser, liamUser] = createdUsers;

    // 2. Setup Follow Relationships
    // Alex follows Sarah, Marcus, Elena
    await Store.followUser(alexUser._id, sarahUser._id);
    await Store.followUser(alexUser._id, marcusUser._id);
    await Store.followUser(alexUser._id, elenaUser._id);

    // Sarah follows Alex, Liam
    await Store.followUser(sarahUser._id, alexUser._id);
    await Store.followUser(sarahUser._id, liamUser._id);

    // Marcus follows Alex, Sarah, Liam
    await Store.followUser(marcusUser._id, alexUser._id);
    await Store.followUser(marcusUser._id, sarahUser._id);
    await Store.followUser(marcusUser._id, liamUser._id);

    // Elena follows Alex, Sarah
    await Store.followUser(elenaUser._id, alexUser._id);
    await Store.followUser(elenaUser._id, sarahUser._id);

    // Liam follows everyone
    await Store.followUser(liamUser._id, alexUser._id);
    await Store.followUser(liamUser._id, sarahUser._id);
    await Store.followUser(liamUser._id, marcusUser._id);
    await Store.followUser(liamUser._id, elenaUser._id);

    log('✅ Follow networks linked');

    // 3. Create Demo Posts
    const p1 = await Store.createPost({
      authorId: alexUser._id,
      text: 'Welcome to CodeAlpha Social! 🚀 Built with Express, MongoDB/Mongoose, JWT auth, and a responsive vanilla JS frontend. Excited to see what everyone builds here! #buildinpublic #webdev #javascript',
      image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80',
    });

    const p2 = await Store.createPost({
      authorId: sarahUser._id,
      text: 'Clean typography and intentional whitespace make all the difference in modern UI. What do you prioritize first: visual hierarchy or color palette? 🎨✨ #design #ux #ui',
      image: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=1200&q=80',
    });

    const p3 = await Store.createPost({
      authorId: marcusUser._id,
      text: 'Just deployed our microservices cluster using automated health checks and zero-downtime rolling updates. Monitoring latency feels like conducting an orchestra! ☁️🎻 #cloud #devops #docker',
      image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    });

    const p4 = await Store.createPost({
      authorId: elenaUser._id,
      text: 'Autonomous agents collaborating in loop-based environments show incredible emergent behavior. The gap between prompt engineering and agentic workflows is narrowing rapidly. 🧠🤖 #ai #machinelearning #future',
      image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    });

    const p5 = await Store.createPost({
      authorId: liamUser._id,
      text: 'Hot take: Vanilla CSS with modern custom properties, flexbox, grid, and CSS subgrid is more powerful and fun than any utility framework. Prove me wrong! 🔥💻 #css #frontend #webstandards',
      image: null,
    });

    const p6 = await Store.createPost({
      authorId: alexUser._id,
      text: 'Pro tip for API design: Always return consistent JSON envelopes with clear status codes and actionable error messages. Your frontend devs will thank you! 🛠️ #backend #nodejs #restapi',
      image: null,
    });

    log('✅ 6 engaging demo posts published');

    // 4. Add Likes
    await Store.toggleLike(p1._id, sarahUser._id);
    await Store.toggleLike(p1._id, marcusUser._id);
    await Store.toggleLike(p1._id, liamUser._id);
    await Store.toggleLike(p1._id, elenaUser._id);

    await Store.toggleLike(p2._id, alexUser._id);
    await Store.toggleLike(p2._id, liamUser._id);

    await Store.toggleLike(p3._id, alexUser._id);
    await Store.toggleLike(p3._id, marcusUser._id);

    await Store.toggleLike(p4._id, alexUser._id);
    await Store.toggleLike(p4._id, sarahUser._id);

    await Store.toggleLike(p5._id, alexUser._id);
    await Store.toggleLike(p5._id, sarahUser._id);
    await Store.toggleLike(p5._id, marcusUser._id);

    log('✅ Likes registered across posts');

    // 5. Add Comments
    await Store.createComment({
      postId: p1._id,
      authorId: sarahUser._id,
      text: 'The glassmorphic design and dark theme look stunning Alex! Super snappy performance too 👏',
    });

    await Store.createComment({
      postId: p1._id,
      authorId: liamUser._id,
      text: 'Zero framework vanilla JS frontend is the cherry on top. Pure web performance! ⚡',
    });

    await Store.createComment({
      postId: p2._id,
      authorId: alexUser._id,
      text: 'Visual hierarchy first, 100%! If the structure is right, the palette enhances it effortlessly.',
    });

    await Store.createComment({
      postId: p5._id,
      authorId: sarahUser._id,
      text: 'Agreed! Modern CSS has evolved so much. Native nesting and container queries are game changers.',
    });

    log('✅ Threaded comments added');

    log('\n=======================================================');
    log('🎉 SEEDING COMPLETE! Demo credentials ready:');
    demoUsersData.forEach((u) => {
      log(`   👤 ${u.username.padEnd(14)} | ${u.email.padEnd(20)} | Password: ${u.password}`);
    });
    log('=======================================================\n');
  } catch (err) {
    console.error('❌ Seeding error:', err);
  }
};

// If run directly via CLI
if (require.main === module) {
  (async () => {
    await connectDB();
    await seedData({ silent: false });
    process.exit(0);
  })();
}

module.exports = { seedData };
