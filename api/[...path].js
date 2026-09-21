const { sql } = require("@vercel/postgres");

let schemaReady;

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = Promise.all([
      sql`CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        shift TEXT NOT NULL DEFAULT '',
        vacation_start TEXT NOT NULL DEFAULT '',
        vacation_end TEXT NOT NULL DEFAULT ''
      )`,
      sql`CREATE TABLE IF NOT EXISTS calendar_state (
        id INTEGER PRIMARY KEY,
        assignments_json TEXT NOT NULL DEFAULT '{}',
        month TEXT NOT NULL DEFAULT ''
      )`
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
    if (request.url.startsWith("/api/health")) return response.status(200).json({ status: "ok" });
    await ensureSchema();

    if (request.url.startsWith("/api/employees") && request.method === "GET") {
      const { rows } = await sql`SELECT * FROM employees ORDER BY id`;
      return response.status(200).json(rows.map(employeeFromRow));
    }

    if (request.url.startsWith("/api/employees") && request.method === "PUT") {
      const employees = Array.isArray(request.body) ? request.body : [];
      const error = employees.map(validateEmployee).find(Boolean);
      if (error) return response.status(400).json({ error });

      await sql`DELETE FROM employees`;
      for (const employee of employees) {
        await sql`INSERT INTO employees (id, name, shift, vacation_start, vacation_end)
          VALUES (${employee.id}, ${employee.name.trim()}, ${employee.shift || ""}, ${employee.vacationStart || ""}, ${employee.vacationEnd || ""})`;
      }
      return response.status(200).json(employees);
    }

    if (request.url.startsWith("/api/calendar") && request.method === "GET") {
      const { rows } = await sql`SELECT assignments_json, month FROM calendar_state WHERE id = 1`;
      if (rows.length === 0) return response.status(200).json({ assignments: {}, month: "" });
      return response.status(200).json({ assignments: JSON.parse(rows[0].assignments_json), month: rows[0].month });
    }

    if (request.url.startsWith("/api/calendar") && request.method === "PUT") {
      const assignments = request.body?.assignments && typeof request.body.assignments === "object" ? request.body.assignments : {};
      const month = typeof request.body?.month === "string" ? request.body.month : "";
      await sql`INSERT INTO calendar_state (id, assignments_json, month) VALUES (1, ${JSON.stringify(assignments)}, ${month})
        ON CONFLICT(id) DO UPDATE SET assignments_json = EXCLUDED.assignments_json, month = EXCLUDED.month`;
      return response.status(200).json({ assignments, month });
    }

    return response.status(404).json({ error: "Rota não encontrada." });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Banco de produção não configurado ou indisponível." });
  }
};