import { InventoryTree } from './types';

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
              id: 'obsidian-8mm',
              name: '冰曜石',
              sizeMm: 8,
              price: 2,
              color: 'radial-gradient(circle at 30% 30%, rgba(100,100,100,0.9), rgba(20,20,20,1))',
              inStock: true
            },
            {
              id: 'obsidian-10mm',
              name: '冰曜石',
              sizeMm: 10,
              price: 6,
              color: 'radial-gradient(circle at 30% 30%, rgba(100,100,100,0.9), rgba(20,20,20,1))',
              inStock: true
            },
            {
              id: 'silver-obsidian-10mm',
              name: '银曜石',
              sizeMm: 10,
              price: 8,
              color: 'radial-gradient(circle at 30% 30%, rgba(180,180,190,0.9), rgba(30,30,40,1))',
              inStock: true
            }
          ]
        },
        {
          id: 'sub_crystal',
          name: '水晶类',
          items: [
            {
              id: 'rose-quartz-8mm',
              name: '粉水晶',
              sizeMm: 8,
              price: 5.5,
              color: 'radial-gradient(circle at 30% 30%, rgba(255,200,210,0.8), rgba(240,150,170,0.9))',
              inStock: true
            },
            {
              id: 'rose-quartz-12mm',
              name: '粉水晶',
              sizeMm: 12,
              price: 9,
              color: 'radial-gradient(circle at 30% 30%, rgba(255,200,210,0.8), rgba(240,150,170,0.9))',
              inStock: true
            }
          ]
        },
        {
          id: 'sub_pearl',
          name: '珍珠类',
          items: [
            {
              id: 'pearl-6mm',
              name: '淡水珍珠',
              sizeMm: 6,
              price: 12,
              color: 'radial-gradient(circle at 30% 30%, rgba(255,255,250,1), rgba(220,220,210,1))',
              inStock: true
            }
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
            {
              id: 'silver-star',
              name: '纯银星星',
              sizeMm: 8,
              price: 25,
              color: 'radial-gradient(circle at 30% 30%, #f0f0f0, #999)',
              inStock: true
            },
            {
              id: 'silver-spacer',
              name: '纯银隔片',
              sizeMm: 4,
              price: 8,
              color: 'linear-gradient(45deg, #ddd, #999)',
              inStock: true
            }
          ]
        }
      ]
    }
  ]
};
