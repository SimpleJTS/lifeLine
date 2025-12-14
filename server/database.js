import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'lifekline.db');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 创建数据库连接
const db = new Database(DB_PATH);

// 启用 WAL 模式以提高并发性能
db.pragma('journal_mode = WAL');

// 初始化数据库表
const initDatabase = () => {
  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      points INTEGER DEFAULT 1000,
      role TEXT DEFAULT 'user',
      created_at TEXT NOT NULL,
      updated_at TEXT,
      last_login_at TEXT,
      login_count INTEGER DEFAULT 0
    )
  `);

  // 用户输入信息表（存储每次填写的八字信息）
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_inputs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT,
      gender TEXT NOT NULL,
      birth_year INTEGER,
      year_pillar TEXT,
      month_pillar TEXT,
      day_pillar TEXT,
      hour_pillar TEXT,
      start_age INTEGER,
      first_da_yun TEXT,
      model_name TEXT,
      api_base_url TEXT,
      use_custom_api INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 分析结果表
  db.exec(`
    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      input_id TEXT,
      cost INTEGER DEFAULT 0,
      model_used TEXT,
      chart_data TEXT,
      analysis_data TEXT,
      created_at TEXT NOT NULL,
      processing_time_ms INTEGER,
      status TEXT DEFAULT 'completed',
      error_message TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (input_id) REFERENCES user_inputs(id)
    )
  `);

  // 系统日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT,
      user_id TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_user_inputs_user_id ON user_inputs(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_inputs_created_at ON user_inputs(created_at);
    CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
    CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at);
    CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
  `);

  console.log('✓ 数据库初始化完成');
};

// 初始化数据库
initDatabase();

// ============ 用户操作 ============

export const createUser = (id, email, passwordHash, points = 1000) => {
  const stmt = db.prepare(`
    INSERT INTO users (id, email, password_hash, points, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  stmt.run(id, email, passwordHash, points, now);
  return { id, email, points, createdAt: now };
};

export const getUserByEmail = (email) => {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const row = stmt.get(email);
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    points: row.points,
    role: row.role,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    loginCount: row.login_count,
  };
};

export const getUserById = (id) => {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const row = stmt.get(id);
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    points: row.points,
    role: row.role,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    loginCount: row.login_count,
  };
};

export const updateUserPoints = (userId, newPoints) => {
  const stmt = db.prepare('UPDATE users SET points = ?, updated_at = ? WHERE id = ?');
  stmt.run(newPoints, new Date().toISOString(), userId);
};

export const updateUserLogin = (userId) => {
  const stmt = db.prepare(`
    UPDATE users
    SET last_login_at = ?, login_count = login_count + 1, updated_at = ?
    WHERE id = ?
  `);
  const now = new Date().toISOString();
  stmt.run(now, now, userId);
};

export const getAllUsers = (limit = 100, offset = 0) => {
  const stmt = db.prepare(`
    SELECT id, email, points, role, created_at, last_login_at, login_count
    FROM users
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset).map(row => ({
    id: row.id,
    email: row.email,
    points: row.points,
    role: row.role,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    loginCount: row.login_count,
  }));
};

export const getUserCount = () => {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
  return stmt.get().count;
};

// ============ 用户输入记录 ============

