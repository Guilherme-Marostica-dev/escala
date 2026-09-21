const { Pool } = require("pg");

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
const connectionConfig = connectionString ? {
  connectionString,
  max: 1,
  ssl: { rejectUnauthorized: false }
} : process.env.POSTGRES_HOST ? {
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DATABASE || "postgres",
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD,
  max: 1,
  ssl: { rejectUnauthorized: false }
} : null;
const pool = connectionConfig ? new Pool(connectionConfig) : null;

let schemaReady;

async function ensureSchema() {
  if (!schemaReady) {
    if (!pool) throw new Error("POSTGRES_URL não configurada.");
    schemaReady = Promise.all([
      pool.query(`CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        shift TEXT NOT NULL DEFAULT '',
        vacation_start TEXT NOT NULL DEFAULT '',
        vacation_end TEXT NOT NULL DEFAULT ''
      )`),
      pool.query(`CREATE TABLE IF NOT EXISTS calendar_state (
        id INTEGER PRIMARY KEY,
        assignments_json TEXT NOT NULL DEFAULT '{}',
        month TEXT NOT NULL DEFAULT ''
      )`)
    ]);
  }
  await schemaReady;
}

function validateEmployee(employee) {
  if (!employee || typeof employee.name !== "string" || !employee.name.trim()) return "Nome do funcionário é obrigatório.";
  if (employee.vacationStart && employee.vacationEnd && employee.vacationStart > employee.vacationEnd) return "O início das férias não pode ser posterior ao fim.";
  return null;
}

function employeeFromRow(row) {
  return { id: row.id, name: row.name, shift: row.shift, vacationStart: row.vacation_start, vacationEnd: row.vacation_end };
}

module.exports = async function handler(request, response) {
  try {
    if (request.url.startsWith("/api/health")) {
      if (!pool) return response.status(503).json({ status: "error", databaseConfigured: false });
      await pool.query("SELECT 1");
      return response.status(200).json({ status: "ok", databaseConfigured: true });
    }
    await ensureSchema();

    if (request.url.startsWith("/api/employees") && request.method === "GET") {
      const { rows } = await pool.query("SELECT * FROM employees ORDER BY id");
      return response.status(200).json(rows.map(employeeFromRow));
    }

    if (request.url.startsWith("/api/employees") && request.method === "PUT") {
      const employees = Array.isArray(request.body) ? request.body : [];
      const error = employees.map(validateEmployee).find(Boolean);
      if (error) return response.status(400).json({ error });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("DELETE FROM employees");
        for (const employee of employees) {
          await client.query(
            "INSERT INTO employees (id, name, shift, vacation_start, vacation_end) VALUES ($1, $2, $3, $4, $5)",
            [employee.id, employee.name.trim(), employee.shift || "", employee.vacationStart || "", employee.vacationEnd || ""]
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      return response.status(200).json(employees);
    }

    if (request.url.startsWith("/api/calendar") && request.method === "GET") {
      const { rows } = await pool.query("SELECT assignments_json, month FROM calendar_state WHERE id = 1");
      if (rows.length === 0) return response.status(200).json({ assignments: {}, month: "" });
      return response.status(200).json({ assignments: JSON.parse(rows[0].assignments_json), month: rows[0].month });
    }

    if (request.url.startsWith("/api/calendar") && request.method === "PUT") {
      const assignments = request.body?.assignments && typeof request.body.assignments === "object" ? request.body.assignments : {};
      const month = typeof request.body?.month === "string" ? request.body.month : "";
      await pool.query(
        "INSERT INTO calendar_state (id, assignments_json, month) VALUES (1, $1, $2) ON CONFLICT(id) DO UPDATE SET assignments_json = EXCLUDED.assignments_json, month = EXCLUDED.month",
        [JSON.stringify(assignments), month]
      );
      return response.status(200).json({ assignments, month });
    }

    return response.status(404).json({ error: "Rota não encontrada." });
  } catch (error) {
    console.error("Database API error:", error);
    return response.status(500).json({ error: "Banco de produção não configurado ou indisponível." });
  }
};