/**
 * assignUserId — 分配唯一用户序号（v3 · 种子先行）
 *
 * 依赖数据库集合（需在云开发控制台手动创建）：
 *   counters    — 计数器，文档 _id='user_id_seq'，字段 seq(数字)
 *   user_id_map — openId↔userId 映射
 *
 * 格式：NJ + 6位数字（NJ000001 ~ NJ999999）
 * 按首次调用顺序递增，同一 openId 幂等返回
 *
 * 种子策略：直接 try-add 种子文档（errCode=-1=已存在则跳过），
 * 不依赖 get() 返回的 "document not found" 错误码。
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const COUNTER_ID = 'user_id_seq'
const PREFIX = 'NJ'
const PAD_LEN = 6
const MAX_SEQ = 999999

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { success: false, error: '无法获取 openId' }
  }

  const userMapColl = db.collection('user_id_map')
  const countersColl = db.collection('counters')

  // ── 1. 幂等检查 ──
  try {
    const existing = await userMapColl.where({ openId: OPENID }).limit(1).get()
    if (existing.data.length > 0) {
      return { success: true, userId: existing.data[0].userId, isNew: false }
    }
  } catch (e) {
    if (e.errCode === -502005) {
      return { success: false, error: '集合 user_id_map 不存在，请在云开发控制台手动创建' }
    }
    return { success: false, error: '查询失败: ' + (e.errMsg || e.message || '') }
  }

  // ── 2. 确保种子文档存在 ──
  try {
    await countersColl.add({
      data: { _id: COUNTER_ID, seq: 0, createdAt: new Date(), updatedAt: new Date() }
    })
  } catch (e) {
    // -1 = _id 冲突，文档已存在（正常情况，由之前调用创建）
    if (e.errCode === -1) {
      // 已存在，跳过
    } else if (e.errCode === -502005) {
      return { success: false, error: '集合 counters 不存在，请在云开发控制台手动创建' }
    } else {
      return { success: false, error: '初始化计数器失败: ' + (e.errMsg || e.message || '') }
    }
  }

  // ── 3. 原子自增 ──
  try {
    await countersColl.doc(COUNTER_ID).update({
      data: { seq: _.inc(1), updatedAt: new Date() }
    })
  } catch (e) {
    // 理论上不会失败（种子已确保存在）
    if (e.errCode === -502005) {
      return { success: false, error: '集合 counters 不存在，请在云开发控制台手动创建' }
    }
    return { success: false, error: '自增失败: ' + (e.errMsg || e.message || '') }
  }

  // ── 4. 读取最新 seq ──
  let latest
  try {
    latest = await countersColl.doc(COUNTER_ID).get()
  } catch (e) {
    return { success: false, error: '读取计数器失败: ' + (e.errMsg || e.message || '') }
  }
  const seq = latest.data.seq

  if (seq > MAX_SEQ) {
    return { success: false, error: '用户ID已用尽（超过 NJ999999）' }
  }

  const userId = PREFIX + String(seq).padStart(PAD_LEN, '0')

  // ── 5. 写入映射 ──
  try {
    await userMapColl.add({
      data: { openId: OPENID, userId, seq, createdAt: new Date() }
    })
  } catch (e) {
    if (e.errCode === -502005) {
      return { success: false, error: '集合 user_id_map 不存在，请在云开发控制台手动创建' }
    }
    return { success: false, error: '写入映射失败: ' + (e.errMsg || e.message || '') }
  }

  return { success: true, userId, seq, isNew: true }
}
