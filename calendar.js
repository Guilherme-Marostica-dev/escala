const calendarGrid = document.querySelector("#calendar-grid");
const monthLabel = document.querySelector("#month-label");
const employeeSummary = document.querySelector("#employee-summary");
const employeeWarning = document.querySelector("#employee-warning");
const previousMonthButton = document.querySelector("#previous-month");
const nextMonthButton = document.querySelector("#next-month");
const todayButton = document.querySelector("#today-button");
const autoPlanButton = document.querySelector("#auto-plan-button");
const printButton = document.querySelector("#print-button");
const shifts = ["Frühschicht", "Spätschicht", "Nachtdienst"];

const monthFormatter = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });
let employees = [];
const assignments = {};
const today = new Date();
let displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);

function readEmployeesFromUrl() {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));

  try {
    const parsedEmployees = JSON.parse(hashParams.get("employees") || "[]");
    return Array.isArray(parsedEmployees) ? parsedEmployees.filter((employee) => employee.nome).map((employee) => ({
      nome: employee.nome,
      shift: employee.horarioPreferencia || "",
      vacationStart: employee.feriasInicio || "",
      vacationEnd: employee.feriasFim || ""
    })) : [];
  } catch {
    return [];
  }
}

function toDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isToday(year, month, day) {
  return year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
}

function isOnVacation(employee, dateKey) {
  return Boolean(employee.vacationStart && employee.vacationEnd && dateKey >= employee.vacationStart && dateKey <= employee.vacationEnd);
}

function createEmployeeOptions(selectedName, dateKey) {
  return [
    `<option value="">Kein Mitarbeiter</option>`,
    ...employees
      .filter((employee) => !isOnVacation(employee, dateKey) || employee.nome === selectedName)
      .map((employee) => `<option value="${escapeAttribute(employee.nome)}" ${employee.nome === selectedName ? "selected" : ""}>${escapeHtml(employee.nome)}</option>`)
  ].join("");
}

function createShiftOptions(selectedShift) {
  return shifts.map((shift) => `<option value="${shift}" ${shift === selectedShift ? "selected" : ""}>${shift}</option>`).join("");
}

function normalizeAssignment(assignment) {
  if (typeof assignment === "string") return { name: assignment, shift: "Frühschicht" };
  return { name: assignment?.name || "", shift: assignment?.shift || "Frühschicht" };
}

function shiftClass(shift) {
  if (shift === "Spätschicht") return "shift-evening";
  if (shift === "Nachtdienst") return "shift-night";
  return "shift-morning";
}

function shiftOrder(shift) {
  if (shift === "Frühschicht") return 0;
  if (shift === "Spätschicht") return 1;
  if (shift === "Nachtdienst") return 2;
  return 3;
}

function renderAssignmentRows(dateKey) {
  const values = (assignments[dateKey] || []).map((assignment, index) => ({
    assignment: normalizeAssignment(assignment),
    originalIndex: index
  }));
  const rows = values.length > 0 ? values.sort((left, right) => shiftOrder(left.assignment.shift) - shiftOrder(right.assignment.shift)) : [{ assignment: { name: "", shift: "Frühschicht" }, originalIndex: 0 }];

  return `
    <div class="employee-assignments">
      ${rows.map(({ assignment, originalIndex }) => `
        <div class="assignment-row ${shiftClass(assignment.shift)}">
          <label>
            <span class="sr-only">Mitarbeiter für den ${dateKey}</span>
            <select class="day-select" data-date="${dateKey}" data-index="${originalIndex}" data-previous="${escapeAttribute(assignment.name)}" aria-label="Mitarbeiter für den ${dateKey}">
              ${createEmployeeOptions(assignment.name, dateKey)}
            </select>
          </label>
          <label>
            <span class="sr-only">Schicht für den ${dateKey}</span>
            <select class="shift-select" data-date="${dateKey}" data-index="${originalIndex}" aria-label="Schicht für den ${dateKey}">
              ${createShiftOptions(assignment.shift)}
            </select>
          </label>
          <button class="remove-assignment" type="button" data-date="${dateKey}" data-index="${originalIndex}" aria-label="Mitarbeiter entfernen">×</button>
        </div>
      `).join("")}
      <button class="add-assignment" type="button" data-date="${dateKey}" aria-label="Mitarbeiter hinzufügen">+</button>
    </div>
  `;
}

