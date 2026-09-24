const $ = id => document.getElementById(id);

let courses = [];
let records = [];
let loadedCourse = "";

const course = $("course");
const semester = $("semester");
const subject = $("subject");
const subjectSearch = $("subjectSearch");
const category = $("category");
const searchBtn = $("searchBtn");
const message = $("message");
const resultSection = $("resultSection");
const resultCard = $("resultCard");

async function getJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(path);
  return response.json();
}

async function init() {
  try {
    courses = await getJSON("data/courses.json");
    course.innerHTML =
      '<option value="">Select course</option>' +
      courses.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
  } catch {
    show("Course data could not be loaded.");
  }
}

course.addEventListener("change", async () => {
  resetAll();
  if (!course.value) return;

  const selected = courses.find(c => c.id === course.value);
  if (!selected) return;

  loadedCourse = selected.id;
  // Categories are intentionally loaded from the course's folder.
  // This keeps BA/BSc/BCom/BBA independent.
  const availableCategories = selected.categories || [
    "dsc", "mdc", "sec", "vac", "compulsory"
  ];

  availableCategories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = displayCategory(cat);
    category.appendChild(option);
  });

  category.disabled = false;
});

category.addEventListener("change", async () => {
  clearAfterCategory();
  if (!category.value || !loadedCourse) return;

  try {
    records = await getJSON(
      `data/syllabus/${loadedCourse}/${category.value}.json`
    );

    const semesters = [...new Set(records.map(r => String(r.semester)))]
      .sort((a, b) => Number(a) - Number(b));

    semesters.forEach(s => {
      const option = document.createElement("option");
      option.value = s;
      option.textContent = `Semester ${s}`;
      semester.appendChild(option);
    });

    semester.disabled = semesters.length === 0;

    if (!semesters.length) {
      show("No syllabus data has been added to this category yet.");
    } else {
      hideMessage();
    }
  } catch {
    records = [];
    show("This category file is not available yet.");
  }
});

semester.addEventListener("change", () => {
  subject.innerHTML = "";
  subjectSearch.value = "";

  if (!semester.value) {
    subject.disabled = true;
    subjectSearch.disabled = true;
    searchBtn.disabled = true;
    return;
  }

  const semesterRecords = records.filter(
    r => String(r.semester) === semester.value
  );

  [...new Set(semesterRecords.map(r => r.subject))]
    .sort((a, b) => a.localeCompare(b))
    .forEach(s => {
      const option = document.createElement("option");
      option.value = s;
      option.textContent = s;
      subject.appendChild(option);
    });

  subject.disabled = subject.options.length === 0;
  subjectSearch.disabled = subject.disabled;
  updateSearch();
});

subjectSearch.addEventListener("input", () => {
  const query = subjectSearch.value.toLowerCase().trim();
  [...subject.options].forEach(option => {
    option.hidden = query && !option.textContent.toLowerCase().includes(query);
  });
});

[subject].forEach(el => el.addEventListener("change", updateSearch));

searchBtn.addEventListener("click", () => {
  const matches = records.filter(r =>
    String(r.semester) === semester.value &&
    r.subject === subject.value
  );

  if (!matches.length) {
    show("No syllabus found for these selections.");
    resultSection.classList.add("hidden");
    return;
  }

  hideMessage();
  renderResults(matches);
});

function renderResults(items) {
  resultCard.innerHTML = items.map(r => `
    <div class="result-head">
      <div class="result-icon">📚</div>
      <div>
        <h2>${esc(r.paperTitle || r.subject)}</h2>
        <div class="meta">
          ${esc(courseName(r.course || loadedCourse))}
          · Semester ${esc(r.semester)}
          · ${esc(r.category || category.value)}
        </div>
        ${r.paperCode ? `<span class="badge">${esc(r.paperCode)}</span>` : ""}
      </div>
    </div>

    ${(r.units || []).map(unit => `
      <section class="unit">
        <h3>📌 ${esc(unit.title)}</h3>
        <ul>
          ${(unit.topics || []).map(topic => `<li>${esc(topic)}</li>`).join("")}
        </ul>
      </section>
    `).join("")}

    ${r.sourceUrl
      ? `<a class="source" href="${esc(r.sourceUrl)}" target="_blank" rel="noopener">
           ↗ View Official PU Source
         </a>`
      : ""}
  `).join("");

  resultSection.classList.remove("hidden");
  resultSection.scrollIntoView({ behavior: "smooth" });
});

function updateSearch() {
  searchBtn.disabled = !(course.value && category.value && semester.value && subject.value);
}

function resetAll() {
  category.innerHTML = '<option value="">Select category</option>';
  category.disabled = true;
  clearAfterCategory();
  records = [];
  loadedCourse = "";
}

function clearAfterCategory() {
  semester.innerHTML = '<option value="">Select semester</option>';
  semester.disabled = true;
  subject.innerHTML = "";
  subjectSearch.value = "";
  subject.disabled = true;
  subjectSearch.disabled = true;
  searchBtn.disabled = true;
  resultSection.classList.add("hidden");
}

function displayCategory(cat) {
  const labels = {
    dsc: "DSC",
    mdc: "MDC",
    sec: "SEC",
    vac: "VAC",
    compulsory: "Compulsory"
  };
  return labels[cat] || cat.toUpperCase();
}

function courseName(id) {
  const c = courses.find(x => x.id === id);
  return c ? c.name : id;
}

function show(text) {
  message.textContent = text;
  message.classList.remove("hidden");
}

function hideMessage() {
  message.classList.add("hidden");
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#039;"
  }[c]));
}

$("themeBtn").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const dark = document.body.classList.contains("dark");
  $("themeBtn").textContent = dark ? "☀" : "☾";
  localStorage.setItem("theme", dark ? "dark" : "light");
});

if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
  $("themeBtn").textContent = "☀";
}

init();
