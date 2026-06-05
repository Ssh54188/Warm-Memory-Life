/**
 * 本地存储封装
 * 统一处理读写异常 + 存储空间检测
 */
const STORAGE_PREFIX = 'wps_'

/**
 * 读取存储
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
function get(key, defaultValue = null) {
  try {
    const data = wx.getStorageSync(STORAGE_PREFIX + key)
    return data !== '' ? data : defaultValue
  } catch (e) {
    console.warn(`[Storage] 读取失败: ${key}`, e)
    return defaultValue
  }
}

/**
 * 写入存储
 * @param {string} key
 * @param {*} value
 * @returns {boolean}
 */
function set(key, value) {
  try {
    wx.setStorageSync(STORAGE_PREFIX + key, value)
    return true
  } catch (e) {
    console.error(`[Storage] 写入失败: ${key}`, e)
    return false
  }
}

/**
 * 删除存储
 * @param {string} key
 * @returns {boolean}
 */
function remove(key) {
  try {
    wx.removeStorageSync(STORAGE_PREFIX + key)
    return true
  } catch (e) {
    console.warn(`[Storage] 删除失败: ${key}`, e)
    return false
  }
}

/**
 * 清空所有本应用数据
 * @returns {boolean}
 */
function clearAll() {
  try {
    const info = wx.getStorageInfoSync()
    const keys = info.keys.filter(k => k.startsWith(STORAGE_PREFIX))
    keys.forEach(k => wx.removeStorageSync(k))
    return true
  } catch (e) {
    console.error('[Storage] 清空失败', e)
    return false
  }
}

/**
 * 获取存储使用信息
 * @returns {{ keys: number, size: number, limit: number }}
 */
function getInfo() {
  try {
    const info = wx.getStorageInfoSync()
    return {
      keys: info.keys.filter(k => k.startsWith(STORAGE_PREFIX)).length,
      size: info.currentSize,     // KB
      limit: info.limitSize       // KB (上限 10240)
    }
  } catch (e) {
    return { keys: 0, size: 0, limit: 10240 }
  }
}

module.exports = { get, set, remove, clearAll, getInfo }
