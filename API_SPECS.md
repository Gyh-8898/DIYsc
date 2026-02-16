
# 晶奥之境 (Gem Oratopia) API 接口文档

本文档定义了前端（小程序 + Web管理后台）目前所使用的所有后端接口。后端服务需严格按照此文档实现路由和数据返回格式。

## 1. 鉴权与用户 (Auth & User)

| 接口路径 | 请求方式 | 描述 | 参数示例 / 备注 |
| :--- | :--- | :--- | :--- |
| `/api/auth/wechat` | **POST** | 微信一键登录 | Body: `{ code: "..." }`<br>返回: `{ token: "...", user: {...} }` |
| `/api/user/me` | **GET** | 获取当前用户信息 | Header: `Authorization: Bearer <token>` |
| `/api/user/me` | **POST** | 更新当前用户信息 | Body: `{ name: "NewName", avatar: "..." }` |
| `/api/user/points/history` | **GET** | 获取积分变动记录 | 返回: `PointHistory[]` |
| `/api/admin/users` | **GET** | [管理员] 获取所有用户列表 | 返回: `User[]` |

## 2. 收货地址 (Address)

| 接口路径 | 请求方式 | 描述 | 参数示例 / 备注 |
| :--- | :--- | :--- | :--- |
| `/api/user/addresses` | **GET** | 获取当前用户的地址列表 | 返回: `Address[]` |
| `/api/user/addresses` | **POST** | 新增收货地址 | Body: `Address` 对象 |

## 3. 商品与库存 (Product & Inventory)

| 接口路径 | 请求方式 | 描述 | 参数示例 / 备注 |
| :--- | :--- | :--- | :--- |
| `/api/products/inventory-tree` | **GET** | 获取设计器库存树（珠子/分类） | 返回: `InventoryTree` 结构 |
| `/api/products/addons` | **GET** | 获取加购商品（礼盒、卡片） | 返回: `AddOnProduct[]` |
| `/api/products/plaza` | **GET** | 获取广场公开作品列表 | 返回: `Design[]` |
| `/api/products/plaza` | **POST** | 发布/上传作品到广场 | Body: `Design` 对象 |
| `/api/products/plaza/:id` | **DELETE** | [管理员] 删除广场作品 | |

## 4. 个人作品集 (User Designs)

| 接口路径 | 请求方式 | 描述 | 参数示例 / 备注 |
| :--- | :--- | :--- | :--- |
| `/api/user/designs` | **GET** | 获取当前用户的设计草稿/作品 | 返回: `Design[]` |
| `/api/user/designs` | **POST** | 保存设计作品 | Body: `Design` 对象 |
| `/api/user/designs/:id` | **DELETE** | 删除指定的个人作品 | |

## 5. 订单系统 (Order)

| 接口路径 | 请求方式 | 描述 | 参数示例 / 备注 |
| :--- | :--- | :--- | :--- |
| `/api/orders` | **GET** | 获取当前用户的订单列表 | 返回: `Order[]` |
| `/api/orders` | **POST** | 创建新订单 | Body: `{ items: [], totalAmount: 100, shippingAddress: "..." }` |
| `/api/orders/:id` | **GET** | 获取单个订单详情 | 返回: `Order` 对象 |
| `/api/admin/orders` | **GET** | [管理员] 获取全平台所有订单 | 返回: `Order[]` |
| `/api/orders/:id/pay` | **POST** | 模拟支付订单 | 将状态改为 `pending_production` |
| `/api/orders/:id/confirm` | **POST** | 确认收货 | 将状态改为 `completed` |
| `/api/orders/:id/cancel` | **POST** | 取消订单 | 将状态改为 `cancelled` |
| `/api/orders/:id/logistics` | **GET** | 获取订单物流轨迹 | 返回: `LogisticEvent[]` |

## 6. 系统配置 (System Config)

| 接口路径 | 请求方式 | 描述 | 参数示例 / 备注 |
| :--- | :--- | :--- | :--- |
| `/api/system/config` | **GET** | 获取全局系统配置 | 包括UI设置、运费规则、功能开关等 |
| `/api/system/config` | **POST** | [管理员] 更新系统配置 | Body: `SystemConfig` 对象 |
| `/api/system/banners` | **GET** | 获取首页轮播图 | 返回: `Banner[]` |

## 7. 客服与反馈 (Service)

| 接口路径 | 请求方式 | 描述 | 参数示例 / 备注 |
| :--- | :--- | :--- | :--- |
| `/api/complaints` | **GET** | 获取当前用户的投诉/申诉记录 | 返回: `Complaint[]` |
| `/api/complaints` | **POST** | 提交新的投诉/申诉 | Body: `Complaint` 对象 |

---

### 数据结构参考 (TypeScript Definitions)

**User:**
```typescript
{
  id: string;
  name: string;
  avatar: string;
  points: number;
  levelId: number;
  levelName: string;
  phone?: string;
}
```

**Design:**
```typescript
{
  id: string;
  name: string;
  wristSize: number;
  beads: BeadType[]; // 包含位置、颜色、ID信息
  totalPrice: number;
  author: string;
  createdAt: number;
  imageUrl?: string;
}
```

**Order:**
```typescript
{
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending_payment' | 'pending_production' | 'shipped' | 'completed' | 'cancelled';
  shippingAddress: string;
  trackingNumber?: string;
  carrier?: string;
}
```
