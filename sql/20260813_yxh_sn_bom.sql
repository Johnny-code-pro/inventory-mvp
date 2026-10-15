-- 2026-08-13 牙线盒 + SN收纳盒 配方数据
-- 依据: 牙线盒.xlsx / SN垃圾袋收纳盒 20260725.xlsx / (2).xlsx
-- 外箱按整数另记(1箱50套), 不进BOM

-- 1) 新建物料(9个)
INSERT INTO materials (code,name,spec,unit,category,product_group,safety_stock,created_by) VALUES
('CL-062','牙线盒-上盖','ABS','个','牙线盒','牙线盒',0,1),
('CL-063','牙线盒-托盘','ABS','个','牙线盒','牙线盒',0,1),
('CL-064','牙线盒-底盖','ABS','个','牙线盒','牙线盒',0,1),
('CL-065','牙线盒-升降压板','ABS','个','牙线盒','牙线盒',0,1),
('CL-066','牙线盒-固定块','ABS','个','牙线盒','牙线盒',0,1),
('CL-067','SN2挂墙版-底座黑透','ABS黑透','个','SN','垃圾袋收纳盒',0,1),
('CL-068','SN2挂墙版-活动盖黑透','ABS黑透','个','SN','垃圾袋收纳盒',0,1),
('CL-069','SN2挂墙版-底座齐家白色','ABS齐家白色','个','SN','垃圾袋收纳盒',0,1),
('CL-070','SN2挂墙版-活动盖齐家白色','ABS齐家白色','个','SN','垃圾袋收纳盒',0,1),
('BZ-038','SN英文盒子','80*80*190','个','纸盒','垃圾袋收纳盒',0,1);

-- 2) 新建成品(8个SN)
INSERT INTO products (code,name,created_by) VALUES
('SN1-CN-BT','SN1磁吸版-黑透-中文',1),
('SN1-EN-BT','SN1磁吸版-黑透-英文',1),
('SN1-CN-QJ','SN1磁吸版-齐家白-中文',1),
('SN1-EN-QJ','SN1磁吸版-齐家白-英文',1),
('SN2-CN-BT','SN2挂墙版-黑透-中文',1),
('SN2-EN-BT','SN2挂墙版-黑透-英文',1),
('SN2-CN-QJ','SN2挂墙版-齐家白-中文',1),
('SN2-EN-QJ','SN2挂墙版-齐家白-英文',1);

-- 3) 牙线盒3款配方: 上盖1/托盘2/底盖1/升降压板2/固定块2
INSERT INTO bom (product_id,material_id,qty_per)
SELECT p.id,m.id,v FROM products p, materials m, (
  SELECT 'YXH001' pc,'CL-062' mc,1 v UNION ALL SELECT 'YXH001','CL-063',2 UNION ALL SELECT 'YXH001','CL-064',1 UNION ALL SELECT 'YXH001','CL-065',2 UNION ALL SELECT 'YXH001','CL-066',2
) t WHERE p.code=t.pc AND m.code=t.mc;

INSERT INTO bom (product_id,material_id,qty_per)
SELECT p.id,m.id,v FROM products p, materials m, (
  SELECT 'YXH002' pc,'CL-062' mc,1 v UNION ALL SELECT 'YXH002','CL-063',2 UNION ALL SELECT 'YXH002','CL-064',1 UNION ALL SELECT 'YXH002','CL-065',2 UNION ALL SELECT 'YXH002','CL-066',2
) t WHERE p.code=t.pc AND m.code=t.mc;

INSERT INTO bom (product_id,material_id,qty_per)
SELECT p.id,m.id,v FROM products p, materials m, (
  SELECT 'YXH003' pc,'CL-062' mc,1 v UNION ALL SELECT 'YXH003','CL-063',2 UNION ALL SELECT 'YXH003','CL-064',1 UNION ALL SELECT 'YXH003','CL-065',2 UNION ALL SELECT 'YXH003','CL-066',2
) t WHERE p.code=t.pc AND m.code=t.mc;

-- 4) SN1磁吸版配方: 底座1/活动盖1/SN磁铁1/SN磨砂袋1/盒1
INSERT INTO bom (product_id,material_id,qty_per)
SELECT p.id,m.id,v FROM products p, materials m, (
  SELECT 'SN1-CN-BT' pc,'SN-001' mc,1 v UNION ALL SELECT 'SN1-CN-BT','SN-002',1 UNION ALL SELECT 'SN1-CN-BT','CL-012',1 UNION ALL SELECT 'SN1-CN-BT','SN-005',1 UNION ALL SELECT 'SN1-CN-BT','BZ-031',1
) t WHERE p.code=t.pc AND m.code=t.mc;

