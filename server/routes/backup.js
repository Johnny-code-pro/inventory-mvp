// 数据库备份管理路由(仅超级管理员)
const express = require('express');
const path = require('path');
const fs = require('fs');
const { auth, requireSuperAdmin } = require('../middleware/auth');
const { createBackup, listBackups, BACKUP_DIR } = require('../utils/backup');
const { logAction } = require('../utils/audit');

const router = express.Router();

// GET /api/backup/list  备份文件列表
router.get('/list', auth, requireSuperAdmin, (req, res) => {
  try {
    const list = listBackups().map((b) => ({
      filename: b.filename,
      size: b.size,
      mtime: b.mtime,
      sizeText: (b.size / 1024 / 1024).toFixed(2) + ' MB',
      timeText: new Date(b.mtime).toLocaleString('zh-CN', { hour12: false }),
    }));
    res.json({ code: 200, data: list });
  } catch (e) {
    res.json({ code: 500, msg: '读取备份目录失败: ' + e.message });
  }
});

// POST /api/backup/create  手动创建备份
router.post('/create', auth, requireSuperAdmin, async (req, res) => {
  try {
    const r = await createBackup();
    await logAction(req, 'backup_create', `手动创建数据库备份 ${r.filename}`);
    res.json({ code: 200, msg: '备份成功', data: { filename: r.filename, sizeText: (r.size / 1024 / 1024).toFixed(2) + ' MB' } });
  } catch (e) {
    console.error('创建备份失败:', e.message);
    res.json({ code: 500, msg: '备份失败: ' + e.message });
  }
});

// GET /api/backup/download/:filename  下载备份(防路径穿越)
router.get('/download/:filename', auth, requireSuperAdmin, (req, res) => {
  try {
    const name = path.basename(req.params.filename); // 去掉路径部分
    if (!/^inventory_\d{14}\.sql\.gz$/.test(name)) return res.json({ code: 400, msg: '文件名不合法' });
    const filePath = path.join(BACKUP_DIR, name);
    if (!fs.existsSync(filePath)) return res.json({ code: 400, msg: '备份文件不存在' });
    res.download(filePath, name);
  } catch (e) {
    res.json({ code: 500, msg: '下载失败' });
  }
});

module.exports = router;
