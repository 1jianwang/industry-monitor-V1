// 云函数：getUserRole - 获取用户角色
// 业务逻辑：
// 1. 通过微信云开发自动获取用户 openid
// 2. 查询 users 集合匹配用户记录
// 3. 找到则返回 role（admin/viewer），未找到则创建新用户，role 默认 viewer
// 4. 更新 lastLoginAt 为当前时间

const cloud = require('wx-server-sdk');

cloud.init();

// 数据库引用
const db = cloud.database();
const _ = db.command;

// 云函数入口
exports.main = async (event, context) => {
  try {
    // ==========================================
    // 第一步：获取用户 openid
    // ==========================================
    // 云函数中可通过 wxContext 自动获取用户 openid
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    // 检查 openid 是否有效
    if (!openid) {
      return {
        success: false,
        error: '无法获取用户身份，请确保在小程序中调用'
      };
    }

    // ==========================================
    // 第二步：查询数据库匹配用户记录
    // ==========================================
    const userRes = await db.collection('users').where({
      openid: openid
    }).get();

    if (!userRes || !userRes.data || userRes.data.length === 0) {
      // 用户不存在，创建新用户，默认角色为 viewer（查阅者）
      const newUser = {
        openid: openid,
        role: 'viewer',  // 默认角色：查阅者（只能浏览，不能上传/删除）
        createdAt: db.serverDate(),
        lastLoginAt: db.serverDate()
      };

      await db.collection('users').add({
        data: newUser
      });

      // 返回新创建的用户信息
      return {
        success: true,
        data: {
          openid: openid,
          role: 'viewer',
          createdAt: new Date(),
          lastLoginAt: new Date()
        }
      };
    }

    // ==========================================
    // 第三步：处理用户记录
    // ==========================================
    // 用户已存在，更新最后登录时间
    const existingUser = userRes.data[0];

    if (!existingUser.role) {
      return {
        success: false,
        error: '用户角色未配置，请联系管理员'
      };
    }

    await db.collection('users').where({
      openid: openid
    }).update({
      data: {
        lastLoginAt: db.serverDate()
      }
    });

    // 返回用户信息（包括 role）
    return {
      success: true,
      data: {
        openid: existingUser.openid,
        role: existingUser.role,
        createdAt: existingUser.createdAt,
        lastLoginAt: new Date()
      }
    };

  } catch (err) {
    // 错误处理
    console.error('getUserRole 云函数错误：', err);
    return {
      success: false,
      error: err.message || '服务器错误'
    };
  }
};