INSERT INTO bom (product_id,material_id,qty_per)
SELECT p.id,m.id,v FROM products p, materials m, (
  SELECT 'SN1-EN-BT' pc,'SN-001' mc,1 v UNION ALL SELECT 'SN1-EN-BT','SN-002',1 UNION ALL SELECT 'SN1-EN-BT','CL-012',1 UNION ALL SELECT 'SN1-EN-BT','SN-005',1 UNION ALL SELECT 'SN1-EN-BT','BZ-038',1
) t WHERE p.code=t.pc AND m.code=t.mc;

INSERT INTO bom (product_id,material_id,qty_per)
SELECT p.id,m.id,v FROM products p, materials m, (
  SELECT 'SN1-CN-QJ' pc,'SN-003' mc,1 v UNION ALL SELECT 'SN1-CN-QJ','SN-004',1 UNION ALL SELECT 'SN1-CN-QJ','CL-012',1 UNION ALL SELECT 'SN1-CN-QJ','SN-005',1 UNION ALL SELECT 'SN1-CN-QJ','BZ-031',1
) t WHERE p.code=t.pc AND m.code=t.mc;

INSERT INTO bom (product_id,material_id,qty_per)
SELECT p.id,m.id,v FROM products p, materials m, (
  SELECT 'SN1-EN-QJ' pc,'SN-003' mc,1 v UNION ALL SELECT 'SN1-EN-QJ','SN-004',1 UNION ALL SELECT 'SN1-EN-QJ','CL-012',1 UNION ALL SELECT 'SN1-EN-QJ','SN-005',1 UNION ALL SELECT 'SN1-EN-QJ','BZ-038',1
) t WHERE p.code=t.pc AND m.code=t.mc;

-- 5) SN2挂墙版配方: 底座1/活动盖1/粘钩(子扣)1/SN磨砂袋1/盒1
INSERT INTO bom (product_id,material_id,qty_per)
SELECT p.id,m.id,v FROM products p, materials m, (
  SELECT 'SN2-CN-BT' pc,'CL-067' mc,1 v UNION ALL SELECT 'SN2-CN-BT','CL-068',1 UNION ALL SELECT 'SN2-CN-BT','SN-013',1 UNION ALL SELECT 'SN2-CN-BT','SN-005',1 UNION ALL SELECT 'SN2-CN-BT','BZ-031',1
) t WHERE p.code=t.pc AND m.code=t.mc;

INSERT INTO bom (product_id,material_id,qty_per)
SELECT p.id,m.id,v FROM products p, materials m, (
  SELECT 'SN2-EN-BT' pc,'CL-067' mc,1 v UNION ALL SELECT 'SN2-EN-BT','CL-068',1 UNION ALL SELECT 'SN2-EN-BT','SN-013',1 UNION ALL SELECT 'SN2-EN-BT','SN-005',1 UNION ALL SELECT 'SN2-EN-BT','BZ-038',1
) t WHERE p.code=t.pc AND m.code=t.mc;

INSERT INTO bom (product_id,material_id,qty_per)
SELECT p.id,m.id,v FROM products p, materials m, (
  SELECT 'SN2-CN-QJ' pc,'CL-069' mc,1 v UNION ALL SELECT 'SN2-CN-QJ','CL-070',1 UNION ALL SELECT 'SN2-CN-QJ','SN-013',1 UNION ALL SELECT 'SN2-CN-QJ','SN-005',1 UNION ALL SELECT 'SN2-CN-QJ','BZ-031',1
) t WHERE p.code=t.pc AND m.code=t.mc;

INSERT INTO bom (product_id,material_id,qty_per)
SELECT p.id,m.id,v FROM products p, materials m, (
  SELECT 'SN2-EN-QJ' pc,'CL-069' mc,1 v UNION ALL SELECT 'SN2-EN-QJ','CL-070',1 UNION ALL SELECT 'SN2-EN-QJ','SN-013',1 UNION ALL SELECT 'SN2-EN-QJ','SN-005',1 UNION ALL SELECT 'SN2-EN-QJ','BZ-038',1
) t WHERE p.code=t.pc AND m.code=t.mc;
