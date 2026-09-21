if (process.env.VERCEL) {
  module.exports = require("./api/[...path].js");
} else {
const path = require("node:path");
const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const express = require("express");

const app = express();
const port = process.env.PORT || 3000;
const databasePath = process.env.DATABASE_PATH || path.join(__dirname, "data", "escala.sqlite");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);

database.exec("PRAGMA journal_mode = WAL;");
database.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    shift TEXT NOT NULL DEFAULT '',
    vacation_start TEXT NOT NULL DEFAULT '',
    vacation_end TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS calendar_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    assignments_json TEXT NOT NULL DEFAULT '{}',
    month TEXT NOT NULL DEFAULT ''
  );
`);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

function validateEmployee(employee) {
  if (!employee || typeof employee.name !== "string" || !employee.name.trim()) return "Nome do funcionário é obrigatório.";
  if (employee.vacationStart && employee.vacationEnd && employee.vacationStart > employee.vacationEnd) return "O início das férias não pode ser posterior ao fim.";
  return null;
}

function employeeFromRow(row) {
  return { id: row.id, name: row.name, shift: row.shift, vacationStart: row.vacation_start, vacationEnd: row.vacation_end };
}

app.get("/api/employees", (request, response) => {
  const rows = database.prepare("SELECT * FROM employees ORDER BY rowid").all();
  response.json(rows.map(employeeFromRow));
});

app.put("/api/employees", (request, response) => {
  const employees = Array.isArray(request.body) ? request.body : [];
  const error = employees.map(validateEmployee).find(Boolean);
  if (error) return response.status(400).json({ error });

  database.exec("BEGIN TRANSACTION;");
  try {
    database.prepare("DELETE FROM employees").run();
    const insert = database.prepare(`INSERT INTO employees (id, name, shift, vacation_start, vacation_end) VALUES (:id, :name, :shift, :vacationStart, :vacationEnd)`);
    employees.forEach((employee) => insert.run({
      id: employee.id,
      name: employee.name.trim(),
      shift: employee.shift || "",
      vacationStart: employee.vacationStart || "",
      vacationEnd: employee.vacationEnd || ""
    }));
    database.exec("COMMIT;");
  } catch (saveError) {
    database.exec("ROLLBACK;");
    return response.status(500).json({ error: saveError.message });
  }
  response.json(employees);
});

app.get("/api/calendar", (request, response) => {
  const row = database.prepare("SELECT assignments_json, month FROM calendar_state WHERE id = 1").get();
  if (!row) return response.json({ assignments: {}, month: "" });
  response.json({ assignments: JSON.parse(row.assignments_json), month: row.month });
});

app.put("/api/calendar", (request, response) => {
  const assignments = request.body?.assignments && typeof request.body.assignments === "object" ? request.body.assignments : {};
  const month = typeof request.body?.month === "string" ? request.body.month : "";
  database.prepare(`INSERT INTO calendar_state (id, assignments_json, month) VALUES (1, :assignments, :month) ON CONFLICT(id) DO UPDATE SET assignments_json = excluded.assignments_json, month = excluded.month`).run({ assignments: JSON.stringify(assignments), month });
  response.json({ assignments, month });
});

app.get("/api/health", (request, response) => response.json({ status: "ok" }));

app.listen(port, () => console.log(`Escala disponível em http://localhost:${port}`));
}