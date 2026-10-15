-- ============================================================
-- 轻量物料进销存系统 - 完整建表脚本(全新部署用)
-- 数据库: inventory_mvp (需先手动创建: CREATE DATABASE inventory_mvp DEFAULT CHARSET utf8mb4;)
-- 核心铁则: 库存 = 累计入库流水 - 累计出库流水, 系统中不存在"库存"字段, 禁止直接改库存
-- 说明: 本脚本为 CREATE TABLE IF NOT EXISTS, 幂等可重复执行
-- ============================================================

-- 1. 用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `username`   VARCHAR(50)  NOT NULL                COMMENT '登录账号',
  `password`   VARCHAR(255) NOT NULL                COMMENT '密码(BCrypt 加密存储)',
  `real_name`  VARCHAR(50)  DEFAULT NULL            COMMENT '姓名',
  `role`       ENUM('superadmin','admin','operator') NOT NULL DEFAULT 'operator' COMMENT '角色: superadmin超级管理员 / admin管理员 / operator操作员',
  `status`     TINYINT      NOT NULL DEFAULT 1      COMMENT '状态: 1启用 0停用',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 2. 物料档案表
CREATE TABLE IF NOT EXISTS `materials` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `code`          VARCHAR(50)  NOT NULL              COMMENT '唯一物料编码',
  `name`          VARCHAR(100) NOT NULL              COMMENT '物料名称',
  `spec`          VARCHAR(100) DEFAULT NULL          COMMENT '规格型号',
  `unit`          VARCHAR(20)  DEFAULT NULL          COMMENT '计量单位',
  `category`      VARCHAR(50)  DEFAULT NULL          COMMENT '物料分类',
  `safety_stock`  DECIMAL(15,2) NOT NULL DEFAULT 0   COMMENT '安全库存(低于此值预警)',
  `status`        TINYINT      NOT NULL DEFAULT 1    COMMENT '状态: 1启用 0停用(软删除)',
  `created_by`    INT          DEFAULT NULL          COMMENT '创建人ID',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '建档时间',
  `product_group` VARCHAR(255) DEFAULT NULL          COMMENT '商品分组(逗号分隔可多组)',
  `material_cat`  VARCHAR(50)  NOT NULL DEFAULT '其他' COMMENT '物料大类(可自定义)',
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_group` (`product_group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物料档案表';

