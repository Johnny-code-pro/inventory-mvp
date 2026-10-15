// 系统设置路由(仅超级管理员可改, 任何人可读)
const express = require('express');
const pool = require('../config/db');
const { auth, requireSuperAdmin } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

const router = express.Router();

// GET /api/settings  读取全部系统设置
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT skey, svalue FROM settings');
    const data = {};
    for (const r of rows) data[r.skey] = r.svalue;
    res.json({ code: 200, data });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

// PUT /api/settings  批量更新系统设置(超级管理员)
router.put('/', auth, requireSuperAdmin, async (req, res) => {
  const body = req.body || {};
  const keys = Object.keys(body);
  if (!keys.length) return res.json({ code: 400, msg: '没有需要保存的设置' });
  try {
    for (const k of keys) {
      await pool.query(
        'INSERT INTO settings (skey, svalue, updated_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE svalue=VALUES(svalue), updated_by=VALUES(updated_by)',
        [k, String(body[k]), req.user.id]
      );
    }
    await logAction(req, 'update_settings', `修改设置: ${keys.join(',')}`);
    res.json({ code: 200, msg: '设置已保存' });
  } catch (e) {
    res.json({ code: 500, msg: '服务器异常' });
  }
});

module.exports = router;
