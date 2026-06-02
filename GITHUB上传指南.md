# GitHub 上传指南

## 📋 前提条件

1. ✅ 已安装 Git
2. ✅ 拥有 GitHub 账号
3. ✅ 已配置 Git 用户信息

如果还没有配置 Git，运行：
```bash
git config --global user.name "你的用户名"
git config --global user.email "你的邮箱"
```

---

## 🚀 上传步骤

### 方法一：通过GitHub网站创建仓库（推荐）

#### 第1步：在GitHub创建新仓库

1. 登录 [GitHub](https://github.com)
2. 点击右上角的 `+` 号，选择 `New repository`
3. 填写仓库信息：
   - **Repository name**: `industry-monitor-V1`（或你喜欢的名字）
   - **Description**: `产业监测微信小程序 - 基于微信云开发`
   - **Public/Private**: 选择 `Public`（公开）或 `Private`（私有）
   - ⚠️ **不要勾选** "Initialize this repository with a README"（因为本地已有）
4. 点击 `Create repository`

#### 第2步：在本地项目添加远程仓库

复制GitHub显示的仓库URL（例如：`https://github.com/你的用户名/industry-monitor-V1.git`）

然后在终端执行：

```bash
# 进入项目目录
cd "c:\Users\Desktop\新杂项\industry-monitor-V1"

# 添加远程仓库（替换成你的仓库地址）
git remote add origin https://github.com/你的用户名/industry-monitor-V1.git

# 查看远程仓库是否添加成功
git remote -v
```

#### 第3步：提交本地更改

```bash
# 查看当前状态
git status

# 添加所有文件到暂存区
git add .

# 提交更改（附带提交信息）
git commit -m "docs: 初始化项目，添加README和功能截图"
```

#### 第4步：推送到GitHub

```bash
# 推送到GitHub（首次推送需要 -u 参数）
git push -u origin master
```

如果你的GitHub默认分支是 `main` 而不是 `master`，可以先重命名分支：

```bash
# 重命名本地分支
git branch -M main

# 推送到main分支
git push -u origin main
```

#### 第5步：验证

- 在浏览器打开你的GitHub仓库页面
- 检查文件是否都已上传
- 查看README是否正确显示（包括截图）

---

### 方法二：使用GitHub Desktop（图形界面）

#### 第1步：下载并安装GitHub Desktop

- 下载地址：https://desktop.github.com/
- 安装并登录你的GitHub账号

#### 第2步：添加本地仓库

1. 打开GitHub Desktop
2. 点击 `File` -> `Add local repository`
3. 选择你的项目目录：`c:\Users\Desktop\新杂项\industry-monitor-V1`
4. 点击 `Add repository`

#### 第3步：发布到GitHub

1. 在GitHub Desktop中，点击 `Publish repository`
2. 填写仓库名称和描述
3. 选择是否公开（Public）
4. 点击 `Publish repository`

#### 第4步：提交更改

1. 在左侧看到所有更改的文件
2. 勾选要提交的文件（或全选）
3. 在左下角填写提交信息：`docs: 初始化项目，添加README和功能截图`
4. 点击 `Commit to master`
5. 点击右上角的 `Push origin`

---

## 🔧 常见问题

### Q1: 推送时提示需要身份验证

**解决方案A：使用Personal Access Token（推荐）**

1. 登录GitHub，进入 Settings -> Developer settings -> Personal access tokens -> Tokens (classic)
2. 点击 `Generate new token` -> `Generate new token (classic)`
3. 设置权限：勾选 `repo`（完整控制）
4. 生成后复制Token（只显示一次！）
5. 推送时，用户名填GitHub用户名，密码填这个Token

**解决方案B：使用SSH密钥**

```bash
# 生成SSH密钥
ssh-keygen -t ed25519 -C "your-email@example.com"

# 查看公钥
cat ~/.ssh/id_ed25519.pub

# 复制公钥内容，添加到GitHub: Settings -> SSH and GPG keys -> New SSH key
```

然后更换远程仓库地址为SSH格式：

```bash
git remote set-url origin git@github.com:你的用户名/industry-monitor-V1.git
```

### Q2: 文件太大无法推送

如果截图文件过大，可以压缩或使用Git LFS：

```bash
# 安装Git LFS
git lfs install

# 追踪大文件
git lfs track "screenshots/*.png"

# 提交.gitattributes
git add .gitattributes
git commit -m "chore: 配置Git LFS"
```

### Q3: 推送被拒绝（rejected）

如果远程仓库有你本地没有的提交：

```bash
# 先拉取远程更改
git pull origin master --allow-unrelated-histories

# 解决冲突（如果有）
# 然后再推送
git push origin master
```

### Q4: 想要忽略某些文件

检查或编辑 `.gitignore` 文件：

```bash
# 查看当前.gitignore
cat .gitignore

# 常见需要忽略的文件
node_modules/
.DS_Store
*.log
project.private.config.json
```

---

## 📝 提交信息规范（建议）

使用语义化提交信息：

- `feat:` 新功能
- `fix:` 修复bug
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 重构代码
- `test:` 测试相关
- `chore:` 构建/工具相关

示例：
```bash
git commit -m "feat: 添加产业数据导出功能"
git commit -m "fix: 修复登录页面授权失败问题"
git commit -m "docs: 更新README截图"
```

---

## 🎯 后续更新流程

当你修改了代码后，使用以下命令更新到GitHub：

```bash
# 1. 查看修改了什么
git status

# 2. 添加修改的文件
git add .

# 3. 提交更改
git commit -m "描述你的更改"

# 4. 推送到GitHub
git push origin master
# 或
git push origin main
```

---

## 📚 更多资源

- [Git官方文档](https://git-scm.com/doc)
- [GitHub官方指南](https://guides.github.com/)
- [GitHub Desktop使用指南](https://docs.github.com/en/desktop)

---

## ✅ 上传检查清单

上传完成后，检查以下内容：

- [ ] 所有文件都已上传到GitHub
- [ ] README.md正确显示（包括格式和图片）
- [ ] 截图都能正常显示
- [ ] 项目描述清晰
- [ ] LICENSE文件存在
- [ ] .gitignore配置正确（没有上传敏感信息）

---

祝你上传顺利！🎉
