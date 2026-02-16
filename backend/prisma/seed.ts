import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultSystemConfig = {
  appUI: {
    appTitle: 'Gem Oratopia',
    logoUrl: '',
    homeBanner: {
      imageUrl: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=800',
      title: 'New Year Collection',
      subtitle: 'Handmade bracelet with intention'
    }
  },
  wristValidation: {
    toleranceMm: 20,
    overflowMessage: 'Bracelet is over the target size',
    underflowMessage: 'Need more beads to reach wrist size'
  },
  announcement: 'Free shipping for orders over 99',
  features: {
    enableTrade: true,
    enableAffiliate: true,
    enableCommunity: true,
    showPrice: true
  },
  business: {
    freeShippingThreshold: 99,
    baseShippingFee: 10,
    handworkFee: 3,
    customerServiceLink: ''
  },
  affiliate: {
    pointsPerYuan: 5,
    commissionRatePercent: 10,
    pointsToMoneyRate: 0.01,
    minWithdrawPoints: 1000,
    pointsRuleText: 'Spend to earn points and commission',
    announcementText: 'Minimum withdrawal is 1000 points'
  },
  agreements: {
    user: 'By using this mini app, you agree to the service terms.',
    privacy: 'We only collect data required for ordering and service.',
    distribution: 'Distribution income is settled according to platform policy.'
  },
  messageTemplates: {
    orderPaid: '',
    orderShipped: '',
    promotion: ''
  },
  plazaCategories: [
    { id: 'cat_bracelets', name: 'Bracelets', sortOrder: 1, visible: true },
    { id: 'cat_rings', name: 'Rings', sortOrder: 2, visible: true },
    { id: 'cat_others', name: 'Others', sortOrder: 3, visible: true }
  ]
};

const inventory = [
  {
    name: 'Beads-Obsidian',
    type: 'bead',
    items: [
      { name: 'Obsidian 8mm', diameter: 8, price: 2, image: 'radial-gradient(circle at 30% 30%, rgba(100,100,100,0.9), rgba(20,20,20,1))', stock: 500 },
      { name: 'Obsidian 10mm', diameter: 10, price: 6, image: 'radial-gradient(circle at 30% 30%, rgba(100,100,100,0.9), rgba(20,20,20,1))', stock: 500 }
    ]
  },
  {
    name: 'Beads-Crystal',
    type: 'bead',
    items: [
      { name: 'Rose Quartz 8mm', diameter: 8, price: 5.5, image: 'radial-gradient(circle at 30% 30%, rgba(255,200,210,0.8), rgba(240,150,170,0.9))', stock: 500 },
      { name: 'Flash Black Crystal 12mm', diameter: 12, price: 20, image: 'radial-gradient(circle at 40% 40%, rgba(60,60,60,0.8), rgba(0,0,0,1))', stock: 200 }
    ]
  },
  {
    name: 'Accessories-Silver',
    type: 'accessory',
    items: [
      { name: 'Silver Spacer', diameter: 4, price: 8, image: 'linear-gradient(45deg, #ddd, #999)', stock: 300 },
      { name: 'Silver Star', diameter: 8, price: 25, image: 'radial-gradient(circle at 30% 30%, #f0f0f0, #999)', stock: 300 }
    ]
  }
];

const addOns = [
  {
    name: 'Gift Box',
    price: 15,
    image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=200',
    category: 'box'
  },
  {
    name: 'Handwritten Card',
    price: 2,
    image: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?q=80&w=200',
    category: 'card'
  }
];

function makeReferralCode(seed: string) {
  return seed.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || `REF${Date.now().toString().slice(-6)}`;
}

