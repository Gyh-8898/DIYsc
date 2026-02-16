
-- 晶奥之境 (Gem Oratopia) Database Schema
-- Compatible with MySQL 8.0+
-- Designed for High Concurrency (Vertical Partitioning)

CREATE DATABASE IF NOT EXISTS gem_oratopia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gem_oratopia;

-- ==========================================
-- 1. 用户核心账号表 (t_user_account)
-- 用途：鉴权、登录、核心状态
-- 读写特征：读极高(登录/校验Token)，写低
-- ==========================================
CREATE TABLE `t_user_account` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `openid` VARCHAR(64) DEFAULT NULL COMMENT '微信OpenID',
  `unionid` VARCHAR(64) DEFAULT NULL COMMENT '微信UnionID',
  `phone` VARCHAR(20) DEFAULT NULL COMMENT '手机号',
  `password_hash` VARCHAR(128) DEFAULT NULL COMMENT '密码哈希(非微信登录用)',
  `salt` VARCHAR(32) DEFAULT NULL COMMENT '密码盐',
  `status` TINYINT DEFAULT 1 COMMENT '状态 1:正常 0:禁用',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_openid` (`openid`),
  UNIQUE KEY `uk_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户账号表';

-- ==========================================
-- 2. 用户档案表 (t_user_profile)
-- 用途：展示信息、社交属性
-- 读写特征：读高，写中
-- ==========================================
CREATE TABLE `t_user_profile` (
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `nickname` VARCHAR(64) DEFAULT '' COMMENT '昵称',
  `avatar_url` VARCHAR(255) DEFAULT '' COMMENT '头像URL',
  `real_name` VARCHAR(32) DEFAULT '' COMMENT '真实姓名',
  `level_id` INT DEFAULT 1 COMMENT '会员等级ID',
  `referral_code` VARCHAR(10) DEFAULT NULL COMMENT '我的邀请码',
  `referrer_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '推荐人ID',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uk_referral_code` (`referral_code`),
  KEY `idx_referrer` (`referrer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户档案表';

-- ==========================================
-- 3. 用户资产表 (t_user_wallet)
-- 用途：积分、余额、累计消费
-- 读写特征：写高(并发扣款/积分)，读中
-- 注意：必须使用事务和乐观锁(version)
-- ==========================================
CREATE TABLE `t_user_wallet` (
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `points_balance` INT DEFAULT 0 COMMENT '可用积分',
  `frozen_points` INT DEFAULT 0 COMMENT '冻结积分(提现中)',
  `balance` DECIMAL(10, 2) DEFAULT 0.00 COMMENT '现金余额',
  `total_consumed` DECIMAL(12, 2) DEFAULT 0.00 COMMENT '历史总消费',
  `version` INT UNSIGNED DEFAULT 1 COMMENT '乐观锁版本号',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户资产钱包表';

-- ==========================================
-- 4. 用户统计表 (t_user_stats)
-- 用途：非实时业务的统计数据，用于运营分析
-- 读写特征：写(异步更新)，读低
-- ==========================================
CREATE TABLE `t_user_stats` (
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `order_count` INT DEFAULT 0 COMMENT '订单总数',
  `last_login_at` TIMESTAMP NULL DEFAULT NULL COMMENT '最后登录时间',
  `last_login_ip` VARCHAR(45) DEFAULT NULL COMMENT '最后登录IP',
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户行为统计表';

-- ==========================================
-- 5. 订单主表 (t_order)
-- ==========================================
CREATE TABLE `t_order` (
  `id` VARCHAR(32) NOT NULL COMMENT '订单号(业务生成)',
  `user_id` BIGINT UNSIGNED NOT NULL,
  `total_amount` DECIMAL(10, 2) NOT NULL COMMENT '订单总金额',
  `status` VARCHAR(20) NOT NULL COMMENT 'pending_payment, pending_production, shipped...',
  `shipping_address` JSON COMMENT '收货地址快照',
  `tracking_number` VARCHAR(64) DEFAULT NULL COMMENT '物流单号',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_status` (`user_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单主表';

-- ==========================================
-- 6. 订单明细表 (t_order_item)
-- ==========================================
CREATE TABLE `t_order_item` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` VARCHAR(32) NOT NULL,
  `product_name` VARCHAR(128) NOT NULL,
  `product_spec` VARCHAR(255) DEFAULT NULL COMMENT '规格描述',
  `price` DECIMAL(10, 2) NOT NULL,
  `count` INT NOT NULL DEFAULT 1,
  `design_snapshot` JSON DEFAULT NULL COMMENT '若是定制商品，存储珠子排布JSON',
  PRIMARY KEY (`id`),
  KEY `idx_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单商品明细表';

-- ==========================================
-- 7. 珠子设计表 (t_design)
-- ==========================================
CREATE TABLE `t_design` (
  `id` VARCHAR(32) NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(64) DEFAULT '未命名作品',
  `wrist_size` FLOAT NOT NULL,
  `total_price` DECIMAL(10, 2) NOT NULL,
  `beads_data` JSON NOT NULL COMMENT '珠子排列数组',
  `is_public` TINYINT DEFAULT 0 COMMENT '是否发布到广场',
  `likes` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户设计作品表';

-- ==========================================
-- 8. 系统配置表 (t_sys_config) - NEW
-- 用途：存储全站通用的动态变量（公告、开关、费率）
-- 策略：MySQL存储，Redis缓存(TTL 1小时)，前端10分钟缓存
-- ==========================================
CREATE TABLE `t_sys_config` (
  `config_key` VARCHAR(50) NOT NULL COMMENT '配置键名,如 business_fees',
  `config_value` JSON NOT NULL COMMENT '配置值(JSON格式),如 {"baseFee": 10}',
  `description` VARCHAR(100) DEFAULT NULL COMMENT '配置描述',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统全局配置表';

-- ==========================================
-- 9. 轮播图配置表 (t_banner) - NEW
-- 用途：首页Banner动态管理
-- ==========================================
CREATE TABLE `t_banner` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `image_url` VARCHAR(255) NOT NULL,
  `link_url` VARCHAR(255) DEFAULT NULL,
  `sort_order` INT DEFAULT 0,
  `is_active` TINYINT DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='首页轮播图配置';
