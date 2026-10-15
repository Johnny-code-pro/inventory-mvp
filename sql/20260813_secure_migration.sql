-- 2026-08-13 安全加固 + 退货功能 迁移
-- 1) users: 角色枚举加入 superadmin(与生产实际一致)
ALTER TABLE users MODIFY role ENUM('superadmin','admin','operator') NOT NULL DEFAULT 'operator';
-- 2) flows: 新增 category 单据类别(normal普通 / in_return入库退货 / out_return出库退货)
ALTER TABLE flows ADD COLUMN category VARCHAR(20) NOT NULL DEFAULT 'normal' COMMENT '单据类别' AFTER type;