function renderCalendar() {
  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  monthLabel.textContent = monthFormatter.format(displayedMonth);
  calendarGrid.innerHTML = "";

  for (let index = 0; index < firstWeekday; index += 1) {
    calendarGrid.appendChild(document.createElement("div")).className = "calendar-empty";
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = toDateKey(year, month, day);
    const dayElement = document.createElement("article");
    const dayTone = day % 2 === 0 ? " day-even" : " day-odd";
    dayElement.className = `calendar-day${dayTone}${isToday(year, month, day) ? " is-today" : ""}`;
    dayElement.innerHTML = `
      <div class="day-number"><span>${day}</span>${isToday(year, month, day) ? "<span>Heute</span>" : ""}</div>
      ${renderAssignmentRows(dateKey)}
    `;
    calendarGrid.appendChild(dayElement);
  }

  const totalCells = firstWeekday + daysInMonth;
  const trailingCells = (7 - (totalCells % 7)) % 7;
  for (let index = 0; index < trailingCells; index += 1) {
    calendarGrid.appendChild(document.createElement("div")).className = "calendar-empty";
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function currentCalendarState() {
  return {
    assignments,
    month: `${displayedMonth.getFullYear()}-${displayedMonth.getMonth()}`
  };
}

function saveCalendarState() {
  return window.employeeDatabase.saveCalendar(currentCalendarState());
}

function getDisplayedDates() {
  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => ({
    day: index + 1,
    dateKey: toDateKey(year, month, index + 1),
    weekday: new Date(year, month, index + 1).getDay()
  }));
}

function buildAutomaticPlan() {
  const dates = getDisplayedDates();
  const nextAssignments = {};
  const weeks = [];

  dates.forEach((date) => {
    const week = weeks[weeks.length - 1];
    if (!week || date.weekday === 0) weeks.push([]);
    weeks[weeks.length - 1].push(date);
  });

  weeks.forEach((week, weekIndex) => {
    week.forEach((date) => {
      nextAssignments[date.dateKey] = [];
    });

    employees.forEach((employee, employeeIndex) => {
      const offDay = (employeeIndex * 2 + weekIndex) % 7;
      const secondOffDay = (offDay + 1) % 7;

      week.forEach((date, dateIndex) => {
        const worksThisDay = week.length < 7 || (dateIndex !== offDay && dateIndex !== secondOffDay);
        if (worksThisDay && !isOnVacation(employee, date.dateKey) && !nextAssignments[date.dateKey].some((assignment) => assignment.name === employee.nome)) {
          const shift = employee.shift || shifts[employeeIndex % shifts.length];
          nextAssignments[date.dateKey].push({ name: employee.nome, shift });
        }
      });
    });
  });

  return nextAssignments;
}

async function automaticallyPlan() {
  if (employees.length === 0) {
    window.alert("Keine Mitarbeiter zum Einplanen vorhanden.");
    return;
  }

  if (employees.length > 9) {
    window.alert("Mit mehr als 9 Mitarbeitern ist eine Planung mit mindestens 5 Arbeitstagen und maximal 7 Mitarbeitern pro Tag mathematisch nicht möglich.");
    return;
  }

  const confirmed = window.confirm("Die aktuelle Planung für diesen Monat wird ersetzt. Automatisch planen?");
  if (!confirmed) return;

  Object.keys(assignments).forEach((date) => delete assignments[date]);
  Object.assign(assignments, buildAutomaticPlan());
  renderCalendar();
  await saveCalendarState();
}

calendarGrid.addEventListener("change", async (event) => {
  if (!event.target.matches(".day-select, .shift-select")) return;
  const { date, index } = event.target.dataset;
  if (!assignments[date]) assignments[date] = [];
  assignments[date] = assignments[date].map(normalizeAssignment);
  const assignment = assignments[date][Number(index)] || { name: "", shift: "Frühschicht" };
  const previousAssignment = { ...assignment };

  if (event.target.matches(".day-select")) {
    assignment.name = event.target.value;
    if (assignment.name) {
      const employee = employees.find((item) => item.nome === assignment.name);
      if (employee && isOnVacation(employee, date)) {
        event.target.value = "";
        window.alert("Dieser Mitarbeiter ist in diesem Zeitraum im Urlaub.");
        return;
      }
    }
  } else assignment.shift = event.target.value;

  const duplicate = assignment.name && assignments[date].some((item, itemIndex) => item.name === assignment.name && itemIndex !== Number(index));

  if (duplicate) {
    assignments[date][Number(index)] = previousAssignment;
    event.target.value = event.target.dataset.previous || (event.target.matches(".shift-select") ? "Frühschicht" : "");
    window.alert("Dieser Mitarbeiter ist an diesem Tag bereits eingetragen.");
    return;
  }

  assignments[date][Number(index)] = assignment;
  if (event.target.matches(".day-select")) event.target.dataset.previous = assignment.name;
  renderCalendar();
  await saveCalendarState();
});

calendarGrid.addEventListener("click", async (event) => {
  const addButton = event.target.closest(".add-assignment");
  const removeButton = event.target.closest(".remove-assignment");

  if (addButton) {
    const date = addButton.dataset.date;
    if (!assignments[date]) assignments[date] = [];
    assignments[date].push({ name: "", shift: shifts[assignments[date].length % shifts.length] });
    renderCalendar();
    await saveCalendarState();
  }

  if (removeButton) {
    const date = removeButton.dataset.date;
    const index = Number(removeButton.dataset.index);
    if (assignments[date]) assignments[date].splice(index, 1);
    renderCalendar();
    await saveCalendarState();
  }
});

previousMonthButton.addEventListener("click", async () => {
  displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
  renderCalendar();
  await saveCalendarState();
});

nextMonthButton.addEventListener("click", async () => {
  displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
  renderCalendar();
  await saveCalendarState();
});

todayButton.addEventListener("click", async () => {
  displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  renderCalendar();
  await saveCalendarState();
});

autoPlanButton.addEventListener("click", automaticallyPlan);
printButton.addEventListener("click", () => window.print());

async function initialize() {
  const [savedEmployees, savedCalendar] = await Promise.all([
    window.employeeDatabase.load(),
    window.employeeDatabase.loadCalendar()
  ]);

  if (savedCalendar?.assignments) Object.assign(assignments, savedCalendar.assignments);
  if (savedCalendar?.month) {
    const [year, month] = savedCalendar.month.split("-").map(Number);
    if (Number.isInteger(year) && Number.isInteger(month)) displayedMonth = new Date(year, month, 1);
  }

  employees = savedEmployees.length > 0 ? savedEmployees.map((employee) => ({
    nome: employee.name,
    shift: employee.shift || "",
    vacationStart: employee.vacationStart || "",
    vacationEnd: employee.vacationEnd || ""
  })) : readEmployeesFromUrl();
  const employeeNames = new Set(employees.map((employee) => employee.nome));
  Object.keys(assignments).forEach((date) => {
    assignments[date] = assignments[date]
      .map(normalizeAssignment)
      .filter((assignment) => {
        const employee = employees.find((item) => item.nome === assignment.name);
        return !assignment.name || (employeeNames.has(assignment.name) && !isOnVacation(employee, date));
      });
  });
  employeeSummary.textContent = `${employees.length} Mitarbeiter`;
  employeeWarning.hidden = employees.length > 0;
  renderCalendar();
}

initialize();