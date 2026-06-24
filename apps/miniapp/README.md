# EasyShift 微信小程序

v1 员工端：绑定身份 + 查看已发布个人班表。

## 技术栈

| 项目 | 选型 |
|------|------|
| 框架 | 微信原生小程序 |
| 语言 | TypeScript |
| UI 组件库 | [TDesign Miniprogram](https://tdesign.tencent.com/miniprogram) |
| 主题 | 适配系统深色模式（跟随微信 / 系统主题） |

完整说明见 [docs/TECH_STACK.md](../../docs/TECH_STACK.md) §3.2。

## 本地开发

### 1. 安装依赖

在仓库根目录执行（推荐）：

```bash
pnpm miniapp:install
```

该脚本会进入 `apps/miniapp` 后执行 `pnpm install`，并读取本目录的 `.npmrc`，让微信开发者工具更稳定地构建 npm。

### 2. 微信开发者工具

1. 打开本目录（`apps/miniapp`）
2. 填写小程序 AppID（测试号亦可）
3. **详情 → 本地设置**：勾选「不校验合法域名、web-view、TLS 版本」
4. **工具 → 构建 npm**（安装 TDesign 后必须执行）
5. 将 `config/dev.ts` 中的 `apiBaseUrl` 指向 `http://localhost:3000/api/v1`

### 3. 项目配置文件

- `project.config.json` 是仓库共享配置，必须保留并提交；不要写入个人测试号 AppID 或微信开发者工具生成的本机设置。
- `project.private.config.json` 用于本机配置（如真实 AppID、个人开发者工具设置），已被 `.gitignore` 忽略，不应提交。

### 4. 深色模式调试

1. 确保 `app.json` 已配置 `"darkmode": true`
2. 在模拟器顶部切换「深色 / 浅色」预览
3. 发版前在真机（系统或微信开启深色模式）验收绑定页与班表页

### 5. 联调流程

Web 端为员工生成绑定码 → 小程序输入绑定码 + 手机号后四位 → 查看班表。

本地调试微信 `code2session` 时，API 可配置 `WX_MOCK=true` 使用假 openid（仅 development）。

## 主题与样式约定

- 在 `app.wxss` 引入 TDesign 主题：

  ```css
  @import 'miniprogram_npm/tdesign-miniprogram/common/style/theme/_index.wxss';
  ```

- 自定义样式使用 TDesign Design Token（如 `--td-bg-color-page`），不要硬编码浅色背景色
- 原生导航栏 / tabBar 颜色在 `theme.json` 中分别定义 `light` 与 `dark` 变量

## 参考文档

- [TDesign 小程序组件](https://tdesign.tencent.com/miniprogram/components/button)
- [TDesign 深色模式](https://tdesign.tencent.com/miniprogram/dark-mode)
- [微信 DarkMode 适配指南](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/darkmode.html)
