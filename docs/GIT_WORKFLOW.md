# Git 提交与分支合并规范

| 项目 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 适用范围 | EasyShift 日常提交、PR、合并、分支清理 |

---

## 1. 核心原则

- 先确认状态，再执行 Git 操作。
- 不使用 `git add .`，只暂存明确文件。
- PR 合并前不删除远程分支。
- 删除分支前必须确认对应提交已经进入 `main`。
- 出现 warning / error 时先停下来判断，不继续执行清理命令。

---

## 2. 提交前检查

每次提交前先运行：

```powershell
git status --short --branch
git diff
git log --oneline -5
```

暂存文件时使用明确路径：

```powershell
git add "path/to/file1" "path/to/file2"
```

不要使用：

```powershell
git add .
```

提交前确认已暂存内容：

```powershell
git diff --cached --name-only
git diff --cached --stat
```

检查重点：

- 是否只包含本次任务相关文件
- 是否误加 `.env`、凭据、测试产物、缓存文件
- 是否把文档和代码按计划拆分

---

## 3. 分支与 PR

分支命名建议：

```text
feat/<topic>
fix/<topic>
docs/<topic>
test/<topic>
```

PR 拆分建议：

- 每个 PR 只解决一个清晰主题。
- 若存在依赖关系，使用堆叠 PR。
- 例如：`feat/shift-kind-docs` 依赖 `feat/shift-kind-code`，必须先合并 code PR，再合并 docs PR。

推送分支：

```powershell
git push -u origin <branch>
```

---

## 4. PR 合并后确认

合并 PR 后，本地同步：

```powershell
git switch main
git pull
```

确认目标提交已经进入 `main`：

```powershell
git log --oneline -5
git merge-base --is-ancestor <commit> main
```

在 PowerShell 中可用：

```powershell
git merge-base --is-ancestor <commit> main
if ($LASTEXITCODE -eq 0) {
  "commit_on_main=yes"
} else {
  "commit_on_main=no"
}
```

注意：`git pull` 输出 `Already up to date` 不等于 PR 已合并。必须在 `main` 日志里看到目标提交或 merge commit。

---

## 5. 删除分支

删除前确认分支状态：

```powershell
git status --short --branch
git branch -vv
git branch -r
```

只有在目标提交已经进入 `main` 后，才删除分支。

删除本地分支：

```powershell
git branch -d <branch>
```

删除远程分支：

```powershell
git push origin --delete <branch>
```

如果删除时报：

```text
error: cannot delete branch '<branch>' used by worktree
```

说明当前正在该分支上。先切回 `main`：

```powershell
git switch main
```

再删除。

如果删除时出现：

```text
warning: deleting branch '<branch>' that has been merged to ...
but not yet merged to HEAD
```

先停止操作。该 warning 表示分支可能还没有进入当前 `main`，需要先确认：

```powershell
git merge-base --is-ancestor <commit> main
```

---

## 6. 恢复误删分支

如果分支或远程分支删早了，先不要重新改代码。

查找提交：

```powershell
git reflog --all
git branch -a
git cat-file -t <commit>
```

从提交恢复本地分支：

```powershell
git checkout -b <branch> <commit>
```

或在不切换分支的情况下创建：

```powershell
git branch <branch> <commit>
```

重新推送远程：

```powershell
git push -u origin <branch>
```

恢复后重新开 PR，并按正常顺序合并。

---

## 7. 推荐完整流程

```powershell
# 1. 开发完成后检查
git status --short --branch
git diff

# 2. 精确暂存
git add "path/to/file"
git diff --cached --name-only
git diff --cached --stat

# 3. 提交并推送
git commit -m "type(scope): summary"
git push -u origin <branch>

# 4. GitHub 合并 PR 后同步 main
git switch main
git pull
git log --oneline -5

# 5. 确认提交已进入 main 后清理
git branch -d <branch>
git push origin --delete <branch>
```
