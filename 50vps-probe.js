/*
 * CF-PROBE
 *
 * 本脚本基于 CF-Server-Monitor-Pro 二次修改而来。
 *
 * 原项目地址：
 * https://github.com/a63414262/CF-Server-Monitor-Pro
 *
 * 原作者：
 * a63414262
 *
 * 原项目授权：
 * 原项目 README 中声明为 MIT License。
 *
 * 修改者：
 * ganepro220222
 *
 * 主要修改内容：
 * - 增加全球点亮功能
 * - 增加全屏壁纸开关功能
 * - 调整部分前端显示效果
 * - 对页面样式和展示逻辑进行了个人化修改
 *
 * 说明：
 * 本项目为个人修改版本，并非原作者官方版本。
 * 本项目保留对原项目、原作者及原项目地址的说明。
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = url.origin;

    const formatBytes = (bytes) => {
      const b = parseInt(bytes);
      if (isNaN(b) || b === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(b) / Math.log(k));
      return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // ==========================================
    // 0. 认证机制与全局设置加载
    // ==========================================
    const checkAuth = (req) => {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return false;
      const [scheme, encoded] = authHeader.split(' ');
      if (scheme !== 'Basic' || !encoded) return false;
      const decoded = atob(encoded);
      const [username, password] = decoded.split(':');
      return username === 'admin' && password === env.API_SECRET;
    };

    const authResponse = (realmTitle) => new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': `Basic realm="${realmTitle}"` }
    });

    let sys = {
      site_title: '⚡ Server Monitor Pro',
      admin_title: '⚙️ 探针管理后台',
      theme: 'theme1',
      custom_bg: '',
      is_public: 'true',
      show_price: 'true',
      show_expire: 'true',
      show_bw: 'true',
      show_tf: 'true',
      tg_notify: 'false',
      tg_bot_token: '',
      tg_chat_id: ''
    };

    try {
      const { results } = await env.DB.prepare('SELECT * FROM settings').all();
      if (results && results.length > 0) {
        results.forEach(r => sys[r.key] = r.value);
      }
    } catch (e) {}

    // ==========================================
    // Telegram 离线检测与通知机制
    // ==========================================
    const sendTelegram = async (msg) => {
      if (sys.tg_notify !== 'true' || !sys.tg_bot_token || !sys.tg_chat_id) return;
      try {
        await fetch(`https://api.telegram.org/bot${sys.tg_bot_token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: sys.tg_chat_id, text: msg, parse_mode: 'HTML' })
        });
      } catch (e) {}
    };

    const checkOfflineNodes = async () => {
      if (sys.tg_notify !== 'true') return;
      try {
        const { results: allServers } = await env.DB.prepare('SELECT id, name, last_updated FROM servers').all();
        let alertState = {};
        const stateRes = await env.DB.prepare("SELECT value FROM settings WHERE key = 'alert_state'").first();
        if (stateRes) alertState = JSON.parse(stateRes.value);
        let stateChanged = false;
        const now = Date.now();
        for (const s of allServers) {
          const diff = now - s.last_updated;
          const isOffline = diff > 180000;
          if (isOffline && !alertState[s.id]) {
            await sendTelegram(`⚠️ <b>节点离线告警</b>\n\n<b>节点名称:</b> ${s.name}\n<b>状态:</b> 离线 (超过3分钟未上报)\n<b>时间:</b> ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}`);
            alertState[s.id] = true;
            stateChanged = true;
          } else if (!isOffline && alertState[s.id]) {
            await sendTelegram(`✅ <b>节点恢复通知</b>\n\n<b>节点名称:</b> ${s.name}\n<b>状态:</b> 恢复在线\n<b>时间:</b> ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}`);
            delete alertState[s.id];
            stateChanged = true;
          }
        }
        if (stateChanged) {
          await env.DB.prepare('INSERT INTO settings (key, value) VALUES ("alert_state", ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(JSON.stringify(alertState)).run();
        }
      } catch (e) {}
    };

    const footerHtml = `
      <div class="hideable" style="text-align: center; margin-top: 40px; padding-bottom: 20px; font-size: 13px; color: inherit; opacity: 0.8;">
        Powered by <a href="https://github.com/a63414262/CF-Server-Monitor-Pro" target="_blank" style="color: #3b82f6; text-decoration: none; font-weight: 600;">Serverless</a> |
        <a href="https://vcalc.asorg.eu.org" target="_blank" style="color: #ef4444; text-decoration: none; font-weight: 600;">算鸡</a>
      </div>
    `;

    const themeStyles = `
      body.theme2 { background-color: #0d1117; color: #c9d1d9; }
      .theme2 .vps-card, .theme2 .global-stats, .theme2 .header-card, .theme2 .chart-card, .theme2 .world-map-wrap { background: #161b22; color: #c9d1d9; box-shadow: 0 4px 6px rgba(0,0,0,0.4); border: 1px solid #30363d; }
      .theme2 .vps-card:hover { border-color: #8b949e; }
      .theme2 .group-header { color: #58a6ff; border-left-color: #58a6ff; }
      .theme2 .stat-val, .theme2 .g-val { color: #fff; }
      .theme2 .stat-label, .theme2 .g-label, .theme2 .g-sub, .theme2 .card-meta, .theme2 .card-uptime { color: #8b949e; }
      .theme2 .stat-bar { background: #21262d; }
      .theme2 .divider { background: #30363d; }
      .theme2 .card-title { color: #fff; }
      .theme2 .map-section-header { color: #c9d1d9; border-bottom-color: #30363d; }
      .theme2 .map-section-header:hover { background: rgba(255,255,255,0.04); }

      body.theme3 { background-color: #fef08a; color: #000; font-weight: 500; }
      .theme3 .vps-card, .theme3 .global-stats, .theme3 .header-card, .theme3 .chart-card, .theme3 .world-map-wrap { background: #fff; border: 3px solid #000; border-radius: 0; box-shadow: 6px 6px 0px #000; transition: transform 0.1s, box-shadow 0.1s; }
      .theme3 .vps-card:hover { transform: translate(2px, 2px); box-shadow: 4px 4px 0px #000; border-color: #000; }
      .theme3 .group-header { color: #000; border-left: none; border-bottom: 4px solid #000; padding-left: 0; display: inline-block; font-size: 22px; font-weight: 900; text-transform: uppercase; }
      .theme3 .stat-bar { background: #e5e5e5; border: 1px solid #000; }
      .theme3 .stat-bar > div { border-right: 1px solid #000; }
      .theme3 .badge { border: 1px solid #000; border-radius: 0; }
      .theme3 .stat-val, .theme3 .g-val, .theme3 .card-title { font-weight: 900; color: #000; }

      body.theme4 { background: linear-gradient(45deg, #4facfe 0%, #00f2fe 100%); background-attachment: fixed; color: #fff; }
      .theme4 .vps-card, .theme4 .global-stats, .theme4 .header-card, .theme4 .chart-card, .theme4 .world-map-wrap { background: rgba(255,255,255,0.2); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.4); box-shadow: 0 8px 32px 0 rgba(31,38,135,0.1); color: #fff; }
      .theme4 .vps-card:hover { background: rgba(255,255,255,0.3); border-color: rgba(255,255,255,0.8); }
      .theme4 .group-header { color: #fff; border-left-color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.2); }
      .theme4 .stat-val, .theme4 .g-val, .theme4 .card-title { color: #fff; }
      .theme4 .stat-label, .theme4 .g-label, .theme4 .g-sub, .theme4 .card-meta, .theme4 .card-uptime { color: rgba(255,255,255,0.8); }
      .theme4 .stat-bar { background: rgba(0,0,0,0.2); }
      .theme4 .divider { background: rgba(255,255,255,0.2); }
      .theme4 .map-section-header { color: #fff; border-bottom-color: rgba(255,255,255,0.2); }

      body.theme5 { background-color: #050505; color: #0ff; font-family: 'Courier New', Courier, monospace; }
      .theme5 .vps-card, .theme5 .global-stats, .theme5 .header-card, .theme5 .chart-card, .theme5 .world-map-wrap { background: #0b0c10; border: 1px solid #f0f; border-radius: 0; box-shadow: 0 0 10px rgba(255,0,255,0.2); color: #fff; }
      .theme5 .vps-card:hover { box-shadow: 0 0 20px rgba(0,255,255,0.5); border-color: #0ff; }
      .theme5 .group-header { color: #f0f; border-left: 5px solid #0ff; text-shadow: 0 0 5px #f0f; }
      .theme5 .stat-val, .theme5 .g-val, .theme5 .card-title { color: #0ff; text-shadow: 0 0 5px #0ff; }
      .theme5 .stat-label, .theme5 .g-label, .theme5 .g-sub, .theme5 .card-meta, .theme5 .card-uptime { color: #f0f; }
      .theme5 .stat-bar { background: #222; }
      .theme5 .stat-bar > div { background: #0ff !important; box-shadow: 0 0 10px #0ff; }
      .theme5 .divider { background: #333; }
      .theme5 .badge-bw { background: #f0f; box-shadow: 0 0 5px #f0f; }
      .theme5 .badge-tf { background: #0ff; color:#000; box-shadow: 0 0 5px #0ff; }
      .theme5 .map-section-header { color: #0ff; border-bottom-color: #f0f; }

      ${sys.custom_bg ? `
        body {
          background: url('${sys.custom_bg}') no-repeat center center fixed !important;
          background-size: cover !important;
        }
        .vps-card, .global-stats, .header-card, .chart-card, .world-map-wrap {
          background: rgba(255,255,255,0.4) !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
          border: 1px solid rgba(255,255,255,0.6) !important;
          box-shadow: 0 8px 32px 0 rgba(0,0,0,0.1) !important;
          color: #111 !important;
        }
        .vps-card:hover { background: rgba(255,255,255,0.6) !important; transform: translateY(-3px); }
        .group-header { color: #fff !important; text-shadow: 0 2px 5px rgba(0,0,0,0.6) !important; border-left-color: #fff !important; }
        .stat-val, .g-val, .card-title { color: #000 !important; font-weight: 800 !important; }
        .stat-label, .g-label, .g-sub, .card-meta, .card-uptime { color: #333 !important; font-weight: 600 !important; }
        .stat-bar { background: rgba(0,0,0,0.1) !important; }
      ` : ''}
    `;

    // ==========================================
    // 1. 后台管理 API
    // ==========================================
    if (request.method === 'POST' && url.pathname === '/admin/api') {
      if (!checkAuth(request)) return authResponse(sys.admin_title);
      try {
        const data = await request.json();
        if (data.action === 'save_settings') {
          for (const [k, v] of Object.entries(data.settings)) {
            await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v).run();
          }
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        }
        else if (data.action === 'add') {
          const id = crypto.randomUUID();
          const name = data.name || 'New Server';
          await env.DB.prepare(`
            INSERT INTO servers
            (id, name, cpu, ram, disk, load_avg, uptime, last_updated, ram_total, net_rx, net_tx, net_in_speed, net_out_speed, os, cpu_info, country, server_group, price, expire_date, bandwidth, traffic_limit, ip_v4, ip_v6)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, name, '0', '0', '0', '0', '0', 0, '0', '0', '0', '0', '0', '', '', '', '默认分组', '免费', '', '', '', '0', '0').run();
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        }
        else if (data.action === 'delete') {
          await env.DB.prepare('DELETE FROM servers WHERE id = ?').bind(data.id).run();
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        }
        else if (data.action === 'edit') {
          await env.DB.prepare(`
            UPDATE servers SET server_group = ?, price = ?, expire_date = ?, bandwidth = ?, traffic_limit = ? WHERE id = ?
          `).bind(data.server_group || '默认分组', data.price || '', data.expire_date || '', data.bandwidth || '', data.traffic_limit || '', data.id).run();
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 400 });
      }
    }

    // ==========================================
    // 2. 后台管理 UI (/admin)
    // ==========================================
    if (request.method === 'GET' && url.pathname === '/admin') {
      if (!checkAuth(request)) return authResponse(sys.admin_title);
      const { results } = await env.DB.prepare('SELECT id, name, last_updated, server_group, price, expire_date, bandwidth, traffic_limit FROM servers').all();
      const now = Date.now();
      let trs = '';
      if (results && results.length > 0) {
        for (const s of results) {
          const isOnline = (now - s.last_updated) < 90000;
          const status = isOnline ? '<span style="color:green; font-weight:bold;">在线</span>' : '<span style="color:red; font-weight:bold;">离线</span>';
          const cmdApp = "cur" + "l";
          const cmd = `${cmdApp} -sL ${host}/install.sh | bash -s ${s.id} ${env.API_SECRET}`;
          trs += `
            <tr>
              <td>${s.name}</td>
              <td>${s.server_group || '默认分组'}</td>
              <td>${status}</td>
              <td>
                <input type="text" readonly value="${cmd}" style="width:280px; padding:6px; margin-right:5px; border:1px solid #ccc; border-radius:4px;" id="cmd-${s.id}">
                <button onclick="copyCmd('${s.id}')" class="btn btn-green">复制命令</button>
                <button onclick="openEditModal('${s.id}', '${s.server_group||''}', '${s.price||''}', '${s.expire_date||''}', '${s.bandwidth||''}', '${s.traffic_limit||''}')" class="btn btn-blue">✏️ 编辑</button>
                <button onclick="deleteServer('${s.id}')" class="btn btn-red">🗑️ 删除</button>
              </td>
            </tr>
          `;
        }
      }
      const html = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${sys.admin_title}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; background: #f0f2f5; color: #333;}
          .card { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); max-width: 1100px; margin: 0 auto 20px auto; }
          h2 { margin-top: 0; border-bottom: 2px solid #f0f2f5; padding-bottom: 10px; font-size: 20px;}
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px; }
          th, td { border: 1px solid #eee; padding: 12px; text-align: left; }
          th { background: #f8f9fa; }
          .btn { cursor: pointer; border-radius: 4px; font-size: 13px; transition: opacity 0.2s; border: none; padding: 6px 10px; color: white; margin-left: 5px; }
          .btn:hover { opacity: 0.8; }
          .btn-blue { background: #3b82f6; } .btn-green { background: #10b981; } .btn-red { background: #ef4444; } .btn-gray { background: #6b7280; }
          .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
          .form-group { display: flex; flex-direction: column; margin-bottom: 15px; }
          .form-group label { font-size: 14px; font-weight: 600; margin-bottom: 6px; color: #555;}
          .form-group input[type="text"], .form-group select { padding: 10px; border: 1px solid #ccc; border-radius: 6px; }
          .checkbox-group { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; font-size: 14px;}
          .checkbox-group input { width: 18px; height: 18px; cursor: pointer; }
          .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 100; }
          .modal-content { background: white; padding: 20px; border-radius: 8px; width: 400px; margin: 100px auto; position: relative;}
          .modal input { width: 100%; padding: 8px; margin-bottom: 12px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;}
          .modal label { font-size: 14px; color: #555; display: block; margin-bottom: 4px; font-weight: bold;}
        </style>
      </head>
      <body>
        <div class="card">
          <h2>🛠️ 全局设置</h2>
          <div class="settings-grid">
            <div>
              <div class="form-group">
                <label>🎨 前端主题风格 (5选1)</label>
                <select id="cfg_theme">
                  <option value="theme1" ${sys.theme === 'theme1' ? 'selected' : ''}>1. 默认清爽白 (Classic White)</option>
                  <option value="theme2" ${sys.theme === 'theme2' ? 'selected' : ''}>2. 暗黑极客 (Dark Mode)</option>
                  <option value="theme3" ${sys.theme === 'theme3' ? 'selected' : ''}>3. 新粗野主义 (Brutalism)</option>
                  <option value="theme4" ${sys.theme === 'theme4' ? 'selected' : ''}>4. 动态渐变毛玻璃 (Glassmorphism)</option>
                  <option value="theme5" ${sys.theme === 'theme5' ? 'selected' : ''}>5. 赛博朋克 (Cyberpunk)</option>
                </select>
              </div>
              <div class="form-group">
                <label>🖼️ 自定义背景图片</label>
                <div style="display:flex; gap:8px;">
                   <input type="text" id="cfg_custom_bg" value="${sys.custom_bg || ''}" placeholder="粘贴图片 URL 或 点击右侧按钮上传" style="flex:1;">
                   <input type="file" id="bg_file" accept="image/*" style="display:none;" onchange="uploadBg(this)">
                   <button class="btn btn-gray" onclick="document.getElementById('bg_file').click()">📁 本地上传</button>
                </div>
                <img id="bg_preview" src="${sys.custom_bg || ''}" style="max-height: 120px; margin-top: 10px; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); display: ${sys.custom_bg ? 'block' : 'none'}; object-fit: cover;">
              </div>
              <div class="form-group">
                <label>前台看板标题</label>
                <input type="text" id="cfg_site_title" value="${sys.site_title}">
              </div>
              <div class="form-group">
                <label>后台标签栏名称</label>
                <input type="text" id="cfg_admin_title" value="${sys.admin_title}">
              </div>
            </div>
            <div>
              <label style="font-size: 14px; font-weight: 600; margin-bottom: 10px; display: block; color: #555;">👁️ 前台展示控制</label>
              <div class="checkbox-group">
                <input type="checkbox" id="cfg_is_public" ${sys.is_public === 'true' ? 'checked' : ''}>
                <label for="cfg_is_public"><b>公开访问</b></label>
              </div>
              <div class="checkbox-group">
                <input type="checkbox" id="cfg_show_price" ${sys.show_price === 'true' ? 'checked' : ''}>
                <label for="cfg_show_price">显示 <b>价格</b></label>
              </div>
              <div class="checkbox-group">
                <input type="checkbox" id="cfg_show_expire" ${sys.show_expire === 'true' ? 'checked' : ''}>
                <label for="cfg_show_expire">显示 <b>到期时间</b></label>
              </div>
              <div class="checkbox-group">
                <input type="checkbox" id="cfg_show_bw" ${sys.show_bw === 'true' ? 'checked' : ''}>
                <label for="cfg_show_bw">显示 <b>带宽徽章</b></label>
              </div>
              <div class="checkbox-group">
                <input type="checkbox" id="cfg_show_tf" ${sys.show_tf === 'true' ? 'checked' : ''}>
                <label for="cfg_show_tf">显示 <b>流量配额徽章</b></label>
              </div>
              <hr style="margin: 20px 0; border: none; border-top: 1px dashed #ccc;">
              <label style="font-size: 14px; font-weight: 600; margin-bottom: 10px; display: block; color: #e63946;">✈️ Telegram 离线告警</label>
              <div class="form-group">
                <label>开启离线通知</label>
                <select id="cfg_tg_notify">
                  <option value="false" ${sys.tg_notify !== 'true' ? 'selected' : ''}>关闭告警</option>
                  <option value="true" ${sys.tg_notify === 'true' ? 'selected' : ''}>开启告警</option>
                </select>
              </div>
              <div class="form-group">
                <label>Bot Token</label>
                <input type="text" id="cfg_tg_bot_token" value="${sys.tg_bot_token || ''}" placeholder="12345678:ABCDEFG...">
              </div>
              <div class="form-group">
                <label>Chat ID</label>
                <input type="text" id="cfg_tg_chat_id" value="${sys.tg_chat_id || ''}" placeholder="123456789">
              </div>
            </div>
          </div>
          <button onclick="saveSettings()" class="btn btn-blue" style="padding: 10px 20px; font-size: 15px;">💾 保存全局设置</button>
        </div>
        <div class="card">
          <h2>${sys.admin_title} - 节点列表</h2>
          <div style="margin-bottom: 15px;">
            <input type="text" id="newName" placeholder="输入新服务器名称" style="padding: 8px; width: 200px; border:1px solid #ccc; border-radius:4px;">
            <button onclick="addServer()" class="btn btn-blue" style="padding: 9px 15px;">+ 添加新服务器</button>
            <a href="/" style="float: right; margin-top: 8px; color: #3b82f6; text-decoration: none; font-weight:bold;">👉 前往大盘预览</a>
          </div>
          <table>
            <tr><th>节点名称</th><th>分组</th><th>在线状态</th><th>操作</th></tr>
            ${trs || '<tr><td colspan="4" style="text-align:center; padding: 30px; color:#666;">暂无服务器，请在上方添加</td></tr>'}
          </table>
        </div>
        <div id="editModal" class="modal">
          <div class="modal-content">
            <h3 style="margin-top:0;">✏️ 编辑服务器信息</h3>
            <input type="hidden" id="editId">
            <label>分组名称</label> <input type="text" id="editGroup" placeholder="如：美国 VPS">
            <label>价格</label> <input type="text" id="editPrice" placeholder="如：40USD/Year">
            <label>到期时间</label> <input type="date" id="editExpire">
            <label>带宽 (前端徽章)</label> <input type="text" id="editBandwidth" placeholder="如：1Gbps">
            <label>流量总量 (前端徽章)</label> <input type="text" id="editTraffic" placeholder="如：1TB/月">
            <div style="text-align: right; margin-top: 10px;">
              <button onclick="closeModal()" style="padding: 8px 15px; border: 1px solid #ccc; background: white; margin-right: 5px; cursor:pointer;">取消</button>
              <button onclick="saveEdit()" class="btn btn-blue" style="padding: 8px 15px;">保存更改</button>
            </div>
          </div>
        </div>
        ${footerHtml}
        <script>
          function uploadBg(input) {
            const file = input.files[0]; if(!file) return;
            if(file.size > 800 * 1024) alert('图片有点大，建议使用 500KB 以下的图片！');
            const reader = new FileReader();
            reader.onload = function(e) {
              document.getElementById('cfg_custom_bg').value = e.target.result;
              document.getElementById('bg_preview').src = e.target.result;
              document.getElementById('bg_preview').style.display = 'block';
            };
            reader.readAsDataURL(file);
          }
          async function saveSettings() {
            const data = { action: 'save_settings', settings: {
              theme: document.getElementById('cfg_theme').value,
              custom_bg: document.getElementById('cfg_custom_bg').value,
              site_title: document.getElementById('cfg_site_title').value,
              admin_title: document.getElementById('cfg_admin_title').value,
              is_public: document.getElementById('cfg_is_public').checked ? 'true' : 'false',
              show_price: document.getElementById('cfg_show_price').checked ? 'true' : 'false',
              show_expire: document.getElementById('cfg_show_expire').checked ? 'true' : 'false',
              show_bw: document.getElementById('cfg_show_bw').checked ? 'true' : 'false',
              show_tf: document.getElementById('cfg_show_tf').checked ? 'true' : 'false',
              tg_notify: document.getElementById('cfg_tg_notify').value,
              tg_bot_token: document.getElementById('cfg_tg_bot_token').value,
              tg_chat_id: document.getElementById('cfg_tg_chat_id').value
            }};
            const res = await fetch('/admin/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (res.ok) { alert('✅ 设置已保存！'); location.reload(); } else alert('保存失败');
          }
          async function addServer() {
            const name = document.getElementById('newName').value;
            if (!name) return alert('请输入名称');
            const res = await fetch('/admin/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', name }) });
            if (res.ok) location.reload(); else alert('添加失败');
          }
          async function deleteServer(id) {
            if (!confirm('确定要删除这个节点吗？')) return;
            const res = await fetch('/admin/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) });
            if (res.ok) location.reload(); else alert('删除失败');
          }
          function copyCmd(id) {
            const input = document.getElementById('cmd-' + id);
            input.select(); document.execCommand('copy');
            alert('✅ 一键命令已复制！');
          }
          function openEditModal(id, group, price, expire, bw, traffic) {
            document.getElementById('editId').value = id;
            document.getElementById('editGroup').value = group || '默认分组';
            document.getElementById('editPrice').value = price || '免费';
            document.getElementById('editExpire').value = expire || '';
            document.getElementById('editBandwidth').value = bw || '';
            document.getElementById('editTraffic').value = traffic || '';
            document.getElementById('editModal').style.display = 'block';
          }
          function closeModal() { document.getElementById('editModal').style.display = 'none'; }
          async function saveEdit() {
            const data = {
              action: 'edit', id: document.getElementById('editId').value,
              server_group: document.getElementById('editGroup').value,
              price: document.getElementById('editPrice').value,
              expire_date: document.getElementById('editExpire').value,
              bandwidth: document.getElementById('editBandwidth').value,
              traffic_limit: document.getElementById('editTraffic').value
            };
            const res = await fetch('/admin/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (res.ok) location.reload(); else alert('保存失败');
          }
        </script>
      </body>
      </html>`;
      return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    }

    // ==========================================
    // 3. 一键安装脚本 (/install.sh) — 保持原始版本，字符串混淆不变
    // ==========================================
    if (request.method === 'GET' && url.pathname === '/install.sh') {
      const sh_bin  = "/bin"    + "/bash";
      const sh_etc  = "/etc/"   + "systemd/" + "system";
      const sh_sys  = "system"  + "ctl";
      const sh_curl = "cur"     + "l";

      const bashScript = `#!${sh_bin}
SERVER_ID=$1
SECRET=$2
WORKER_URL="${host}/update"

if [ -z "$SERVER_ID" ] || [ -z "$SECRET" ]; then echo "错误: 缺少参数。"; exit 1; fi
echo "开始安装全面增强版 CF Probe Agent..."

${sh_sys} stop cf-probe.service 2>/dev/null
pkill -f cf-probe.sh 2>/dev/null

cat << 'EOF' > /usr/local/bin/cf-probe.sh
#!${sh_bin}
SERVER_ID="$1"
SECRET="$2"
WORKER_URL="$3"

get_net_bytes() { awk 'NR>2 {rx+=\$2; tx+=\$10} END {printf "%.0f %.0f", rx, tx}' /proc/net/dev; }
get_cpu_stat() { awk '/^cpu / {print \$2+\$3+\$4+\$5+\$6+\$7+\$8+\$9, \$5+\$6}' /proc/stat; }

NET_STAT=\$(get_net_bytes)
RX_PREV=\$(echo \$NET_STAT | awk '{print \$1}')
TX_PREV=\$(echo \$NET_STAT | awk '{print \$2}')
if [ -z "\$RX_PREV" ]; then RX_PREV=0; fi
if [ -z "\$TX_PREV" ]; then TX_PREV=0; fi

CPU_STAT=\$(get_cpu_stat)
PREV_CPU_TOTAL=\$(echo \$CPU_STAT | awk '{print \$1}')
PREV_CPU_IDLE=\$(echo \$CPU_STAT | awk '{print \$2}')

LOOP_COUNT=0
IPV4="0"; IPV6="0"

while true; do
  if [ \$((LOOP_COUNT % 60)) -eq 0 ]; then
    ${sh_curl} -s -4 -m 3 https://cloudflare.com/cdn-cgi/trace 2>/dev/null | grep -q "ip=" && IPV4="1" || IPV4="0"
    ${sh_curl} -s -6 -m 3 https://cloudflare.com/cdn-cgi/trace 2>/dev/null | grep -q "ip=" && IPV6="1" || IPV6="0"
  fi
  LOOP_COUNT=\$((LOOP_COUNT + 1))

  OS=\$(awk -F= '/^PRETTY_NAME/{print \$2}' /etc/os-release | tr -d '"')
  if [ -z "\$OS" ]; then OS=\$(uname -srm); fi
  ARCH=\$(uname -m)
  BOOT_TIME=\$(uptime -s 2>/dev/null || stat -c %y / 2>/dev/null | cut -d'.' -f1 || echo "Unknown")
  CPU_INFO=\$(grep -m 1 'model name' /proc/cpuinfo | awk -F: '{print \$2}' | xargs | tr -d '"')

  CPU_STAT=\$(get_cpu_stat)
  CPU_TOTAL=\$(echo \$CPU_STAT | awk '{print \$1}')
  CPU_IDLE=\$(echo \$CPU_STAT | awk '{print \$2}')
  DIFF_TOTAL=\$((CPU_TOTAL - PREV_CPU_TOTAL))
  DIFF_IDLE=\$((CPU_IDLE - PREV_CPU_IDLE))
  CPU=\$(awk -v t=\$DIFF_TOTAL -v i=\$DIFF_IDLE 'BEGIN {if (t==0) print 0; else printf "%.2f", (1 - i/t)*100}')
  PREV_CPU_TOTAL=\$CPU_TOTAL; PREV_CPU_IDLE=\$CPU_IDLE

  MEM_INFO=\$(free -m)
  RAM_TOTAL=\$(echo "\$MEM_INFO" | awk '/Mem:/ {print \$2}')
  RAM_USED=\$(echo "\$MEM_INFO" | awk '/Mem:/ {print \$3}')
  RAM=\$(awk "BEGIN {if(\$RAM_TOTAL>0) printf \\"%.2f\\", \$RAM_USED/\$RAM_TOTAL * 100.0; else print 0}")

  SWAP_TOTAL=\$(echo "\$MEM_INFO" | awk '/Swap:/ {print \$2}')
  SWAP_USED=\$(echo "\$MEM_INFO" | awk '/Swap:/ {print \$3}')
  if [ -z "\$SWAP_TOTAL" ]; then SWAP_TOTAL=0; fi
  if [ -z "\$SWAP_USED" ]; then SWAP_USED=0; fi

  DISK_INFO=\$(df -hm / | tail -n1 | awk '{print \$2, \$3, \$5}')
  DISK_TOTAL=\$(echo "\$DISK_INFO" | awk '{print \$1}')
  DISK_USED=\$(echo "\$DISK_INFO" | awk '{print \$2}')
  DISK=\$(echo "\$DISK_INFO" | awk '{print \$3}' | tr -d '%')

  LOAD=\$(cat /proc/loadavg | awk '{print \$1, \$2, \$3}')
  UPTIME_SECS=\$(awk '{print int(\$1)}' /proc/uptime)
  UPTIME_D=\$((UPTIME_SECS / 86400))
  UPTIME_H=\$(( (UPTIME_SECS % 86400) / 3600 ))
  UPTIME_M=\$(( (UPTIME_SECS % 3600) / 60 ))
  if [ \$UPTIME_D -ge 1 ]; then UPTIME="\${UPTIME_D}天\${UPTIME_H}时\${UPTIME_M}分"
  elif [ \$UPTIME_H -ge 1 ]; then UPTIME="\${UPTIME_H}时\${UPTIME_M}分"
  else UPTIME="\${UPTIME_M}分"; fi

  PROCESSES=\$(ps -e | wc -l)
  TCP_CONN=\$(ss -ant 2>/dev/null | grep -v State | wc -l || netstat -ant 2>/dev/null | grep -v Active | wc -l)
  UDP_CONN=\$(ss -anu 2>/dev/null | grep -v State | wc -l || netstat -anu 2>/dev/null | grep -v Active | wc -l)

  NET_STAT=\$(get_net_bytes)
  RX_NOW=\$(echo \$NET_STAT | awk '{print \$1}')
  TX_NOW=\$(echo \$NET_STAT | awk '{print \$2}')
  if [ -z "\$RX_NOW" ]; then RX_NOW=0; fi
  if [ -z "\$TX_NOW" ]; then TX_NOW=0; fi

  RX_SPEED=\$(((RX_NOW - RX_PREV) / 60))
  TX_SPEED=\$(((TX_NOW - TX_PREV) / 60))
  RX_PREV=\$RX_NOW; TX_PREV=\$TX_NOW

  PAYLOAD="{\\"id\\": \\"\$SERVER_ID\\", \\"secret\\": \\"\$SECRET\\", \\"metrics\\": { \\"cpu\\": \\"\$CPU\\", \\"ram\\": \\"\$RAM\\", \\"ram_total\\": \\"\$RAM_TOTAL\\", \\"ram_used\\": \\"\$RAM_USED\\", \\"swap_total\\": \\"\$SWAP_TOTAL\\", \\"swap_used\\": \\"\$SWAP_USED\\", \\"disk\\": \\"\$DISK\\", \\"disk_total\\": \\"\$DISK_TOTAL\\", \\"disk_used\\": \\"\$DISK_USED\\", \\"load\\": \\"\$LOAD\\", \\"uptime\\": \\"\$UPTIME\\", \\"boot_time\\": \\"\$BOOT_TIME\\", \\"net_rx\\": \\"\$RX_NOW\\", \\"net_tx\\": \\"\$TX_NOW\\", \\"net_in_speed\\": \\"\$RX_SPEED\\", \\"net_out_speed\\": \\"\$TX_SPEED\\", \\"os\\": \\"\$OS\\", \\"arch\\": \\"\$ARCH\\", \\"cpu_info\\": \\"\$CPU_INFO\\", \\"processes\\": \\"\$PROCESSES\\", \\"tcp_conn\\": \\"\$TCP_CONN\\", \\"udp_conn\\": \\"\$UDP_CONN\\", \\"ip_v4\\": \\"\$IPV4\\", \\"ip_v6\\": \\"\$IPV6\\" }}"

  ${sh_curl} -s -X POST -H "Content-Type: application/json" -d "\$PAYLOAD" "$WORKER_URL" > /dev/null

  sleep 60
done
EOF

chmod +x /usr/local/bin/cf-probe.sh

cat << EOF > ${sh_etc}/cf-probe.service
[Unit]
Description=Cloudflare Worker Probe Agent
After=network.target

[Service]
ExecStart=/usr/local/bin/cf-probe.sh $SERVER_ID $SECRET $WORKER_URL
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

${sh_sys} daemon-reload
${sh_sys} enable cf-probe.service
${sh_sys} restart cf-probe.service

echo "✅ 探针安装成功！"
`;
      return new Response(bashScript, { headers: { 'Content-Type': 'text/plain;charset=UTF-8' } });
    }

    // ==========================================
    // 4. API 接收数据 (/update)
    // ==========================================
    if (request.method === 'POST' && url.pathname === '/update') {
      try {
        const data = await request.json();
        const { id, secret, metrics } = data;
        if (secret !== env.API_SECRET) return new Response('Unauthorized', { status: 401 });
        let countryCode = request.cf && request.cf.country ? request.cf.country : 'XX';
        if (countryCode.toUpperCase() === 'TW') countryCode = 'CN';
        const serverExists = await env.DB.prepare('SELECT id FROM servers WHERE id = ?').bind(id).first();
        if (!serverExists) return new Response('Server not found', { status: 404 });
        await env.DB.prepare(`
          UPDATE servers
          SET cpu = ?, ram = ?, disk = ?, load_avg = ?, uptime = ?, last_updated = ?,
              ram_total = ?, net_rx = ?, net_tx = ?, net_in_speed = ?, net_out_speed = ?,
              os = ?, cpu_info = ?, arch = ?, boot_time = ?, ram_used = ?, swap_total = ?,
              swap_used = ?, disk_total = ?, disk_used = ?, processes = ?, tcp_conn = ?, udp_conn = ?,
              country = ?, ip_v4 = ?, ip_v6 = ?
          WHERE id = ?
        `).bind(
          metrics.cpu, metrics.ram, metrics.disk, metrics.load, metrics.uptime, Date.now(),
          metrics.ram_total || '0', metrics.net_rx || '0', metrics.net_tx || '0',
          metrics.net_in_speed || '0', metrics.net_out_speed || '0',
          metrics.os || '', metrics.cpu_info || '', metrics.arch || '', metrics.boot_time || '',
          metrics.ram_used || '0', metrics.swap_total || '0', metrics.swap_used || '0',
          metrics.disk_total || '0', metrics.disk_used || '0', metrics.processes || '0',
          metrics.tcp_conn || '0', metrics.udp_conn || '0', countryCode,
          metrics.ip_v4 || '0', metrics.ip_v6 || '0', id
        ).run();
        ctx.waitUntil(checkOfflineNodes());
        return new Response('OK', { status: 200 });
      } catch (e) {
        return new Response('Error', { status: 400 });
      }
    }

    // ==========================================
    // 5. 单个服务器详情 JSON API
    // ==========================================
    if (request.method === 'GET' && url.pathname === '/api/server') {
      if (sys.is_public !== 'true' && !checkAuth(request)) return authResponse(sys.site_title);
      const id = url.searchParams.get('id');
      if (!id) return new Response('Miss ID', { status: 400 });
      const server = await env.DB.prepare('SELECT * FROM servers WHERE id = ?').bind(id).first();
      if (!server) return new Response('Not Found', { status: 404 });
      return new Response(JSON.stringify(server), { headers: { 'Content-Type': 'application/json' } });
    }

    // ==========================================
    // 6. 前台探针首页 & 详情页 (/)
    // ==========================================
    if (request.method === 'GET' && url.pathname === '/') {
      if (sys.is_public !== 'true' && !checkAuth(request)) {
        return authResponse(sys.site_title);
      }

      const viewId = url.searchParams.get('id');

      // ----------------------------------------
      // 视图 A：详情页折线图
      // ----------------------------------------
      if (viewId) {
        const server = await env.DB.prepare('SELECT * FROM servers WHERE id = ?').bind(viewId).first();
        if (!server) return new Response('Server not found', { status: 404 });
        const detailHtml = `<!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${server.name} - ${sys.site_title}</title>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f9fafb; color: #333; margin: 0; padding: 20px; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header-card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
            .title-row { display: flex; align-items: center; margin-bottom: 16px; }
            .title-row h2 { margin: 0; font-size: 24px; margin-right: 12px; display: flex; align-items: center;}
            .status-badge { background: #10b981; color: white; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; }
            .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; font-size: 14px; }
            .info-item { display: flex; flex-direction: column; }
            .info-label { color: #6b7280; font-size: 12px; margin-bottom: 4px; }
            .info-value { font-weight: 500; }
            .charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }
            .chart-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .chart-card h3 { margin-top: 0; font-size: 16px; color: #374151; display: flex; justify-content: space-between; align-items: center; }
            .chart-val { font-size: 18px; font-weight: bold; }
            canvas { max-height: 150px; }
            .back-btn { display: inline-block; margin-bottom: 15px; color: #3b82f6; text-decoration: none; font-weight: 500; }
            /* 壁纸全屏模式 */
            .wallpaper-btn-detail { position: fixed; top: 18px; right: 18px; z-index: 999; padding: 8px 12px; background: rgba(0,0,0,0.12); border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; cursor: pointer; font-size: 16px; line-height: 1; backdrop-filter: blur(4px); transition: background 0.2s; }
            .wallpaper-btn-detail:hover { background: rgba(0,0,0,0.2); }
            body.wallpaper-mode .hideable { display: none !important; }
            .wallpaper-restore { display: none; position: fixed; top: 20px; right: 20px; z-index: 9999; padding: 10px 18px; background: rgba(0,0,0,0.65); color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 14px; backdrop-filter: blur(8px); }
            body.wallpaper-mode .wallpaper-restore { display: block; }
            ${themeStyles}
          </style>
        </head>
        <body class="${sys.theme || 'theme1'}">
          <!-- 壁纸模式恢复按钮 -->
          <button class="wallpaper-restore" onclick="toggleWallpaper()">✕ 退出壁纸模式</button>
          <!-- 壁纸切换按钮（右上角浮动） -->
          <button class="wallpaper-btn-detail hideable" onclick="toggleWallpaper()" title="壁纸全屏预览">🖼️</button>

          <div class="container hideable">
            <a href="/" class="back-btn">⬅ 返回大盘</a>
            <div class="header-card">
              <div class="title-row">
                <h2><span id="head-flag"></span> ${server.name}</h2>
                <span class="status-badge" id="head-status">在线</span>
              </div>
              <div class="info-grid">
                <div class="info-item"><span class="info-label">运行时间</span><span class="info-value" id="val-uptime">...</span></div>
                <div class="info-item"><span class="info-label">架构</span><span class="info-value" id="val-arch">...</span></div>
                <div class="info-item"><span class="info-label">系统</span><span class="info-value" id="val-os">...</span></div>
                <div class="info-item"><span class="info-label">CPU</span><span class="info-value" id="val-cpuinfo">...</span></div>
                <div class="info-item"><span class="info-label">Load</span><span class="info-value" id="val-load">...</span></div>
                <div class="info-item"><span class="info-label">上传 / 下载</span><span class="info-value" id="val-traffic">...</span></div>
                <div class="info-item"><span class="info-label">启动时间</span><span class="info-value" id="val-boot">...</span></div>
              </div>
            </div>
            <div class="charts-grid">
              <div class="chart-card"><h3>CPU <span class="chart-val" id="text-cpu">0%</span></h3><canvas id="chartCPU"></canvas></div>
              <div class="chart-card"><h3>内存 <span class="chart-val" id="text-ram">0%</span></h3><div style="font-size:12px; color:#6b7280; margin-bottom:5px;" id="text-swap">Swap: 0 / 0</div><canvas id="chartRAM"></canvas></div>
              <div class="chart-card"><h3>磁盘 <span class="chart-val" id="text-disk">0%</span></h3><div style="width:100%; height:20px; background:#e5e7eb; border-radius:10px; overflow:hidden; margin-top:40px;"><div id="disk-bar" style="height:100%; width:0%; background:#34d399; transition:width 0.5s;"></div></div><p style="text-align:right; font-size:12px; color:#6b7280; margin-top:8px;" id="text-disk-detail">0 / 0</p></div>
              <div class="chart-card"><h3>进程数 <span class="chart-val" id="text-proc">0</span></h3><canvas id="chartProc"></canvas></div>
              <div class="chart-card"><h3>网络速度 <span class="chart-val" style="font-size:14px;"><span style="color:#10b981">↓</span> <span id="text-net-in">0</span> | <span style="color:#3b82f6">↑</span> <span id="text-net-out">0</span></span></h3><canvas id="chartNet"></canvas></div>
              <div class="chart-card"><h3>TCP / UDP <span class="chart-val" style="font-size:14px;">TCP <span id="text-tcp">0</span> | UDP <span id="text-udp">0</span></span></h3><canvas id="chartConn"></canvas></div>
            </div>
            ${footerHtml}
          </div>
          <script>
            function toggleWallpaper() { document.body.classList.toggle('wallpaper-mode'); }

            const serverId = "${viewId}";
            const formatBytes = (bytes) => { const b = parseInt(bytes); if (isNaN(b) || b === 0) return '0 B'; const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.floor(Math.log(b) / Math.log(k)); return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]; };
            const commonOptions = { responsive: true, maintainAspectRatio: false, animation: { duration: 0 }, scales: { x: { display: false }, y: { beginAtZero: true, border: { display: false } } }, plugins: { legend: { display: false }, tooltip: { enabled: false } }, elements: { point: { radius: 0 }, line: { tension: 0.4, borderWidth: 2 } } };
            const createChart = (ctxId, color, bgColor) => { const ctx = document.getElementById(ctxId).getContext('2d'); return new Chart(ctx, { type: 'line', data: { labels: Array(30).fill(''), datasets: [{ data: Array(30).fill(0), borderColor: color, backgroundColor: bgColor, fill: true }] }, options: commonOptions }); };
            const charts = { cpu: createChart('chartCPU', '#3b82f6', 'rgba(59,130,246,0.1)'), ram: createChart('chartRAM', '#8b5cf6', 'rgba(139,92,246,0.1)'), proc: createChart('chartProc', '#ec4899', 'rgba(236,72,153,0.1)') };
            const ctxNet = document.getElementById('chartNet').getContext('2d'); charts.net = new Chart(ctxNet, { type: 'line', data: { labels: Array(30).fill(''), datasets: [ { label: 'In', data: Array(30).fill(0), borderColor: '#10b981', borderWidth: 2, tension: 0.4, pointRadius: 0 }, { label: 'Out', data: Array(30).fill(0), borderColor: '#3b82f6', borderWidth: 2, tension: 0.4, pointRadius: 0 } ]}, options: commonOptions });
            const ctxConn = document.getElementById('chartConn').getContext('2d'); charts.conn = new Chart(ctxConn, { type: 'line', data: { labels: Array(30).fill(''), datasets: [ { label: 'TCP', data: Array(30).fill(0), borderColor: '#6366f1', borderWidth: 2, tension: 0.4, pointRadius: 0 }, { label: 'UDP', data: Array(30).fill(0), borderColor: '#d946ef', borderWidth: 2, tension: 0.4, pointRadius: 0 } ]}, options: commonOptions });
            const updateChartData = (chart, newData, datasetIndex = 0) => { const dataArr = chart.data.datasets[datasetIndex].data; dataArr.push(newData); dataArr.shift(); chart.update(); };
            async function fetchData() {
              try {
                const res = await fetch('/api/server?id=' + serverId); const data = await res.json();
                const cCode = (data.country || 'xx').toLowerCase();
                // 国旗：只约束 height，width 自适应，彻底消除间隙
                document.getElementById('head-flag').innerHTML = cCode !== 'xx' ? \`<img src="https://flagcdn.com/\${cCode}.svg" height="20" style="width:auto;vertical-align:middle;margin-right:8px;border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,0.2);" alt="\${cCode}">\` : '🏳️ ';
                document.getElementById('val-uptime').innerText = data.uptime || 'N/A';
                document.getElementById('val-arch').innerText = data.arch || 'N/A';
                document.getElementById('val-os').innerText = data.os || 'N/A';
                document.getElementById('val-cpuinfo').innerText = data.cpu_info || 'N/A';
                document.getElementById('val-load').innerText = data.load_avg || '0.00';
                document.getElementById('val-boot').innerText = data.boot_time || 'N/A';
                document.getElementById('val-traffic').innerText = formatBytes(data.net_tx) + ' / ' + formatBytes(data.net_rx);
                const isOnline = (Date.now() - data.last_updated) < 90000;
                const badge = document.getElementById('head-status'); badge.innerText = isOnline ? '在线' : '离线'; badge.style.background = isOnline ? '#10b981' : '#ef4444';
                if(!isOnline) return;
                document.getElementById('text-cpu').innerText = data.cpu + '%'; document.getElementById('text-ram').innerText = data.ram + '%'; document.getElementById('text-swap').innerText = 'Swap: ' + data.swap_used + ' MiB / ' + data.swap_total + ' MiB'; document.getElementById('text-proc').innerText = data.processes || '0'; document.getElementById('text-net-in').innerText = formatBytes(data.net_in_speed) + '/s'; document.getElementById('text-net-out').innerText = formatBytes(data.net_out_speed) + '/s'; document.getElementById('text-tcp').innerText = data.tcp_conn || '0'; document.getElementById('text-udp').innerText = data.udp_conn || '0';
                let diskTotal = parseFloat(data.disk_total) || 0; let diskUsed = parseFloat(data.disk_used) || 0; let diskPct = parseInt(data.disk) || 0;
                document.getElementById('text-disk').innerText = diskPct + '%'; document.getElementById('disk-bar').style.width = diskPct + '%'; document.getElementById('text-disk-detail').innerText = (diskUsed/1024).toFixed(2) + ' GiB / ' + (diskTotal/1024).toFixed(2) + ' GiB';
                updateChartData(charts.cpu, parseFloat(data.cpu) || 0); updateChartData(charts.ram, parseFloat(data.ram) || 0); updateChartData(charts.proc, parseInt(data.processes) || 0); updateChartData(charts.net, parseFloat(data.net_in_speed) || 0, 0); updateChartData(charts.net, parseFloat(data.net_out_speed) || 0, 1); updateChartData(charts.conn, parseInt(data.tcp_conn) || 0, 0); updateChartData(charts.conn, parseInt(data.udp_conn) || 0, 1);
              } catch (e) {}
            }
            setInterval(fetchData, 60000); fetchData();
          </script>
        </body>
        </html>`;
        return new Response(detailHtml, { headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=30' } });
      }

      // ----------------------------------------
      // 视图 B：增强版前台大盘
      // ----------------------------------------
      const { results } = await env.DB.prepare('SELECT * FROM servers').all();
      const now = Date.now();

      let globalOnline = 0; let globalOffline = 0;
      let globalSpeedIn = 0; let globalSpeedOut = 0;
      let globalNetTx = 0; let globalNetRx = 0;
      const groups = {};

      // 为全球地图准备数据：按国家聚合服务器信息
      const vpsMapData = {};

      if (results && results.length > 0) {
        for (const server of results) {
          const isOnline = (now - server.last_updated) < 90000;
          if (isOnline) {
            globalOnline++;
            globalSpeedIn += parseFloat(server.net_in_speed) || 0;
            globalSpeedOut += parseFloat(server.net_out_speed) || 0;
          } else {
            globalOffline++;
          }
          globalNetTx += parseFloat(server.net_tx) || 0;
          globalNetRx += parseFloat(server.net_rx) || 0;

          const grpName = server.server_group || '默认分组';
          if (!groups[grpName]) groups[grpName] = [];
          groups[grpName].push(server);

          // 聚合地图数据（跳过未知国家）
          const cc = (server.country || 'XX').toUpperCase();
          if (cc !== 'XX') {
            if (!vpsMapData[cc]) vpsMapData[cc] = { count: 0, online: 0, servers: [] };
            vpsMapData[cc].count++;
            if (isOnline) vpsMapData[cc].online++;
            // 安全处理服务器名，防止特殊字符破坏 JSON
            vpsMapData[cc].servers.push(String(server.name || 'Unknown').replace(/[<>"']/g, ''));
          }
        }
      }

      // 将地图数据序列化为 JSON，转义反引号以防止破坏 JS 模板字符串
      const mapDataJson = JSON.stringify(vpsMapData).replace(/`/g, '\\`');

      let contentHtml = '';
      if (Object.keys(groups).length === 0) {
        contentHtml = '<p style="text-align:center; width: 100%; color:#888;">暂无服务器，请在后台添加</p>';
      } else {
        for (const [grpName, grpServers] of Object.entries(groups)) {
          contentHtml += `<div class="group-header">${grpName}</div><div class="grid-container">`;
          for (const server of grpServers) {
            const isOnline = (now - server.last_updated) < 90000;
            const statusColor = isOnline ? '#10b981' : '#ef4444';
            const cpu = server.cpu || '0'; const ram = server.ram || '0'; const disk = server.disk || '0';
            const netInSpeed = formatBytes(server.net_in_speed); const netOutSpeed = formatBytes(server.net_out_speed);

            const cCode = (server.country || 'xx').toLowerCase();
            // 只设 height 让 width 自适应：浏览器按 SVG 自然比例缩放，无任何容器填充间隙
            const flagHtml = cCode !== 'xx'
              ? `<img src="https://flagcdn.com/${cCode}.svg" height="14" style="width:auto;vertical-align:sub;margin-right:5px;border-radius:2px;box-shadow:0 1px 2px rgba(0,0,0,0.15);" alt="${cCode}">`
              : '<span style="margin-right:5px;">🏳️</span>';

            let metaHtml = '';
            if (sys.show_price === 'true') {
              metaHtml += `<div class="card-meta" style="margin-top:6px;">价格: ${server.price || '免费'}</div>`;
            }
            if (sys.show_expire === 'true') {
              let expireText = '永久';
              if (server.expire_date) {
                const expTime = new Date(server.expire_date).getTime();
                if (!isNaN(expTime)) {
                  const diff = expTime - now;
                  expireText = diff > 0 ? Math.ceil(diff / (1000 * 3600 * 24)) + ' 天' : '<span style="color:#ef4444">已过期</span>';
                }
              }
              metaHtml += `<div class="card-meta" style="${sys.show_price !== 'true' ? 'margin-top:6px;' : ''}">剩余: ${expireText}</div>`;
            }

            // 运行时长显示
            const uptimeText = server.uptime || '';
            const uptimeHtml = uptimeText ? `<div class="card-uptime">⏱ ${uptimeText}</div>` : '';

            let badgesHtml = '';
            if (sys.show_bw === 'true' && server.bandwidth) badgesHtml += `<span class="badge badge-bw">${server.bandwidth}</span>`;
            if (sys.show_tf === 'true' && server.traffic_limit) badgesHtml += `<span class="badge badge-tf">${server.traffic_limit}</span>`;
            if (server.ip_v4 === '1') badgesHtml += `<span class="badge badge-v4">IPv4</span>`;
            if (server.ip_v6 === '1') badgesHtml += `<span class="badge badge-v6">IPv6</span>`;

            contentHtml += `
              <a href="/?id=${server.id}" class="vps-card${isOnline ? '' : ' offline'}">
                <div class="card-left">
                  <div class="card-title">
                    <div class="status-dot${isOnline ? ' online' : ''}" style="background:${statusColor};"></div>
                    ${flagHtml} <span style="font-size:15px;" class="card-title-text">${server.name}</span>
                  </div>
                  ${metaHtml}
                  ${uptimeHtml}
                  <div class="card-badges">${badgesHtml}</div>
                </div>
                <div class="card-right">
                  <div class="stat-col"><div class="stat-label">CPU</div><div class="stat-val">${cpu}%</div><div class="stat-bar"><div style="width:${cpu}%;"></div></div></div>
                  <div class="stat-col"><div class="stat-label">内存</div><div class="stat-val">${ram}%</div><div class="stat-bar"><div style="width:${ram}%; background:#f59e0b;"></div></div></div>
                  <div class="stat-col"><div class="stat-label">存储</div><div class="stat-val">${disk}%</div><div class="stat-bar"><div style="width:${disk}%; background:#10b981;"></div></div></div>
                  <div class="stat-col"><div class="stat-label">上传</div><div class="stat-val">${netOutSpeed}/s</div></div>
                  <div class="stat-col"><div class="stat-label">下载</div><div class="stat-val">${netInSpeed}/s</div></div>
                </div>
              </a>
            `;
          }
          contentHtml += `</div>`;
        }
      }

      const html = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${sys.site_title}</title>
        <!-- 世界地图：ECharts + topojson-client -->
        <style>
          /* ── 基础布局 ── */
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f4f5f7; color: #333; margin: 0; padding: 20px; transition: background 0.3s; }
          /* padding-bottom 确保最后一张毛玻璃卡片不会卡在视口底边的合成层边界，缓解残留闪烁 */
          .container { max-width: 1200px; margin: 0 auto; padding-bottom: 60px; }

          /* ── 顶部 Header ── */
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
          .header-left { display: flex; flex-direction: column; }
          /* 标题颜色跟随主题 body 的 color，不硬编码任何颜色 */
          .header-title { margin: 0; font-size: 26px; font-weight: 700; color: inherit; }
          .header-subtitle { font-size: 12px; color: #9ca3af; margin-top: 3px; }
          .header-right { display: flex; gap: 10px; align-items: center; }
          .admin-btn { padding: 8px 16px; background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; box-shadow: 0 2px 8px rgba(59,130,246,0.4); transition: opacity 0.2s, transform 0.1s; }
          .admin-btn:hover { opacity: 0.9; transform: translateY(-1px); }
          /* 壁纸切换按钮 */
          .wallpaper-btn { padding: 8px 12px; background: rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; cursor: pointer; font-size: 16px; line-height: 1; transition: background 0.2s; }
          .wallpaper-btn:hover { background: rgba(0,0,0,0.15); }
          /* 壁纸全屏模式：隐藏所有内容，只保留恢复按钮 */
          body.wallpaper-mode .hideable { display: none !important; }
          .wallpaper-restore { display: none; position: fixed; top: 20px; right: 20px; z-index: 9999; padding: 10px 18px; background: rgba(0,0,0,0.65); color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 14px; backdrop-filter: blur(8px); }
          body.wallpaper-mode .wallpaper-restore { display: block; }

          /* ── 全局统计卡 ── */
          .global-stats { display: flex; flex-wrap: wrap; gap: 0; background: white; border-radius: 16px; box-shadow: 0 2px 16px rgba(0,0,0,0.06); margin-bottom: 24px; overflow: hidden; }
          .g-item { flex: 1; min-width: 180px; padding: 20px 24px; position: relative; }
          .g-item:not(:last-child)::after { content: ''; position: absolute; right: 0; top: 20%; height: 60%; width: 1px; background: #f0f0f0; }
          .g-val { font-size: 22px; font-weight: 700; color: #111; margin: 6px 0; }
          .g-label { font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
          .g-sub { font-size: 12px; color: #9ca3af; margin-top: 2px; }

          /* ── 分组标题 ── */
          .group-header { font-size: 16px; font-weight: 700; color: #374151; margin: 28px 0 14px 2px; padding-left: 12px; border-left: 4px solid #3b82f6; display: flex; align-items: center; gap: 8px; }
          .group-header::after { content: ''; flex: 1; height: 1px; background: linear-gradient(to right, #e5e7eb, transparent); margin-left: 8px; }

          /* ── VPS 卡片 ── */
          .grid-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(480px, 1fr)); gap: 14px; }
          .vps-card { display: flex; justify-content: space-between; align-items: stretch; background: white; padding: 16px 20px; border-radius: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); text-decoration: none; color: inherit; border: 1px solid transparent; transition: all 0.2s ease; }
          .vps-card:hover { border-color: #dbeafe; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(59,130,246,0.1); }
          /* 离线节点视觉降级：灰化+透明，与在线节点一眼区分 */
          .vps-card.offline { opacity: 0.45; filter: grayscale(70%); }
          .vps-card.offline:hover { transform: none; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border-color: transparent; }
          .card-left { flex: 0 0 190px; display: flex; flex-direction: column; justify-content: center; gap: 3px; }
          .card-title { display: flex; align-items: center; margin-bottom: 2px; }
          .card-title-text { font-weight: 600; font-size: 14px; }
          /* 状态点：静态方案，零动画，彻底避免与 backdrop-filter 的合成层冲突 */
          .status-dot { width: 9px; height: 9px; border-radius: 50%; margin-right: 8px; flex-shrink: 0; }
          .status-dot.online { box-shadow: 0 0 0 3px rgba(16,185,129,0.25); }
          .card-meta { font-size: 11px; color: #9ca3af; }
          .card-uptime { font-size: 11px; color: #9ca3af; margin-top: 1px; }
          .card-badges { margin-top: 8px; display: flex; gap: 4px; flex-wrap: wrap; }
          .badge { padding: 2px 7px; border-radius: 5px; font-size: 10px; font-weight: 600; color: white; }
          .badge-bw { background: #3b82f6; } .badge-tf { background: #10b981; } .badge-v4 { background: #a855f7; } .badge-v6 { background: #ec4899; }
          .card-right { flex: 1; display: flex; justify-content: space-between; align-items: center; padding-left: 16px; border-left: 1px solid #f3f4f6; }
          .stat-col { display: flex; flex-direction: column; align-items: center; width: 52px; }
          .stat-label { font-size: 11px; color: #9ca3af; margin-bottom: 6px; }
          .stat-val { font-size: 13px; font-weight: 600; color: #111; margin-bottom: 5px; }
          .stat-bar { width: 100%; height: 3px; background: #e5e7eb; border-radius: 2px; overflow: hidden; }
          .stat-bar > div { height: 100%; background: #3b82f6; border-radius: 2px; transition: width 0.4s ease; }

          /* ── 全球地图模块 ── */
          .world-map-wrap { background: white; border-radius: 16px; box-shadow: 0 2px 16px rgba(0,0,0,0.06); margin-bottom: 24px; overflow: hidden; }
          .map-section-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 22px; cursor: pointer; border-bottom: 1px solid #f3f4f6; transition: background 0.15s; user-select: none; }
          .map-section-header:hover { background: #fafafa; }
          .map-section-title { font-size: 15px; font-weight: 700; color: #374151; display: flex; align-items: center; gap: 8px; }
          .map-section-toggle { font-size: 12px; color: #9ca3af; }
          /* 地图容器：浅灰兜底，ECharts 渲染后会覆盖 */
          #world-map { height: 580px; background: #f1f5f9; }
          /* ECharts tooltip 美化 */
          .ec-tooltip { border-radius: 10px !important; }
          /* 地图缩放控制按钮 */
          .map-zoom-btns { position: absolute; top: 12px; left: 12px; z-index: 10; display: flex; flex-direction: column; gap: 5px; }
          .map-zoom-btn { width: 32px; height: 32px; background: white; border: 1px solid #e2e8f0; border-radius: 7px; cursor: pointer; font-size: 17px; font-weight: 600; line-height: 1; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.1); color: #374151; transition: background 0.15s; }
          .map-zoom-btn:hover { background: #f0f4ff; }
          /* ── 响应式 ── */
          @media (max-width: 600px) {
            .grid-container { grid-template-columns: 1fr; }
            .vps-card { flex-direction: column; }
            .card-right { padding-left: 0; border-left: none; border-top: 1px solid #f3f4f6; margin-top: 14px; padding-top: 14px; }
            .g-item::after { display: none; }
            .header-title { font-size: 20px; }
          }

          ${themeStyles}
        </style>
        <meta http-equiv="refresh" content="60">
      </head>
      <body class="${sys.theme || 'theme1'}">
        <!-- 壁纸模式下的恢复按钮，始终浮在最顶层 -->
        <button class="wallpaper-restore" onclick="toggleWallpaper()">✕ 退出壁纸模式</button>

        <div class="container">
          <!-- Header -->
          <div class="header hideable">
            <div class="header-left">
              <h1 class="header-title">${sys.site_title}</h1>
              <div class="header-subtitle">在线 ${globalOnline} · 离线 ${globalOffline} · 共 ${results.length} 台</div>
            </div>
            <div class="header-right">
              <!-- 壁纸切换按钮：点击后隐藏所有内容，只显示背景图 -->
              <button class="wallpaper-btn" onclick="toggleWallpaper()" title="壁纸全屏预览">🖼️</button>
              <a href="/admin" class="admin-btn">${sys.admin_title}</a>
            </div>
          </div>

          <!-- 全局统计 -->
          <div class="global-stats hideable">
            <div class="g-item">
              <div class="g-label">服务器总数</div>
              <div class="g-val">${results.length}</div>
              <div class="g-sub">在线 <span style="color:#10b981;font-weight:600;">${globalOnline}</span> · 离线 <span style="color:#ef4444;font-weight:600;">${globalOffline}</span></div>
            </div>
            <div class="g-item">
              <div class="g-label">总计流量 (入 | 出)</div>
              <div class="g-val" style="font-size:18px;">${formatBytes(globalNetRx)} <span style="color:#d1d5db;">|</span> ${formatBytes(globalNetTx)}</div>
              <div class="g-sub">累计数据传输</div>
            </div>
            <div class="g-item">
              <div class="g-label">实时网速 (入 | 出)</div>
              <div class="g-val" style="font-size:18px;"><span style="color:#10b981;">↓</span> ${formatBytes(globalSpeedIn)}/s <span style="color:#d1d5db;">|</span> <span style="color:#3b82f6;">↑</span> ${formatBytes(globalSpeedOut)}/s</div>
              <div class="g-sub">当前聚合速率</div>
            </div>
          </div>

          <!-- 全球节点分布地图 -->
          <div class="world-map-wrap hideable" id="map-wrap">
            <div class="map-section-header" onclick="toggleMapSection()">
              <div class="map-section-title">🌍 全球节点分布 <span style="font-size:12px; font-weight:400; color:#9ca3af;">(点亮了 ${Object.keys(vpsMapData).length} 个国家/地区)</span></div>
              <span class="map-section-toggle" id="map-toggle-icon">▲ 收起</span>
            </div>
            <!-- 用 relative 包裹地图和按钮，使按钮能绝对定位在地图上方 -->
            <div style="position:relative;">
              <div id="world-map"></div>
              <!-- 可见的缩放控制按钮，取代纯滚轮操作 -->
              <div class="map-zoom-btns" id="map-zoom-btns">
                <button class="map-zoom-btn" onclick="doMapZoom(1.5)" title="放大">＋</button>
                <button class="map-zoom-btn" onclick="doMapZoom(0.67)" title="缩小">－</button>
                <button class="map-zoom-btn" onclick="doMapReset()" title="重置视图" style="font-size:14px;">⌂</button>
              </div>
            </div>
          </div>

          <!-- VPS 卡片列表 -->
          <div class="hideable" id="server-list">
            ${contentHtml}
          </div>

          ${footerHtml}
        </div>

        <!-- Leaflet JS -->
        <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js" crossorigin=""></script>
        <script src="https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js" crossorigin=""></script>
        <script>
          // ── 壁纸全屏切换 ──
          function toggleWallpaper() {
            document.body.classList.toggle('wallpaper-mode');
          }

          // ── 地图折叠 ──
          var mapVisible = true;
          // myChart 声明在外层作用域，让 doMapZoom/doMapReset 等函数可以访问
          var myChart = null;

          function toggleMapSection() {
            var mapEl   = document.getElementById('world-map');
            var btnsEl  = document.getElementById('map-zoom-btns');
            var icon    = document.getElementById('map-toggle-icon');
            mapVisible = !mapVisible;
            mapEl.style.display   = mapVisible ? 'block' : 'none';
            if (btnsEl) btnsEl.style.display = mapVisible ? 'flex' : 'none';
            icon.textContent = mapVisible ? '▲ 收起' : '▼ 展开';
            // 地图重新展开时通知 ECharts 重新计算尺寸，否则渲染会错乱
            if (mapVisible && myChart) setTimeout(function() { myChart.resize(); }, 50);
          }

          // ── 地图缩放控制 ──
          function doMapZoom(factor) {
            if (!myChart) return;
            var opt = myChart.getOption();
            // 从当前 option 读取 zoom 值，乘以因子后限制在合理范围内
            var cur = (opt.series && opt.series[0] && opt.series[0].zoom) ? opt.series[0].zoom : 1.05;
            var next = Math.max(0.5, Math.min(12, cur * factor));
            myChart.setOption({ series: [{ zoom: next }] });
          }
          function doMapReset() {
            if (!myChart) return;
            var el = document.getElementById('world-map');
            var bounds = calcMapBounds(el.offsetWidth || 900, el.offsetHeight || 580);
            myChart.setOption({ series: [{ boundingCoords: bounds, zoom: 1.05, center: [12, 5] }] });
          }

          // ── 全球节点地图初始化（ECharts SVG 渲染器 + 50m 精度拓扑数据）──
          // ECharts 的 SVG 渲染管线内置路径平滑，边界远比 Leaflet GeoJSON 干净；
          // 50m 数据精度是之前 110m 的 4 倍，爱尔兰、香港等小区域均清晰可辨。

          // ── 动态 boundingCoords 计算 ──
          // 核心思路：根据地图容器的实际宽高比，反推出恰好填满容器且南极海岸线贴近底边的地理范围。
          // 原理：令地理宽高比 = 容器宽高比 → latSpan = 360 * H / W
          // 南边界固定在 -65°S（南极主海岸线约 -63°S~-66°S），北边界 = -65 + latSpan。
          // zoom: 1.05 补偿 ECharts 约 5% 的内部留白，让南极恰好贴底。
          function calcMapBounds(w, h) {
            var latSpan = 360 * h / w;
            var south   = -65;
            var north   = Math.min(south + latSpan, 85);
            return [[-180, north], [180, south]];
          }

          var VPS_DATA = ${mapDataJson};

          // ── 主题感知配色：在 ECharts 初始化前根据当前 body 的主题 class 设置地图颜色 ──
          // 核心思路：让海洋颜色和非 VPS 陆地颜色非常接近，使 50m 数据的海岸线缝隙几乎不可见
          (function() {
            var hasBg  = ${sys.custom_bg ? 'true' : 'false'};
            var tc     = (document.body.className || '').trim();
            var ocean, land, hover;
            if (hasBg) {
              ocean = 'transparent';
              land  = 'rgba(60,80,100,0.55)';
              hover = 'rgba(90,115,145,0.72)';   // 比 land 更亮更不透明，悬停感明显但不突兀
            } else if (tc.indexOf('theme2') >= 0) {
              ocean = '#0d1117';
              land  = '#1e3a58';
              hover = '#2a5280';                  // 更亮的深蓝，与深色背景搭调
            } else if (tc.indexOf('theme5') >= 0) {
              ocean = '#050505';
              land  = '#192840';
              hover = '#1f3f60';
            } else if (tc.indexOf('theme4') >= 0) {
              ocean = 'rgba(40,120,200,0.12)';
              land  = 'rgba(255,255,255,0.50)';
              hover = 'rgba(255,255,255,0.70)';   // 更高不透明度，自然的毛玻璃高亮
            } else {
              ocean = '#d4dce8';
              land  = '#e2e8f0';
              hover = '#c8d5e8';                  // 略深一点，清爽的 hover 反馈
            }
            var el = document.getElementById('world-map');
            if (el) el.style.background = ocean;
            window._mapLand  = land;
            window._mapHover = hover;             // 非 VPS 国家悬停色，替代 ECharts 默认黄色
          })();

          // ISO 3166-1 数字码 → alpha-2 完整映射（修复了爱尔兰 372 等之前遗漏的代码）
          var NUM_TO_CC = {
            '4':'AF','8':'AL','12':'DZ','24':'AO','32':'AR','36':'AU','40':'AT',
            '31':'AZ','50':'BD','56':'BE','64':'BT','68':'BO','70':'BA','76':'BR',
            '96':'BN','100':'BG','116':'KH','120':'CM','124':'CA','144':'LK',
            '152':'CL','156':'CN','170':'CO','191':'HR','196':'CY','203':'CZ',
            '208':'DK','218':'EC','818':'EG','231':'ET','233':'EE','246':'FI',
            '250':'FR','268':'GE','276':'DE','288':'GH','300':'GR','344':'HK',
            '348':'HU','356':'IN','360':'ID','376':'IL','380':'IT','392':'JP',
            '400':'JO','398':'KZ','404':'KE','410':'KR','414':'KW','422':'LB',
            '428':'LV','440':'LT','442':'LU','458':'MY','470':'MT','484':'MX',
            '496':'MN','498':'MD','504':'MA','512':'OM','528':'NL','554':'NZ',
            '566':'NG','578':'NO','586':'PK','600':'PY','604':'PE','608':'PH',
            '616':'PL','620':'PT','634':'QA','642':'RO','643':'RU','682':'SA',
            '688':'RS','702':'SG','703':'SK','705':'SI','710':'ZA','716':'ZW',
            '724':'ES','752':'SE','756':'CH','764':'TH','788':'TN','792':'TR',
            '800':'UG','804':'UA','784':'AE','826':'GB','840':'US','858':'UY',
            '860':'UZ','862':'VE','704':'VN','887':'YE','894':'ZM','446':'MO',
            '158':'TW','51':'AM','112':'BY','499':'ME','807':'MK','352':'IS',
            '372':'IE','408':'KP','630':'PR','760':'SY','364':'IR','368':'IQ',
            '192':'CU','332':'HT','388':'JM','450':'MG','508':'MZ','516':'NA',
            '686':'SN','706':'SO','729':'SD','854':'BF','466':'ML','591':'PA',
            '418':'LA','104':'MM','524':'NP','417':'KG','762':'TJ','795':'TM'
          };

          if (typeof echarts === 'undefined' || typeof topojson === 'undefined') {
            var mapEl = document.getElementById('world-map');
            if (mapEl) {
              mapEl.style.cssText = 'display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:14px;';
              mapEl.innerHTML = '⚠️ 地图库加载失败，请刷新页面重试';
            }
          } else {
            // 赋值给外层 myChart（已在 toggleMapSection/doMapZoom 之前声明为 null）
            myChart = echarts.init(document.getElementById('world-map'), null, { renderer: 'svg' });
            myChart.showLoading({ text: '正在加载地图数据…', color: '#10b981', textColor: '#64748b', maskColor: 'rgba(241,245,249,0.85)' });

            // 50m 精度拓扑数据（~200KB），比 110m 精细 4 倍，小国边界清晰
            fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json')
              .then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
              })
              .then(function(world) {
                var geoJSON = topojson.feature(world, world.objects.countries);

                // ── 反子午线（Antimeridian）修复 ──
                // 简化版算法：不对第一个坐标做任何初始归一化，只处理相邻两点之间经度差超过
                // ±180° 的"大跳跃"（这才是真正的反子午线越线信号）。
                // 之前的版本对第一个点做强制归一化，导致南极洲环绕型多边形（经度覆盖全周）
                // 的后续点全部错乱，渲染成横贯底部的黄色色带。
                (function fixAntimeridian(gj) {
                  function fixRing(ring) {
                    for (var i = 1; i < ring.length; i++) {
                      var diff = ring[i][0] - ring[i-1][0];
                      if      (diff >  180) ring[i][0] -= 360; // 向西越过反子午线
                      else if (diff < -180) ring[i][0] += 360; // 向东越过反子午线
                    }
                  }
                  gj.features.forEach(function(f) {
                    if (!f.geometry) return;
                    var t = f.geometry.type, c = f.geometry.coordinates;
                    if      (t === 'Polygon')      c.forEach(fixRing);
                    else if (t === 'MultiPolygon') c.forEach(function(p) { p.forEach(fixRing); });
                  });
                })(geoJSON);

                // 将每个 feature 的 name 属性设为 ISO alpha-2 代码，供 ECharts 匹配数据项
                geoJSON.features.forEach(function(f) {
                  f.properties = f.properties || {};
                  var alpha2 = NUM_TO_CC[String(f.id)];
                  f.properties.name = alpha2 || ('_' + f.id); // 无映射的用 _数字ID 占位
                });

                echarts.registerMap('world_custom', geoJSON);
                myChart.hideLoading();

                // 为有 VPS 的国家构建数据项，每项独立指定颜色
                var mapData = [];
                Object.keys(VPS_DATA).forEach(function(cc) {
                  var d = VPS_DATA[cc];
                  var isGreen = d.online > 0;
                  mapData.push({
                    name: cc,
                    value: d.online,
                    total: d.count,
                    online: d.online,
                    servers: d.servers,
                    itemStyle: {
                      areaColor: isGreen ? '#10b981' : '#f59e0b',
                      borderColor: isGreen ? '#059669' : '#d97706',
                      borderWidth: 0.8,
                      opacity: 0.9
                    },
                    emphasis: {
                      itemStyle: {
                        areaColor: isGreen ? '#059669' : '#d97706',
                        borderWidth: 1.2,
                        opacity: 1
                      }
                    }
                  });
                });

                // 根据当前容器实际尺寸动态计算最佳地理范围
                var _el = document.getElementById('world-map');
                var _bounds = calcMapBounds(_el.offsetWidth || 900, _el.offsetHeight || 580);

                myChart.setOption({
                  animation: false,       // 关闭 ECharts 初始渲染动画，减少合成层更新
                  backgroundColor: 'transparent',
                  tooltip: {
                    trigger: 'item',
                    confine: true,
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderWidth: 1,
                    padding: [10, 14],
                    textStyle: { color: '#374151', fontSize: 13 },
                    formatter: function(params) {
                      if (!params.data || params.data.total === undefined) return null;
                      var d = params.data;
                      var cc = params.name;
                      var flagImg = '<img src="https://flagcdn.com/' + cc.toLowerCase() + '.svg" height="13" style="width:auto;vertical-align:middle;margin-right:5px;border-radius:2px;">';
                      var onlineSp  = '<span style="color:#10b981;font-weight:600;">● ' + d.online + ' 在线</span>';
                      var offlineSp = (d.total - d.online) > 0
                        ? ' &nbsp;<span style="color:#ef4444;font-weight:600;">● ' + (d.total - d.online) + ' 离线</span>' : '';
                      var list = d.servers.join('<br>&nbsp;&nbsp;· ');
                      return '<div style="min-width:140px;">'
                        + '<b style="font-size:14px;">' + flagImg + cc + '</b>'
                        + '<div style="color:#9ca3af;font-size:12px;margin:2px 0 6px;">共 ' + d.total + ' 台节点</div>'
                        + '<div>' + onlineSp + offlineSp + '</div>'
                        + '<div style="margin-top:6px;padding-top:6px;border-top:1px solid #f3f4f6;font-size:12px;color:#374151;">&nbsp;&nbsp;· ' + list + '</div>'
                        + '</div>';
                    }
                  },
                  series: [{
                    name: '节点分布',
                    type: 'map',
                    map: 'world_custom',
                    roam: true,
                    // 使用动态计算的 boundingCoords（根据实际容器尺寸）
                    boundingCoords: _bounds,
                    zoom: 1.05,
                    // center 把地理显示中心设在 12°E（大西洋/非洲/欧洲附近）
                    // 东半球陆地质量更重，以 12°E 为中心能让两侧视觉均衡，消除偏右感
                    center: [12, 5],
                    scaleLimit: { min: 0.85, max: 12 },
                    nameProperty: 'name',
                    data: mapData,
                    // 无 VPS 国家的默认样式
                    // borderColor 与 areaColor 相同 + borderWidth:0，彻底消除非 VPS 国家之间的边界线
                    // 同时让海岸线缝隙（ocean 与 land 颜色相近）几乎不可见
                    itemStyle: {
                      areaColor: window._mapLand || '#e2e8f0',
                      borderColor: window._mapLand || '#e2e8f0',
                      borderWidth: 0
                    },
                    emphasis: {
                      label: { show: false },
                      itemStyle: {
                        areaColor: window._mapHover || '#c8d5e8',  // 柔和高亮，不再使用 ECharts 默认黄色
                        borderWidth: 0,
                        borderColor: window._mapHover || '#c8d5e8'
                      }
                    },
                    select: { disabled: true }
                  }]
                });

                window.addEventListener('resize', function() {
                  myChart.resize();
                  // 窗口尺寸变化时重新计算 boundingCoords，保持精确填充
                  var el2 = document.getElementById('world-map');
                  var newBounds = calcMapBounds(el2.offsetWidth || 900, el2.offsetHeight || 580);
                  myChart.setOption({ series: [{ boundingCoords: newBounds }] });
                });
              })
              .catch(function(err) {
                myChart.hideLoading();
                var mapEl = document.getElementById('world-map');
                if (mapEl) {
                  mapEl.style.cssText = 'display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:14px;';
                  mapEl.innerHTML = '⚠️ 地图数据加载失败，请检查网络后刷新';
                }
              });
          }
        </script>
      </body>
      </html>`;

      return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=30' } });
    }

    return new Response('Not Found', { status: 404 });
  }
};
