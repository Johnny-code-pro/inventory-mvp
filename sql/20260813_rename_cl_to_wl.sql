-- 2026-08-13 安鼎物料直接删除 + CL编码统一改为WL(只改编码,其他字段不动)
-- 安鼎物料(WL-001)物理删除, 其历史入库流水一并删除
DELETE FROM flows WHERE material_id = (SELECT id FROM materials WHERE code='WL-001' LIMIT 1);
DELETE FROM materials WHERE code='WL-001';
-- CL-XXX -> WL-XXX (同序号, 仅改 code 字段)
UPDATE materials SET code = CONCAT('WL-', SUBSTRING(code,4)) WHERE code LIKE 'CL-%';