export const saveUserInput = (inputData) => {
  const stmt = db.prepare(`
    INSERT INTO user_inputs (
      id, user_id, name, gender, birth_year, year_pillar, month_pillar,
      day_pillar, hour_pillar, start_age, first_da_yun, model_name,
      api_base_url, use_custom_api, created_at, ip_address, user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  stmt.run(
    inputData.id,
    inputData.userId || null,
    inputData.name || null,
    inputData.gender,
    inputData.birthYear || null,
    inputData.yearPillar || null,
    inputData.monthPillar || null,
    inputData.dayPillar || null,
    inputData.hourPillar || null,
    inputData.startAge || null,
    inputData.firstDaYun || null,
    inputData.modelName || null,
    inputData.apiBaseUrl || null,
    inputData.useCustomApi ? 1 : 0,
    now,
    inputData.ipAddress || null,
    inputData.userAgent || null
  );

  return { ...inputData, createdAt: now };
};

export const getUserInputs = (userId, limit = 20, offset = 0) => {
  const stmt = db.prepare(`
    SELECT * FROM user_inputs
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(userId, limit, offset);
};

export const getAllInputs = (limit = 100, offset = 0) => {
  const stmt = db.prepare(`
    SELECT ui.*, u.email as user_email
    FROM user_inputs ui
    LEFT JOIN users u ON ui.user_id = u.id
    ORDER BY ui.created_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset);
};

export const getInputCount = () => {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM user_inputs');
  return stmt.get().count;
};

// ============ 分析结果 ============

export const saveAnalysis = (analysisData) => {
  const stmt = db.prepare(`
    INSERT INTO analyses (
      id, user_id, input_id, cost, model_used, chart_data, analysis_data,
      created_at, processing_time_ms, status, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  stmt.run(
    analysisData.id,
    analysisData.userId || null,
    analysisData.inputId || null,
    analysisData.cost || 0,
    analysisData.modelUsed || null,
    JSON.stringify(analysisData.chartData || []),
    JSON.stringify(analysisData.analysisData || {}),
    now,
    analysisData.processingTimeMs || null,
    analysisData.status || 'completed',
    analysisData.errorMessage || null
  );

  return { ...analysisData, createdAt: now };
};

export const getAnalysesByUserId = (userId, limit = 20, offset = 0) => {
  const stmt = db.prepare(`
    SELECT * FROM analyses
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(userId, limit, offset).map(row => ({
    id: row.id,
    userId: row.user_id,
    inputId: row.input_id,
    cost: row.cost,
    modelUsed: row.model_used,
    chartData: JSON.parse(row.chart_data || '[]'),
    analysisData: JSON.parse(row.analysis_data || '{}'),
    createdAt: row.created_at,
    processingTimeMs: row.processing_time_ms,
    status: row.status,
  }));
};

export const getAnalysisById = (id) => {
  const stmt = db.prepare('SELECT * FROM analyses WHERE id = ?');
  const row = stmt.get(id);
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    inputId: row.input_id,
    cost: row.cost,
    modelUsed: row.model_used,
    chartData: JSON.parse(row.chart_data || '[]'),
    analysisData: JSON.parse(row.analysis_data || '{}'),
    createdAt: row.created_at,
    processingTimeMs: row.processing_time_ms,
    status: row.status,
  };
};

export const getAllAnalyses = (limit = 100, offset = 0) => {
  const stmt = db.prepare(`
    SELECT a.*, u.email as user_email
    FROM analyses a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset).map(row => ({
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    cost: row.cost,
    modelUsed: row.model_used,
    createdAt: row.created_at,
    status: row.status,
  }));
};

export const getAnalysisCount = () => {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM analyses');
  return stmt.get().count;
};

// ============ 系统日志 ============

export const logEvent = (level, message, details = null, userId = null, ipAddress = null) => {
  const stmt = db.prepare(`
    INSERT INTO system_logs (level, message, details, user_id, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(level, message, details ? JSON.stringify(details) : null, userId, ipAddress, new Date().toISOString());
};

export const getSystemLogs = (limit = 100, offset = 0, level = null) => {
  let sql = 'SELECT * FROM system_logs';
  const params = [];

  if (level) {
    sql += ' WHERE level = ?';
    params.push(level);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = db.prepare(sql);
  return stmt.all(...params);
};

// ============ 统计信息 ============

export const getStats = () => {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const inputCount = db.prepare('SELECT COUNT(*) as count FROM user_inputs').get().count;
  const analysisCount = db.prepare('SELECT COUNT(*) as count FROM analyses').get().count;
  const totalPoints = db.prepare('SELECT SUM(points) as total FROM users').get().total || 0;
  const totalCost = db.prepare('SELECT SUM(cost) as total FROM analyses').get().total || 0;

  // 今日统计
  const today = new Date().toISOString().split('T')[0];
  const todayUsers = db.prepare(`SELECT COUNT(*) as count FROM users WHERE created_at LIKE '${today}%'`).get().count;
  const todayAnalyses = db.prepare(`SELECT COUNT(*) as count FROM analyses WHERE created_at LIKE '${today}%'`).get().count;

  return {
    userCount,
    inputCount,
    analysisCount,
    totalPoints,
    totalCost,
    todayUsers,
    todayAnalyses,
  };
};

// ============ 数据迁移工具 ============

export const migrateFromJson = async (jsonDbPath) => {
  try {
    const jsonData = JSON.parse(fs.readFileSync(jsonDbPath, 'utf-8'));

    // 迁移用户
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, email, password_hash, points, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const user of jsonData.users || []) {
      insertUser.run(user.id, user.email, user.passwordHash, user.points, user.createdAt);
    }

    // 迁移分析记录
    const insertAnalysis = db.prepare(`
      INSERT OR IGNORE INTO analyses (id, user_id, cost, chart_data, analysis_data, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertInput = db.prepare(`
      INSERT OR IGNORE INTO user_inputs (
        id, user_id, name, gender, birth_year, year_pillar, month_pillar,
        day_pillar, hour_pillar, start_age, first_da_yun, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const analysis of jsonData.analyses || []) {
      const inputId = `input_${analysis.id}`;
      const input = analysis.input || {};

      // 保存输入
      insertInput.run(
        inputId,
        analysis.userId,
        input.name || null,
        input.gender || 'Male',
        input.birthYear || null,
        input.yearPillar || null,
        input.monthPillar || null,
        input.dayPillar || null,
        input.hourPillar || null,
        input.startAge || null,
        input.firstDaYun || null,
        analysis.createdAt
      );

      // 保存分析结果
      insertAnalysis.run(
        analysis.id,
        analysis.userId,
        analysis.cost || 0,
        JSON.stringify(analysis.result?.chartData || []),
        JSON.stringify(analysis.result?.analysis || {}),
        analysis.createdAt
      );
    }

    console.log(`✓ 迁移完成: ${jsonData.users?.length || 0} 用户, ${jsonData.analyses?.length || 0} 分析记录`);
    return true;
  } catch (err) {
    console.error('迁移失败:', err);
    return false;
  }
};

// 导出数据库实例（用于高级操作）
export const getDb = () => db;

// 关闭数据库连接
export const closeDb = () => db.close();

export const nowIso = () => new Date().toISOString();
