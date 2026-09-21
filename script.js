const form = document.querySelector("#employee-form");
const nameInput = document.querySelector("#employee-name");
const shiftInput = document.querySelector("#employee-shift");
const vacationStartInput = document.querySelector("#vacation-start");
const vacationEndInput = document.querySelector("#vacation-end");
const submitLabel = document.querySelector("#submit-label");
const cancelButton = document.querySelector("#cancel-button");
const employeeItems = document.querySelector("#employee-items");
const employeeList = document.querySelector("#employee-list");
const emptyState = document.querySelector("#empty-state");
const employeeCount = document.querySelector("#employee-count");
const exportButton = document.querySelector("#export-button");
const calendarLink = document.querySelector("#calendar-link");

let employees = [];
let editingId = null;

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function renderEmployees() {
  employeeItems.innerHTML = "";
  employeeCount.textContent = employees.length;
  exportButton.disabled = employees.length === 0;
  calendarLink.href = buildCalendarUrl();
  emptyState.hidden = employees.length > 0;
  employeeList.hidden = employees.length === 0;

  employees.forEach((employee) => {
    const item = document.createElement("li");
    item.className = "employee-item";
    item.innerHTML = `
      <div class="employee-details">
        <span class="employee-name"></span>
        <span class="employee-preference"></span>
      </div>
      <div class="item-actions">
        <button class="icon-button" type="button" data-action="edit" data-id="${employee.id}" aria-label="Editar ${escapeAttribute(employee.name)}" title="Editar">✎</button>
        <button class="icon-button delete" type="button" data-action="delete" data-id="${employee.id}" aria-label="Excluir ${escapeAttribute(employee.name)}" title="Excluir">×</button>
      </div>
    `;
    item.querySelector(".employee-name").textContent = employee.name;
    item.querySelector(".employee-preference").textContent = employee.shift ? employee.shift : "Sem preferência";
    if (employee.vacationStart && employee.vacationEnd) {
      item.querySelector(".employee-preference").textContent += ` · Férias: ${employee.vacationStart} até ${employee.vacationEnd}`;
    }
    employeeItems.appendChild(item);
  });
}

function buildCalendarUrl() {
  const names = employees.map((employee) => ({ nome: employee.name, horarioPreferencia: employee.shift || "", feriasInicio: employee.vacationStart || "", feriasFim: employee.vacationEnd || "" }));
  const encodedEmployees = encodeURIComponent(JSON.stringify(names));
  return `calendar.html#employees=${encodedEmployees}`;
}

function exportEmployees() {
  const employeeNames = employees.map((employee) => ({ nome: employee.name, horarioPreferencia: employee.shift || "", feriasInicio: employee.vacationStart || "", feriasFim: employee.vacationEnd || "" }));
  const json = JSON.stringify(employeeNames, null, 2);
  const file = new Blob([json], { type: "application/json;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(file);
  const downloadLink = document.createElement("a");

  downloadLink.href = downloadUrl;
  downloadLink.download = "funcionarios.json";
  downloadLink.click();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
}

function escapeAttribute(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function resetForm() {
  editingId = null;
  form.reset();
  submitLabel.textContent = "Adicionar";
  cancelButton.hidden = true;
  nameInput.focus();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const shift = shiftInput.value;
  const vacationStart = vacationStartInput.value;
  const vacationEnd = vacationEndInput.value;

  if (!name) {
    nameInput.focus();
    return;
  }

  if ((vacationStart && !vacationEnd) || (!vacationStart && vacationEnd) || (vacationStart > vacationEnd)) {
    window.alert("Informe um período de férias válido.");
    return;
  }

  if (editingId) {
    employees = employees.map((employee) => employee.id === editingId ? { ...employee, name, shift, vacationStart, vacationEnd } : employee);
  } else {
    employees.push({ id: createId(), name, shift, vacationStart, vacationEnd });
  }

  await window.employeeDatabase.save(employees);
  renderEmployees();
  resetForm();
});

cancelButton.addEventListener("click", resetForm);
exportButton.addEventListener("click", exportEmployees);

employeeItems.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const employee = employees.find((item) => item.id === button.dataset.id);
  if (!employee) return;

  if (button.dataset.action === "edit") {
    editingId = employee.id;
    nameInput.value = employee.name;
    shiftInput.value = employee.shift || "";
    vacationStartInput.value = employee.vacationStart || "";
    vacationEndInput.value = employee.vacationEnd || "";
    submitLabel.textContent = "Salvar alteração";
    cancelButton.hidden = false;
    nameInput.focus();
  }

  if (button.dataset.action === "delete") {
    employees = employees.filter((item) => item.id !== employee.id);
    await window.employeeDatabase.save(employees);
    renderEmployees();
    if (editingId === employee.id) resetForm();
  }
});

async function initialize() {
  employees = (await window.employeeDatabase.load()).map((employee) => ({
    ...employee,
    shift: employee.shift || "",
    vacationStart: employee.vacationStart || "",
    vacationEnd: employee.vacationEnd || ""
  }));
  renderEmployees();
}

initialize();