async function main() {
  console.log('Seeding database...');

  await prisma.plazaLike.deleteMany();
  await prisma.inventoryReservation.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.logisticsEvent.deleteMany();
  await prisma.pointLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.commissionLog.deleteMany();
  await prisma.withdrawalRequest.deleteMany();
  await prisma.userCoupon.deleteMany();
  await prisma.couponTemplate.deleteMany();
  await prisma.order.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.address.deleteMany();
  await prisma.design.deleteMany();
  await prisma.bead.deleteMany();
  await prisma.beadCategory.deleteMany();
  await prisma.addOnProduct.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.systemConfig.deleteMany();
  await prisma.analyticsEvent.deleteMany();
  await prisma.riskEvent.deleteMany();

  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      openid: 'admin_openid',
      name: 'Platform Admin',
      avatar: '',
      role: 'admin',
      levelName: 'Admin',
      referralCode: makeReferralCode('admin001'),
      points: 0
    }
  });

  const seedUser = await prisma.user.create({
    data: {
      openid: 'seed_user_openid',
      name: 'Seed User',
      avatar: '',
      role: 'user',
      referralCode: makeReferralCode('seeduser'),
      points: 500,
      totalSpend: 168
    }
  });

  for (const categoryData of inventory) {
    const category = await prisma.beadCategory.create({
      data: {
        name: categoryData.name,
        type: categoryData.type
      }
    });

    for (const item of categoryData.items) {
      await prisma.bead.create({
        data: {
          categoryId: category.id,
          name: item.name,
          diameter: item.diameter,
          price: item.price,
          image: item.image,
          stock: item.stock
        }
      });
    }
  }

  for (const addOn of addOns) {
    await prisma.addOnProduct.create({
      data: addOn
    });
  }

  await prisma.systemConfig.create({
    data: {
      configKey: 'app',
      configValue: JSON.stringify(defaultSystemConfig),
      description: 'Global app config'
    }
  });

  await prisma.banner.createMany({
    data: [
      {
        imageUrl: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=600',
        sortOrder: 1,
        isActive: true
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1599643478518-17488fbbcd75?q=80&w=600',
        sortOrder: 2,
        isActive: true
      }
    ]
  });

  const welcomeDesign = await prisma.design.create({
    data: {
      userId: seedUser.id,
      name: 'Ocean Blue',
      wristSize: 15,
      beads: JSON.stringify([]),
      totalPrice: 168,
      imageUrl: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=400',
      isPublic: true,
      likeCount: 12,
      plazaCategoryId: 'cat_bracelets'
    }
  });

  await prisma.address.create({
    data: {
      userId: seedUser.id,
      name: 'Seed User',
      phone: '13800000000',
      region: 'Beijing Chaoyang',
      detail: 'Road 1 No.88',
      tag: 'home',
      isDefault: true
    }
  });

  const couponTemplate = await prisma.couponTemplate.create({
    data: {
      name: 'Welcome Coupon',
      description: 'New user order discount',
      discountType: 'fixed',
      discountValue: 10,
      minAmount: 99,
      totalCount: 10000,
      issuedCount: 1,
      perUserLimit: 1,
      status: 1,
      startAt: new Date(Date.now() - 24 * 3600 * 1000),
      endAt: new Date(Date.now() + 365 * 24 * 3600 * 1000)
    }
  });

  await prisma.userCoupon.create({
    data: {
      userId: seedUser.id,
      templateId: couponTemplate.id,
      status: 'available'
    }
  });

  await prisma.pointLog.create({
    data: {
      userId: seedUser.id,
      amount: 500,
      type: 'bonus',
      reason: 'Seed bonus'
    }
  });

  await prisma.analyticsEvent.create({
    data: {
      userId: seedUser.id,
      eventType: 'seed.init',
      page: 'system'
    }
  });

  await prisma.notification.create({
    data: {
      userId: seedUser.id,
      type: 'system',
      title: 'Welcome',
      content: 'Welcome to Gem Oratopia'
    }
  });

  await prisma.complaint.create({
    data: {
      userId: seedUser.id,
      type: 'complaint',
      title: 'Shipping inquiry',
      content: 'Need shipping update for an order',
      status: 'pending'
    }
  });

  console.log('Seed complete.');
  console.log(`Admin user id: ${admin.id}`);
  console.log(`Seed user id: ${seedUser.id}`);
  console.log(`Sample public design id: ${welcomeDesign.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

