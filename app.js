const $ = id => document.getElementById(id);

const DEFAULT_COURSES = [
  { id: "ba", name: "B.A.", categories: ["dsc", "mdc", "sec", "vac", "compulsory"] },
  { id: "bsc", name: "B.Sc.", categories: ["dsc", "mdc", "sec", "vac", "compulsory"] },
  { id: "bcom", name: "B.Com.", categories: ["dsc", "mdc", "sec", "vac", "compulsory"] },
  { id: "bba", name: "BBA", categories: ["dsc", "mdc", "sec", "vac", "compulsory"] }
];

const ALL_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const CATEGORY_ORDER = ["dsc", "mdc", "sec", "vac", "compulsory"];

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
const themeBtn = $("themeBtn");

async function getJSON(path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${response.status}: ${path}`);
  return response.json();
}

async function init() {
  try {
    courses = await getJSON("data/courses.json");
    if (!Array.isArray(courses) || !courses.length) throw new Error("Invalid courses.json");
  } catch (error) {
    // Keeps the first dropdown usable even if GitHub Pages temporarily fails to fetch JSON.
    courses = DEFAULT_COURSES;
    show("Course list loaded from the built-in project configuration.");
  }

  populateCourseSelect();
  restoreTheme();
}

function populateCourseSelect() {
  course.innerHTML = '<option value="">Select course</option>' +
    courses.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
}

course.addEventListener("change", async () => {
  resetFromCourse();
  loadedCourse = course.value;
  if (!loadedCourse) return;

  const selected = courses.find(c => c.id === loadedCourse);
  const availableCategories = selected?.categories || CATEGORY_ORDER;

  // The student flow is Course → Semester → Subject → Category.
  // Therefore all category files are loaded together after course selection.
  records = [];

  const results = await Promise.allSettled(
    availableCategories.map(async cat => {
      const data = await getJSON(`data/syllabus/${loadedCourse}/${cat}.json`);
      return Array.isArray(data)
        ? data.map(record => ({ ...record, category: record.category || cat, course: record.course || loadedCourse }))
        : [];
    })
  );

  results.forEach(result => {
    if (result.status === "fulfilled") records.push(...result.value);
  });

  // Show all eight semesters as the app's standard PU undergraduate semester selector.
  // Subject/category remain locked until actual syllabus records exist.
  populateSemesterSelect();

  if (!records.length) {
    show("Course selected. Semester is ready; subject data will appear after the syllabus JSON files are populated.");
  } else {
    hideMessage();
  }
});

semester.addEventListener("change", () => {
  resetFromSemester();
  if (!semester.value) return;

  const semesterRecords = records.filter(r => String(r.semester) === semester.value);
  const subjects = [...new Set(semesterRecords.map(r => r.subject).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  subjects.forEach(name => addOption(subject, name, name));

  const enabled = subjects.length > 0;
  subject.disabled = !enabled;
  subjectSearch.disabled = !enabled;

  if (!enabled) {
    show(`No ${courseName(loadedCourse)} syllabus records have been added for Semester ${semester.value} yet.`);
  } else {
    hideMessage();
  }
});

subjectSearch.addEventListener("input", () => {
  const query = subjectSearch.value.toLowerCase().trim();
  [...subject.options].forEach(option => {
    if (!option.value) return;
    option.hidden = Boolean(query) && !option.textContent.toLowerCase().includes(query);
  });
});

subject.addEventListener("change", () => {
  category.innerHTML = '<option value="">Select category</option>';
  category.disabled = true;
  searchBtn.disabled = true;
  resultSection.classList.add("hidden");

  if (!subject.value) return;

  const matchingCategories = [...new Set(
    records
      .filter(r => String(r.semester) === semester.value && r.subject === subject.value)
      .map(r => r.category)
      .filter(Boolean)
  )].sort((a, b) => categoryRank(a) - categoryRank(b));

  matchingCategories.forEach(cat => addOption(category, cat, displayCategory(cat)));

  category.disabled = matchingCategories.length === 0;
  if (!matchingCategories.length) {
    show("This subject is present, but its category has not been classified yet.");
  } else {
    hideMessage();
  }
});

category.addEventListener("change", () => {
  searchBtn.disabled = !(
    loadedCourse && semester.value && subject.value && category.value
  );
});

searchBtn.addEventListener("click", () => {
  const matches = records.filter(r =>
    String(r.semester) === semester.value &&
    r.subject === subject.value &&
    String(r.category).toLowerCase() === category.value.toLowerCase()
  );

  if (!matches.length) {
    show("No syllabus found for these selections.");
    resultSection.classList.add("hidden");
    return;
  }

  hideMessage();
  renderResults(matches);
});

function populateSemesterSelect() {
  semester.innerHTML = '<option value="">Select semester</option>';
  ALL_SEMESTERS.forEach(s => addOption(semester, String(s), `Semester ${s}`));
  semester.disabled = false;
}

function resetFromCourse() {
  semester.innerHTML = '<option value="">Select semester</option>';
  semester.disabled = true;
  resetFromSemester();
  resultSection.classList.add("hidden");
}

function resetFromSemester() {
  subject.innerHTML = '<option value="">Select subject</option>';
  subject.disabled = true;
  subjectSearch.value = "";
  subjectSearch.disabled = true;
  category.innerHTML = '<option value="">Select category</option>';
  category.disabled = true;
  searchBtn.disabled = true;
  resultSection.classList.add("hidden");
}

function addOption(select, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

function categoryRank(cat) {
  const index = CATEGORY_ORDER.indexOf(String(cat).toLowerCase());
  return index === -1 ? 99 : index;
}

function displayCategory(cat) {
  const labels = {
    dsc: "DSC",
    mdc: "MDC",
    sec: "SEC",
    vac: "VAC",
    compulsory: "Compulsory"
  };
  return labels[String(cat).toLowerCase()] || String(cat).toUpperCase();
}

function renderResults(items) {
  resultCard.innerHTML = items.map(r => `
    <div class="result-head">
      <div class="result-icon">📚</div>
      <div>
        <h2>${esc(r.paperTitle || r.subject)}</h2>
        <div class="meta">
          ${esc(courseName(r.course || loadedCourse))}
          · Semester ${esc(r.semester)}
          · ${esc(displayCategory(r.category || category.value))}
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

    ${r.sourceUrl ? `<a class="source" href="${esc(r.sourceUrl)}" target="_blank" rel="noopener">↗ View Official PU Source</a>` : ""}
  `).join("");

  resultSection.classList.remove("hidden");
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
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
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function applyTheme(dark) {
  document.body.classList.toggle("dark", dark);
  themeBtn.textContent = dark ? "☀" : "☾";
  themeBtn.setAttribute("aria-pressed", String(dark));
  themeBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
}

function restoreTheme() {
  let dark = false;
  try { dark = localStorage.getItem("theme") === "dark"; } catch (_) {}
  applyTheme(dark);
}

themeBtn.addEventListener("click", () => {
  const dark = !document.body.classList.contains("dark");
  applyTheme(dark);
  try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch (_) {}
});

init();
