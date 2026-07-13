# Web Nav

个人网址导航，使用 React、Tailwind CSS、Radix UI、Supabase 和 Vercel。

## 功能

- Google、Bing、百度、Perplexity AI 搜索入口
- GitHub OAuth 登录，登录后每个人管理自己的导航
- 最近常用链接按点击次数自动排序
- 分类和链接都支持新增、编辑、删除
- 链接自动展示 favicon
- 响应式布局，适配手机和桌面
- 登录后使用 Drop，在设备间同步消息与文件

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Supabase 配置

1. 在 Supabase SQL Editor 执行 [supabase/schema.sql](./supabase/schema.sql)。
2. 在 Authentication Providers 中启用 GitHub。
3. GitHub OAuth App 的 callback URL 填 Supabase 提供的回调地址。
4. Supabase Auth URL Configuration 添加本地地址和 Vercel 域名。

### Drop 文件与自动清理

已有项目在 Supabase SQL Editor 执行 `supabase/drop.sql`；新项目直接执行完整的 `supabase/schema.sql`。这会创建 `drop_items`、私有 `drop-files` bucket、用户隔离策略和实时同步。Vercel 还需要配置以下仅服务端可用的环境变量：

```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CRON_SECRET=your_random_long_secret
```

`vercel.json` 已配置每天执行 `/api/drop-cleanup`。清理任务会先通过 Storage API 永久删除过期文件，成功后再删除数据库记录；失败的批次会保留记录并在下一次任务重试。`SUPABASE_SERVICE_ROLE_KEY` 绝不能添加 `VITE_` 前缀或暴露给浏览器。

用户密码不在本应用内保存；登录由 GitHub OAuth 负责。账号设置里可配置显示用户名和密码提示。

## Vercel 部署

1. 导入 GitHub 仓库。
2. 添加 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 环境变量。
3. 部署后把 Vercel 域名加入 Supabase Auth 的允许跳转地址。

构建命令为 `npm run build`，输出目录为 `dist`。
