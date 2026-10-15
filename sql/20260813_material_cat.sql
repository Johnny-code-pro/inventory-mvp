-- 2026-08-13 物料大类改为独立可编辑字段(不再由编码前缀推断)
ALTER TABLE materials ADD COLUMN material_cat VARCHAR(50) NOT NULL DEFAULT '其他' AFTER product_group;
-- 按原编码前缀回填初始大类
UPDATE materials SET material_cat = CASE LEFT(code,2)
  WHEN 'CL' THEN '原材料'
  WHEN 'BZ' THEN '包装辅料'
  WHEN 'WL' THEN '配套小件'
  ELSE '其他' END;
