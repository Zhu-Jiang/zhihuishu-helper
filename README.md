# 智慧树讨论区自动发帖助手

一个油猴脚本合集，用于在智慧树课程讨论区自动发帖（提问 / 回答），内容由 AI 生成。

> ⚠️ **仅供个人学习研究使用。** 请勿用于刷分、作弊等违规行为。使用本脚本产生的任何后果由使用者自负。

---

## 功能概览

| 场景 | 触发方式 | 行为 |
|------|----------|------|
| **发提问**（列表页） | 手动点击右下角蓝色小笔 | 脚本检测到提问弹窗打开后，自动生成问题、填入、发布 |
| **发回答**（详情页） | 按 `Alt+X` | 脚本自动点击"我来回答"、生成答案、填入、发布，发布成功后自动关闭页面 |

---

## 文件说明

本仓库提供三个 `.user.js` 脚本文件，功能完全相同，区别只在于 **API 配置是否已经填好**：

| 文件名 | 说明 | 适用场景 |
|--------|------|----------|
| `zhihuishu-agnes-configured.user.js` | **已配置 Agnes API Key**，开箱即用 | 自己用，懒人首选 |
| `zhihuishu-agnes-blank.user.js` | **Agnes 版本，API Key 留空**，需自己填写 | 分享给别人 / 换 Key |
| `zhihuishu-deepseek-blank.user.js` | **DeepSeek 版本，API Key 留空**，需自己填写 | 想用 DeepSeek 后端 |

> 💡 **注意**：`zhihuishu-agnes-configured.user.js` 里包含了我自己的 API Key，请勿公开传播。其他两个脚本则安全得多，适合分享或上传到公开仓库。

---

## 安装

1. 先安装 [Tampermonkey](https://www.tampermonkey.net/)（或 Violentmonkey）浏览器扩展。
2. 打开本仓库的 `.user.js` 文件，点击右上角的 **Raw** 按钮。
3. Tampermonkey 会自动弹出安装界面，点击 **安装** 即可。

---

## 使用前配置

如果使用的是 **blank 版本**（API Key 留空的），需要自己填 Key：

1. 打开 Tampermonkey 面板，找到刚才安装的脚本，点击 **编辑**。
2. 找到代码最顶部的这一行：
   ```javascript
   const API_KEY = '';

---

## 推荐

1. 刷课：https://github.com/VermiIIi0n/fuckZHS
2. 答题：https://docs.ocsjs.com/
(答题需要搭配题库使用,可以自己使用AI构建题库的配置,有不会的就问AI哦)
3. 习惯：靠你自己啦
