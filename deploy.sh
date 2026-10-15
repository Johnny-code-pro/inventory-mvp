#!/usr/bin/env bash
# ============================================================
# 进销存系统 - Linux 服务器一键部署脚本 (Ubuntu / Debian)
#
# 使用前提:
#   1. 已把本项目上传到服务器(排除 node_modules 和 frontend/dist)
#   2. 在项目根目录执行:  sudo bash deploy.sh
#   3. 部署前记得在云控制台【安全组】放行 3000 端口
# ============================================================
set -e

echo "=========== 开始部署进销存系统 ==========="

# ---------- 1. 安装 Node.js (若没有) ----------
if ! command -v node >/dev/null 2>&1; then
  echo ">>> 安装 Node.js 20 LTS ..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo ">>> Node.js: $(node -v)"

# ---------- 2. 安装 PM2 进程守护 (若没有) ----------
if ! command -v pm2 >/dev/null 2>&1; then
  echo ">>> 安装 PM2 ..."
  sudo npm install -g pm2
fi

# ---------- 3. 安装 MySQL (若没有) ----------
if ! command -v mysql >/dev/null 2>&1; then
  echo ">>> 安装 MySQL ..."
  sudo apt-get update
  sudo apt-get install -y mysql-server
  sudo systemctl enable mysql
  sudo systemctl start mysql
fi

# ---------- 4. 创建数据库与专用账号 ----------
DB_NAME=inventory_mvp
DB_APP_PASSWORD="${DB_APP_PASSWORD:-Inv$(openssl rand -hex 6)}"
echo ">>> 初始化数据库 ${DB_NAME} ..."
sudo mysql -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARACTER SET utf8mb4;"
sudo mysql -e "CREATE USER IF NOT EXISTS 'inventory'@'localhost' IDENTIFIED BY '${DB_APP_PASSWORD}';"
sudo mysql -e "CREATE USER IF NOT EXISTS 'inventory'@'127.0.0.1' IDENTIFIED BY '${DB_APP_PASSWORD}';"
sudo mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO 'inventory'@'localhost';"
sudo mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO 'inventory'@'127.0.0.1';"
sudo mysql -e "FLUSH PRIVILEGES;"

# ---------- 5. 生成 server/.env (若不存在) ----------
if [ ! -f server/.env ]; then
  echo ">>> 生成 server/.env ..."
  cat > server/.env <<EOF
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=inventory
DB_PASSWORD=${DB_APP_PASSWORD}
DB_NAME=${DB_NAME}
JWT_SECRET=$(openssl rand -hex 24)
EOF
else
  echo ">>> server/.env 已存在, 跳过生成"
fi

# ---------- 6. 安装依赖并构建前端 ----------
echo ">>> 安装后端依赖 ..."
(cd server && npm install)
echo ">>> 安装前端依赖并构建 ..."
(cd frontend && npm install && npm run build)

# ---------- 7. PM2 启动并设开机自启 ----------
echo ">>> PM2 启动服务 ..."
(cd server && pm2 start app.js --name inventory-mvp)
pm2 save
pm2 startup systemd -u "$(whoami)" --hp "$HOME" >/dev/null 2>&1 || true

# ---------- 8. 防火墙放行 3000 (UFW, 若启用) ----------
sudo ufw allow 3000/tcp >/dev/null 2>&1 || true

echo ""
echo "=============================================="
echo "  部署完成!"
echo "  本机访问  : http://127.0.0.1:3000"
echo "  公网访问  : http://<服务器公网IP>:3000"
echo "  数据库账号: inventory / ${DB_APP_PASSWORD} (见 server/.env)"
echo "  默认系统账号: admin/admin123, operator/123456"
echo "  ⚠️ 重要: 上线前请改默认密码:"
echo "     cd server && node scripts/changePassword.js admin 你的新密码"
echo "=============================================="
