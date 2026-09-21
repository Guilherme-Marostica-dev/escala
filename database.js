async function requestDatabase(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Não foi possível acessar o banco de dados.");
  }
  return response.json();
}

window.employeeDatabase = {
  load: () => requestDatabase("/api/employees"),
  save: (employees) => requestDatabase("/api/employees", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(employees)
  }),
  loadCalendar: () => requestDatabase("/api/calendar"),
  saveCalendar: (calendar) => requestDatabase("/api/calendar", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(calendar)
  })
};