-- 3. 出入库流水表(唯一账本, 库存由它推导)
CREATE TABLE IF NOT EXISTS `flows` (
  `id`          BIGINT AUTO_INCREMENT PRIMARY KEY,
  `flow_no`     VARCHAR(50)  NOT NULL               COMMENT '单据流水号, 如 IN202608080001 / OUT202608080001',
  `material_id` INT          NOT NULL               COMMENT '物料ID',
  `type`        ENUM('IN','OUT') NOT NULL           COMMENT '流水类型: IN入库 / OUT出库',
  `category`    VARCHAR(20)  NOT NULL DEFAULT 'normal' COMMENT '单据类别: normal普通 / in_return入库退货 / out_return出库退货',
  `quantity`    DECIMAL(15,2) NOT NULL              COMMENT '数量(恒为正数, 方向由type决定)',
  `counterparty` VARCHAR(100) DEFAULT NULL          COMMENT '对手方: 入库=供应商 / 出库=领用人',
  `purpose`     VARCHAR(255) DEFAULT NULL           COMMENT '备注/用途: 入库=备注 / 出库=领用用途',
  `status`      TINYINT      NOT NULL DEFAULT 1     COMMENT '状态: 1正常 0作废',
  `direction`   VARCHAR(30)  DEFAULT NULL           COMMENT '出库方向',
  `operator_id` INT          NOT NULL               COMMENT '操作人ID(留痕审计)',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '单据时间',
  `void_by`     INT          DEFAULT NULL           COMMENT '作废人ID',
  `void_at`     DATETIME     DEFAULT NULL           COMMENT '作废时间',
  `void_reason` VARCHAR(255) DEFAULT NULL           COMMENT '作废原因',
  UNIQUE KEY `uk_flow_no` (`flow_no`),
  KEY `idx_material` (`material_id`),
  KEY `idx_type` (`type`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='出入库流水台账表';

-- 4. 成品表
CREATE TABLE IF NOT EXISTS `products` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `code`       VARCHAR(50)  NOT NULL                COMMENT '成品编码, 如 CP-A',
  `name`       VARCHAR(100) NOT NULL                COMMENT '成品名称',
  `status`     TINYINT      NOT NULL DEFAULT 1      COMMENT '状态: 1启用 0停用',
  `created_by` INT          DEFAULT NULL            COMMENT '创建人ID',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY `uk_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成品表';

-- 5. BOM配方表(一个成品由多个配件物料组成, 单件耗用数量)
CREATE TABLE IF NOT EXISTS `bom` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `product_id`  INT NOT NULL                        COMMENT '成品ID',
  `material_id` INT NOT NULL                        COMMENT '配件物料ID',
  `qty_per`     DECIMAL(15,4) NOT NULL              COMMENT '单件耗用数量(生产1个成品消耗的配件数)',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY `uk_product_material` (`product_id`, `material_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='BOM配方表';

-- 6. 采购订单/在途物料表(下单在途, 分批到货入库)
CREATE TABLE IF NOT EXISTS `intransit` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `material_id` INT NOT NULL                        COMMENT '物料ID',
  `quantity`    DECIMAL(15,2) NOT NULL              COMMENT '订购数量',
  `received`    DECIMAL(15,2) NOT NULL DEFAULT 0    COMMENT '累计已到货入库数量',
  `supplier`    VARCHAR(100) DEFAULT ''             COMMENT '供应商',
  `remark`      VARCHAR(255) DEFAULT ''             COMMENT '备注',
  `status`      TINYINT NOT NULL DEFAULT 0          COMMENT '状态: 0在途 1已全部到齐',
  `created_by`  INT DEFAULT NULL                    COMMENT '下单人ID',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '下单时间',
  `done_at`     DATETIME DEFAULT NULL               COMMENT '完成时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购订单/在途物料表';

-- 7. 流水号序列表(原子生成流水号)
CREATE TABLE IF NOT EXISTS `flow_seq` (
  `prefix` VARCHAR(20) NOT NULL,
  `seq`    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`prefix`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='流水号序列表';

-- 8. 系统设置表
CREATE TABLE IF NOT EXISTS `settings` (
  `skey`       VARCHAR(50) NOT NULL,
  `svalue`     VARCHAR(255) DEFAULT '',
  `updated_by` INT DEFAULT NULL,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`skey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统设置表';

-- 9. 操作审计日志表(记录操作留痕)
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`         BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id`    INT DEFAULT NULL,
  `username`   VARCHAR(50) DEFAULT '',
  `action`     VARCHAR(50) NOT NULL,
  `target`     VARCHAR(200) DEFAULT '',
  `detail`     VARCHAR(500) DEFAULT '',
  `ip`         VARCHAR(50) DEFAULT '',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作审计日志表';

-- 10. 登录日志表(每次登录成功/失败都记录, 用于安全审计)
CREATE TABLE IF NOT EXISTS `login_logs` (
  `id`         BIGINT AUTO_INCREMENT PRIMARY KEY,
  `username`   VARCHAR(50)  NOT NULL                COMMENT '登录账号',
  `real_name`  VARCHAR(50)  DEFAULT NULL            COMMENT '姓名',
  `role`       VARCHAR(20)  DEFAULT NULL            COMMENT '角色',
  `ip`         VARCHAR(50)  DEFAULT NULL            COMMENT '登录IP',
  `ua`         VARCHAR(255) DEFAULT NULL            COMMENT '浏览器标识',
  `status`     TINYINT      NOT NULL DEFAULT 1      COMMENT '结果: 1成功 0失败',
  `msg`        VARCHAR(255) DEFAULT NULL            COMMENT '结果说明',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
  KEY `idx_username` (`username`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='登录日志表';

-- 说明: 默认管理员与操作员账号由后端启动时自动创建(见 server/scripts/initDb.js)
--   管理员: admin / admin123
--   操作员: operator / 123456
-- 该初始化脚本会自动执行建表, 后端启动时若表不存在会执行本脚本。
