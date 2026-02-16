
export interface BeadType {
    id: string;
    name: string;
    price: number;
    sizeMm: number;
    color: string;
    inStock?: boolean;
}

export interface Design {
    id: string;
    name: string;
    wristSize: number;
    beads: BeadType[];
    totalPrice: number;
    createdAt: number;
    likes: number;
    author: string;
    authorAvatar: string;
    tags?: string[];
    imageUrl?: string;
    description?: string;
    plazaCategoryId?: string;
    isPinned?: boolean;
}

export interface InventoryItem {
    id: string;
    name: string;
    sizeMm: number;
    price: number;
    color: string;
    inStock: boolean;
    /* New detail fields */
    description?: string;
    meaning?: string;
    material?: string;
    element?: string; // e.g. "Water", "Fire"
    images?: string[]; // real photos
}

export interface InventoryCategory {
    id: string;
    name: string;
    subCategories: {
        id: string;
        name: string;
        items: InventoryItem[];
    }[];
}

export interface InventoryTree {
    mainCategories: InventoryCategory[];
}

export interface SystemConfig {
    appUI?: any;
    wristValidation: {
        toleranceMm: number;
        overflowMessage: string;
        underflowMessage: string;
    };
    inventoryTree: InventoryTree;
    features: {
        enableTrade: boolean;
        enableAffiliate: boolean;
        enableCommunity: boolean;
        showPrice: boolean;
        enableAddOns: boolean;
    };
    support?: {
        wechat: string;
        phone: string;
        serviceHours: string;
        faq: Array<{
            question: string;
            answer: string;
        }>;
    };
    agreements?: {
        user: string;
        privacy: string;
        distribution: string;
    };
    messageTemplates?: {
        orderPaid: string;
        orderShipped: string;
        promotion: string;
    };
    designerUI?: {
        watermarkUrl: string;
        beadGapMm: number;
    };
}

export const INITIAL_WRIST_SIZE = 15;

export const DEFAULT_INVENTORY_TREE: InventoryTree = {
    mainCategories: [
        {
            id: 'cat_beads',
            name: '珠子',
            subCategories: [
                {
                    id: 'sub_obsidian',
                    name: '曜石类',
                    items: [
                        {
                            id: 'obsidian-8mm', name: '冰曜石', sizeMm: 8, price: 2.0, color: 'radial-gradient(circle at 30% 30%, rgba(100,100,100,0.9), rgba(20,20,20,1))', inStock: true,
                            description: "冰曜石是黑曜石的一个优质变种，因质地通透如冰、色泽呈半透明的黑冰质感而得名。比普通黑曜石更温润内敛。",
                            meaning: "净化磁场、安神助眠、提升直觉",
                            material: "天然黑曜石",
                            element: "水",
                            images: []
                        },
                        {
                            id: 'obsidian-10mm', name: '冰曜石', sizeMm: 10, price: 6.0, color: 'radial-gradient(circle at 30% 30%, rgba(100,100,100,0.9), rgba(20,20,20,1))', inStock: true,
                            description: "冰曜石是黑曜石的一个优质变种，因质地通透如冰、色泽呈半透明的黑冰质感而得名。",
                            meaning: "辟邪护身、排除负能量",
                            material: "天然黑曜石",
                            element: "水"
                        },
                        {
                            id: 'silver-obsidian-10mm', name: '银曜石', sizeMm: 10, price: 8.0, color: 'radial-gradient(circle at 30% 30%, rgba(180,180,190,0.9), rgba(30,30,40,1))', inStock: true,
                            description: "银曜石散发银色光芒，象征智慧与财富。",
                            meaning: "招财聚气、增强决断力",
                            material: "天然银曜石",
                            element: "金"
                        },
                    ]
                },
                {
                    id: 'sub_crystal',
                    name: '水晶类',
                    items: [
                        { id: 'rose-quartz-8mm', name: '粉水晶', sizeMm: 8, price: 5.5, color: 'radial-gradient(circle at 30% 30%, rgba(255,200,210,0.8), rgba(240,150,170,0.9))', inStock: true },
                        { id: 'rose-quartz-12mm', name: '粉水晶', sizeMm: 12, price: 9.0, color: 'radial-gradient(circle at 30% 30%, rgba(255,200,210,0.8), rgba(240,150,170,0.9))', inStock: true },
                        { id: 'flash-black-crystal', name: '闪灵钻', sizeMm: 12, price: 20.0, color: 'radial-gradient(circle at 40% 40%, rgba(60,60,60,0.8), rgba(0,0,0,1))', inStock: true },
                        { id: 'citrine-8mm', name: '黄水晶', sizeMm: 8, price: 8.0, color: 'radial-gradient(circle at 30% 30%, rgba(255,240,150,0.8), rgba(230,200,50,0.9))', inStock: true },
                        { id: 'amethyst-10mm', name: '紫水晶', sizeMm: 10, price: 12.0, color: 'radial-gradient(circle at 30% 30%, rgba(200,150,255,0.8), rgba(120,50,180,0.9))', inStock: true },
                    ]
                },
                {
                    id: 'sub_pearl',
                    name: '珍珠类',
                    items: [
                        { id: 'pearl-6mm', name: '淡水珍珠', sizeMm: 6, price: 12.0, color: 'radial-gradient(circle at 30% 30%, rgba(255,255,250,1), rgba(220,220,210,1))', inStock: true },
                    ]
                }
            ]
        },
        {
            id: 'cat_accessories',
            name: '配饰',
            subCategories: [
                {
                    id: 'sub_silver',
                    name: '银饰',
                    items: [
                        { id: 'silver-star', name: '纯银星星', sizeMm: 8, price: 25.0, color: 'radial-gradient(circle at 30% 30%, #f0f0f0, #999)', inStock: true },
                        { id: 'silver-spacer', name: '纯银隔片', sizeMm: 4, price: 8.0, color: 'linear-gradient(45deg, #ddd, #999)', inStock: true },
                    ]
                }
            ]
        }
    ]
};

export const DEFAULT_CONFIG: SystemConfig = {
    wristValidation: {
        toleranceMm: 20,
        overflowMessage: "手围长度不够！",
        underflowMessage: "未添加满珠子，请继续添加"
    },
    inventoryTree: DEFAULT_INVENTORY_TREE,
    features: {
        enableTrade: true,
        enableAffiliate: false,
        enableCommunity: true,
        showPrice: true,
        enableAddOns: true
    },
    support: {
        wechat: "",
        phone: "",
        serviceHours: "09:00-21:00",
        faq: [
            {
                question: "下单后多久发货？",
                answer: "通常1-3天内完成制作并发货，节假日可能顺延。"
            },
            {
                question: "可以修改订单地址吗？",
                answer: "未发货前可联系客服修改，已发货需签收后处理。"
            }
        ]
    },
    agreements: {
        user: "欢迎使用本小程序。您在使用过程中应遵守平台规范与相关法律法规。",
        privacy: "我们仅在提供订单与售后服务所必需的范围内收集和处理您的信息。",
        distribution: "分销收益、结算与提现规则以平台实时公告与后台配置为准。"
    },
    messageTemplates: {
        orderPaid: "",
        orderShipped: "",
        promotion: ""
    },
    designerUI: {
        watermarkUrl: '',
        beadGapMm: 1
    }
};

export const TAG_OPTIONS = ["招财进宝", "身体健康", "驱邪避煞", "桃花满满", "学业有成", "水瓶座", "双鱼座", "本命年"];
