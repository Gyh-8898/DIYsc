export const DEFAULT_SYSTEM_CONFIG = {
  appUI: {
    appTitle: '晶奥之境',
    logoUrl: '',
    homeBanner: {
      imageUrl: '',
      title: '新年系列',
      subtitle: '手作手串，随心定制'
    }
  },
  wristValidation: {
    toleranceMm: 20,
    overflowMessage: '手串长度已超过目标手围',
    underflowMessage: '手串长度不足，请继续添加珠子'
  },
  announcement: '满99元包邮',
  features: {
    enableTrade: true,
    enableAffiliate: true,
    enableCommunity: true,
    showPrice: true,
    enableAddOns: true
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
    pointsRuleText: '消费可得积分与推荐佣金',
    announcementText: '最低提现1000积分'
  },
  support: {
    wechat: '',
    phone: '',
    serviceHours: '09:00-21:00',
    faq: [
      {
        question: '下单后多久发货？',
        answer: '通常在制作完成后 1-3 天内发货。'
      },
      {
        question: '下单后可以修改地址吗？',
        answer: '发货前可联系客服协助修改收货地址。'
      }
    ]
  },
  agreements: {
    user: '使用本小程序即表示你同意相关服务条款。',
    privacy: '我们仅收集下单与服务所必需的数据。',
    distribution: '分销收益按平台规则结算。'
  },
  messageTemplates: {
    orderPaid: '',
    orderShipped: '',
    promotion: ''
  },
  integrations: {
    payment: {
      provider: 'wechat',
      enabled: false,
      appId: '',
      mchId: '',
      mchKey: '',
      notifyUrl: ''
    },
    logistics: {
      provider: 'manual',
      enabled: false,
      companyId: '',
      apiKey: '',
      apiSecret: ''
    },
    qiniu: {
      enabled: false,
      accessKey: '',
      secretKey: '',
      bucket: '',
      domain: '',
      region: 'z2'
    },
    platforms: []
  },
  designerUI: {
    watermarkUrl: '',
    beadGapMm: 1
  },
  plazaCategories: [
    { id: 'cat_bracelets', name: '手串', sortOrder: 1, visible: true },
    { id: 'cat_rings', name: '戒指', sortOrder: 2, visible: true },
    { id: 'cat_others', name: '其他', sortOrder: 3, visible: true }
  ],
  plazaPinnedIds: []
};

