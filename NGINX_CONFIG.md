# Nginx配置指南 - 解决504超时错误

## 问题说明

当使用Nginx作为反向代理时，如果后端API响应时间超过Nginx默认超时设置（通常是60秒），会导致**504 Gateway Timeout**错误。

人生K线的AI分析通常需要3-5分钟，因此必须增加Nginx的超时配置。

---

## 解决方案

### 1. 修改Nginx配置文件

找到你的Nginx配置文件（通常在以下位置之一）：
- `/etc/nginx/nginx.conf`
- `/etc/nginx/sites-available/your-site`
- `/etc/nginx/conf.d/your-site.conf`

### 2. 在`location`块中添加以下配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 其他配置...

    location / {
        # 反向代理到Node.js后端
        proxy_pass http://localhost:3000;

        # 增加超时时间（重要！）
        proxy_connect_timeout 600s;      # 连接超时：10分钟
        proxy_send_timeout 600s;         # 发送超时：10分钟
        proxy_read_timeout 600s;         # 读取超时：10分钟
        send_timeout 600s;               # 发送响应超时：10分钟

        # 禁用缓冲，支持SSE流式响应（重要！）
        proxy_buffering off;
        proxy_cache off;

        # 保持HTTP头信息
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE必需配置
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding on;
    }

    # 专门为流式API配置（可选，但推荐）
    location /api/analyze-stream {
        proxy_pass http://localhost:3000;

        # 更长的超时时间
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;

        # SSE必需配置
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding on;

        # 传递客户端信息
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. 全局超时配置（可选）

如果希望全局设置，可以在`http`块中添加：

```nginx
http {
    # 其他配置...

    # 全局超时设置
    proxy_connect_timeout 600s;
    proxy_send_timeout 600s;
    proxy_read_timeout 600s;
    send_timeout 600s;

    # 全局禁用缓冲（支持SSE）
    proxy_buffering off;

    # 其他配置...
}
```

---

## 4. 测试并重载Nginx

```bash
# 测试配置是否正确
sudo nginx -t

# 如果测试通过，重载配置
sudo nginx -s reload

# 或者重启Nginx服务
sudo systemctl restart nginx
```

---

## 5. 验证修复

访问你的网站并提交一次分析请求，观察：
1. 应该能看到实时进度消息（"正在连接服务器..."、"使用模型 xxx"等）
2. 不会再出现504错误
3. 请求可以持续3-5分钟直到完成

---

## 如果使用其他反向代理

### Apache配置

在`.htaccess`或虚拟主机配置中添加：

```apache
ProxyTimeout 600
ProxyPass /api/analyze-stream http://localhost:3000/api/analyze-stream disablereuse=on
ProxyPassReverse /api/analyze-stream http://localhost:3000/api/analyze-stream
```

### Caddy配置

```caddyfile
your-domain.com {
    reverse_proxy localhost:3000 {
        timeout 600s
        flush_interval -1
    }
}
```

---

## 常见问题

### Q1: 仍然出现504错误怎么办？

检查以下几点：
1. 确认Nginx配置已正确重载（`sudo nginx -s reload`）
2. 检查是否还有其他反向代理层（如Cloudflare、CDN）
3. 查看Nginx错误日志：`sudo tail -f /var/log/nginx/error.log`
4. 确认Node.js后端正在运行且监听3000端口

### Q2: Cloudflare用户怎么办？

如果使用Cloudflare，需要在Cloudflare仪表板中：
1. 进入"网络"设置
2. 将"代理超时"设置为最大值（Enterprise计划）
3. 或者考虑将API请求的子域名设置为"仅DNS"模式（绕过Cloudflare代理）

### Q3: 如何查看当前Nginx超时设置？

```bash
# 查看当前配置
nginx -T | grep timeout

# 或查看配置文件
cat /etc/nginx/nginx.conf | grep timeout
```

---

## 服务端超时配置

本应用的服务端已经设置了以下超时：
- `/api/analyze-stream`：使用SSE流式响应，无固定超时
- `/api/analyze`（旧版）：180秒（3分钟）超时

建议使用新的`/api/analyze-stream`端点以获得最佳用户体验。

---

## 相关文件

- 服务端流式处理：`server/analyzeStream.js`
- 前端流式客户端：`services/geminiService.ts`
- 主应用组件：`App.tsx`
- 表单组件：`components/BaziForm.tsx`

---

## 技术支持

如果按照以上步骤仍无法解决问题，请：
1. 检查服务器错误日志
2. 确认防火墙设置
3. 联系技术支持并提供详细错误信息
