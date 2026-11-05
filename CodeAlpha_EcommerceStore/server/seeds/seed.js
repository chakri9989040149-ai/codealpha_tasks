require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Order = require('../models/Order');

const seedData = async () => {
  try {
    await connectDB();
    console.log('[Seeder] Connected to database. Clearing existing records...');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Cart.deleteMany({}),
      Order.deleteMany({})
    ]);

    console.log('[Seeder] Creating users...');

    // Seed Users
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('Admin@123456', salt);
    const customerPassword = await bcrypt.hash('Customer@123456', salt);

    const users = await User.create([
      {
        name: 'Alpha Admin',
        email: 'admin@codealpha.com',
        passwordHash: adminPassword,
        role: 'admin'
      },
      {
        name: 'Jane Customer',
        email: 'customer@codealpha.com',
        passwordHash: customerPassword,
        role: 'customer'
      }
    ]);

    console.log(`[Seeder] Seeded ${users.length} users (Admin & Customer).`);

    // Seed Products (14 realistic products across 4 categories)
    const productsData = [
      // 1. Electronics
      {
        title: 'Apex Pro Wireless Noise-Cancelling Headphones',
        description:
          'Immerse yourself in rich, high-fidelity acoustics with custom 40mm dynamic drivers, active hybrid noise cancellation, 45-hour battery life, and plush memory foam earcups.',
        price: 249.99,
        category: 'Electronics',
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
        stock: 24,
        rating: 4.8,
        numReviews: 42,
        isFeatured: true
      },
      {
        title: 'PulseFlow Smart Fitness Watch Series 5',
        description:
          'Track your biometrics, SpO2, heart rate, GPS workouts, and sleep quality on a vivid 1.8-inch AMOLED display with 14-day battery life and water resistance up to 50m.',
        price: 179.99,
        category: 'Electronics',
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
        stock: 35,
        rating: 4.6,
        numReviews: 28,
        isFeatured: true
      },
      {
        title: 'UltraClear 4K 144Hz Gaming Monitor 27"',
        description:
          'Experience fluid gaming and color-accurate productivity with IPS panel technology, 1ms response time, HDR400, and ultra-thin bezels.',
        price: 389.99,
        category: 'Electronics',
        image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80',
        stock: 12,
        rating: 4.9,
        numReviews: 31,
        isFeatured: false
      },
      {
        title: 'Quantum Sound Portable Bluetooth Speaker',
        description:
          'Rugged IPX7 waterproof Bluetooth speaker delivering 360-degree room-filling audio, punchy bass radiators, and 24 hours of non-stop playtime.',
        price: 79.99,
        category: 'Electronics',
        image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&auto=format&fit=crop&q=80',
        stock: 40,
        rating: 4.5,
        numReviews: 19,
        isFeatured: false
      },

      // 2. Fashion
      {
        title: 'Urban Edge Minimalist Leather Jacket',
        description:
          'Crafted from 100% genuine supple lambskin leather with a tailored slim fit, heavy-duty gunmetal YKK zippers, and breathable satin interior lining.',
        price: 189.99,
        category: 'Fashion',
        image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&auto=format&fit=crop&q=80',
        stock: 15,
        rating: 4.7,
        numReviews: 24,
        isFeatured: true
      },
      {
        title: 'AeroLite Breathable Running Sneakers',
        description:
          'Engineered jacquard mesh upper paired with energy-returning nitrogen-infused cushioning. Built for maximum speed, agility, and all-day comfort.',
        price: 119.99,
        category: 'Fashion',
        image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
        stock: 28,
        rating: 4.8,
        numReviews: 53,
        isFeatured: true
      },
      {
        title: 'Classic Tailored Wool Blend Overcoat',
        description:
          'Timeless double-breasted overcoat woven with premium recycled wool fibers. Designed to keep you sharp and warmly insulated through autumn and winter.',
        price: 219.99,
        category: 'Fashion',
        image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&auto=format&fit=crop&q=80',
        stock: 10,
        rating: 4.6,
        numReviews: 15,
        isFeatured: false
      },
      {
        title: 'Modern Utility Water-Resistant Backpack',
        description:
          'Sleek 25L commuter backpack featuring a dedicated 16-inch padded laptop compartment, weatherproof Cordura fabric, and ergonomic shoulder straps.',
        price: 89.99,
        category: 'Fashion',
        image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
        stock: 30,
        rating: 4.7,
        numReviews: 38,
        isFeatured: false
      },

      // 3. Home & Living
      {
        title: 'Artisan Ceramic Pour-Over Coffee Maker',
        description:
          'Hand-glazed heat-retentive ceramic dripper set with borosilicate glass carafe and stainless steel reusable micro-mesh filter for the perfect morning brew.',
        price: 49.99,
        category: 'Home & Living',
        image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80',
        stock: 22,
        rating: 4.9,
        numReviews: 47,
        isFeatured: true
      },
      {
        title: 'Nordic Ambient Dimmable Desk Lamp',
        description:
          'Minimalist architectural lamp with brushed aluminum finish, touch-sensitive step-less dimming, 3 color temperatures, and integrated wireless charging base.',
        price: 64.99,
        category: 'Home & Living',
        image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&auto=format&fit=crop&q=80',
        stock: 18,
        rating: 4.5,
        numReviews: 14,
        isFeatured: false
      },
      {
        title: 'Organic Bamboo Luxury Bed Sheet Set',
        description:
          'Silky smooth 100% organic bamboo viscose 400-thread count sheet set. Naturally thermo-regulating, hypoallergenic, and antibacterial for restful sleep.',
        price: 129.99,
        category: 'Home & Living',
        image: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&auto=format&fit=crop&q=80',
        stock: 14,
        rating: 4.8,
        numReviews: 33,
        isFeatured: false
      },
      {
        title: 'Aromatherapy Ultrasonic Essential Oil Diffuser',
        description:
          '500ml ultrasonic cool mist diffuser with wood grain aesthetic, 7 soothing ambient LED lights, and whisper-quiet operation.',
        price: 39.99,
        category: 'Home & Living',
        image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&auto=format&fit=crop&q=80',
        stock: 25,
        rating: 4.4,
        numReviews: 21,
        isFeatured: false
      },

      // 4. Fitness & Outdoors
      {
        title: 'Titanium Pro Adjustable Dumbbell Set (50lbs)',
        description:
          'Space-saving rapid weight selection system adjusting from 5 to 50 lbs with an intuitive dial mechanism. Durable steel plates with anti-slip knurled grip.',
        price: 299.99,
        category: 'Fitness & Outdoors',
        image: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&auto=format&fit=crop&q=80',
        stock: 8,
        rating: 4.9,
        numReviews: 61,
        isFeatured: true
      },
      {
        title: 'High-Density Eco-Friendly Yoga Mat with Strap',
        description:
          'Non-slip textured TPE mat with laser-etched alignment guides. Provides 6mm of supportive joint cushioning, sweat resistance, and carries easily with cotton strap.',
        price: 45.99,
        category: 'Fitness & Outdoors',
        image: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=800&auto=format&fit=crop&q=80',
        stock: 35,
        rating: 4.7,
        numReviews: 29,
        isFeatured: false
      }
    ];

    const seededProducts = await Product.insertMany(productsData);
    console.log(`[Seeder] Seeded ${seededProducts.length} realistic products across 4 categories.`);

    // Create an initial cart & order for customer user for demonstration
    const customerUser = users[1];
    await Cart.create({
      user: customerUser._id,
      items: [
        { product: seededProducts[0]._id, qty: 1 }
      ]
    });

    await Order.create({
      user: customerUser._id,
      items: [
        {
          product: seededProducts[1]._id,
          title: seededProducts[1].title,
          price: seededProducts[1].price,
          image: seededProducts[1].image,
          qty: 1
        }
      ],
      shippingAddress: {
        fullName: 'Jane Customer',
        street: '742 Evergreen Terrace',
        city: 'Springfield',
        state: 'OR',
        zipCode: '97477',
        country: 'USA',
        phone: '+1 555-0199'
      },
      paymentMethod: 'Credit Card (Simulated)',
      paymentResult: {
        transactionId: 'TXN_SAMPLE_109283',
        status: 'COMPLETED',
        cardLast4: '4242'
      },
      subtotal: seededProducts[1].price,
      shippingPrice: 0,
      taxPrice: Number((seededProducts[1].price * 0.08).toFixed(2)),
      totalPrice: Number((seededProducts[1].price * 1.08).toFixed(2)),
      status: 'Shipped',
      isPaid: true,
      paidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    });

    console.log('[Seeder] Created demo sample order and cart for Jane Customer.');
    console.log('--------------------------------------------------');
    console.log('Seeding completed successfully!');
    console.log('Demo Credentials:');
    console.log('  Admin:    admin@codealpha.com    / Admin@123456');
    console.log('  Customer: customer@codealpha.com / Customer@123456');
    console.log('--------------------------------------------------');

    return { users, seededProducts };
  } catch (err) {
    console.error('[Seeder Error]', err);
    throw err;
  }
};

if (require.main === module) {
  seedData()
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch(async () => {
      await disconnectDB();
      process.exit(1);
    });
}

module.exports = seedData;
