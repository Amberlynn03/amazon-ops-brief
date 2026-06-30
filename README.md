# Amazon Ops Brief

每日亚马逊政策、卖家讨论和实战案例的本地情报网站。

## 本地运行

```powershell
python -m http.server 8765 --directory "D:\Codex\Project\amazon-intelligence-daily"
```

访问 `http://localhost:8765`。

## 数据更新

每日内容存储在 `data/digests.json`。每个日期包含：

- `items`：政策、讨论和案例
- `actions`：当日行动清单
- `source`：原文链接
- `tags`：历史检索标签

新日期记录插入数组顶部，网站会自动按日期排序并默认显示最新一天。
