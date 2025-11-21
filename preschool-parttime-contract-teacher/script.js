// 251121 졸리다


// ===== 공통 헬퍼 =====
function $(id) { return document.getElementById(id); }
function toNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

// 원단위 절삭 (ex: 11,111원 → 11,110원)
function floorTo10(v) {
  const n = Number(v) || 0;
  return Math.floor(n / 10) * 10;
}

// 날짜 파싱
function parseDate(str) {
  if (!str) return null;
  const d = new Date(str + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return d;
}

// 두 날짜 사이 일수(포함)
function diffDaysInclusive(s, e) {
  const ms = e - s;
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

// 금액 포맷
function formatWon(v) { return Number(v).toLocaleString("ko-KR") + "원"; }

// ===== 시간·비례 상수 =====
const WEEK_HOURS_SEM = 20;
const WEEK_HOURS_VAC = 40;
const WEEK_TO_MONTH = 4.345;

const FAMILY_SPOUSE = 40000;
const MEAL_8H = 140000, MEAL_4H = 70000;
const TEACH_ALLOW_8H = 250000, TEACH_ALLOW_4H = 125000;

// ===== 경력연수·수당 =====
function getCareerYearsFloat() {
  const y = toNumber($("careerYears")?.value);
  const m = toNumber($("careerMonths")?.value);
  const d = toNumber($("careerDays")?.value);
  return y + m / 12 + d / 365;
}

// 교원연구비
function calcTeacherResearchFull(yrs) {
  return yrs >= 5 ? 60000 : 75000;
}

// 정근수당 가산금 (예시 구간형)
function calcLongevityAddonFullMonthly(yrs) {
  if (yrs >= 20) return 80000;
  if (yrs >= 15) return 60000;
  if (yrs >= 10) return 40000;
  if (yrs >= 5) return 20000;
  return 0;
}

// 가족수당 (정상근무 월액)
function calcFamilyFullMonthly() {
  const spouse = document.querySelector(`input[name="spouseFlag"]:checked`)?.value === "Y";

  const f1 = document.querySelector(`input[name="firstChildFlag"]:checked`)?.value === "Y";
  const f2 = document.querySelector(`input[name="secondChildFlag"]:checked`)?.value === "Y";
  const f3 = document.querySelector(`input[name="thirdChildFlag"]:checked`)?.value === "Y";
  let cnt3 = toNumber($("childThirdCount")?.value);
  if (cnt3 < 0) cnt3 = 0;

  let childCount = 0;
  if (f1) childCount++;
  if (f2) childCount++;
  if (f3 && cnt3 > 0) childCount += cnt3;

  let total = 0;
  if (spouse) total += FAMILY_SPOUSE;
  if (childCount === 1) total += 50000;
  else if (childCount === 2) total += 80000;
  else if (childCount >= 3) total += 120000;

  return total;
}

// ===== 수당 자동 반영 =====
function applyAutoAllowances() {
  const rows = document.querySelectorAll(".allowance-row");
  const yrs = getCareerYearsFloat();
  const fullFamily = calcFamilyFullMonthly();
  const fullResearch = calcTeacherResearchFull(yrs);
  const fullLongevity = calcLongevityAddonFullMonthly(yrs);

  rows.forEach((row) => {
    const name = (row.querySelector(".allow-name")?.value || "").trim();
    const sem = row.querySelector(".allow-semester");
    const vac = row.querySelector(".allow-vacation");

    if (name === "정액급식비") { sem.value = MEAL_4H; vac.value = MEAL_8H; }
    else if (name === "교직수당") { sem.value = TEACH_ALLOW_4H; vac.value = TEACH_ALLOW_8H; }
    else if (name === "가족수당") {
      sem.value = fullFamily ? floorTo10(fullFamily * 0.5) : "";
      vac.value = fullFamily ? floorTo10(fullFamily) : "";
    } else if (name === "교원연구비") {
      sem.value = fullResearch ? floorTo10(fullResearch * 0.5) : "";
      vac.value = fullResearch ? floorTo10(fullResearch) : "";
    } else if (name === "정근수당 가산금") {
      sem.value = fullLongevity ? floorTo10(fullLongevity * 0.5) : "";
      vac.value = fullLongevity ? floorTo10(fullLongevity) : "";
    }
  });
}

// ===== 기본급 및 시간단가 =====
function buildBasePay() {
  const base8 = toNumber($("basePay8")?.value);
  if (!base8) return null;

  const base4Sem = base8 / 2, base8Vac = base8;
  applyAutoAllowances();

  let allowSem = 0, allowVac = 0;
  document.querySelectorAll(".allowance-row").forEach((r) => {
    allowSem += toNumber(r.querySelector(".allow-semester")?.value);
    allowVac += toNumber(r.querySelector(".allow-vacation")?.value);
  });

  const semMonthHours = WEEK_HOURS_SEM * WEEK_TO_MONTH;
  const vacMonthHours = WEEK_HOURS_VAC * WEEK_TO_MONTH;

  return {
    base8, base4Sem, base8Vac,
    semHour: (base4Sem + allowSem) / semMonthHours,
    vacHour: (base8Vac + allowVac) / vacMonthHours,
    allowSem, allowVac,
  };
}

// ===== 날짜 구간 구분 =====
const DAY_SEM = "SEM", DAY_VAC = "VAC", DAY_NOAF = "NOAF";

function buildRanges(query, sClass, eClass) {
  const arr = [];
  document.querySelectorAll(query).forEach((r) => {
    const s = parseDate(r.querySelector("." + sClass)?.value);
    const e = parseDate(r.querySelector("." + eClass)?.value);
    if (s && e && e >= s) arr.push({ start: s, end: e });
  });
  return arr;
}

function inRange(date, ranges) {
  const t = date.getTime();
  return ranges.some(r => t >= r.start && t <= r.end);
}

// ===== 2단계: 월별 일수 =====
function buildMonthTable() {
  const s = parseDate($("contractStart")?.value);
  const e = parseDate($("contractEnd")?.value);
  const msg = $("monthError"), wrap = $("monthTableWrap");
  msg.textContent = ""; wrap.innerHTML = "";
  if (!s || !e || e < s) { msg.textContent = "근로계약 시작·종료일자를 정확히 입력하세요."; return; }

  const vac = buildRanges("#vacationBody tr", "vac-start", "vac-end");
  const noAf = buildRanges("#noAfBody tr", "noaf-start", "noaf-end");

  const map = new Map();
  let cur = new Date(s.getTime());
  while (cur <= e) {
    const ym = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}`;
    if (!map.has(ym)) map.set(ym, { sem:0, vac:0, noaf:0 });

    if (inRange(cur, vac)) map.get(ym).vac++;
    else if (inRange(cur, noAf)) map.get(ym).noaf++;
    else map.get(ym).sem++;

    cur.setDate(cur.getDate()+1);
  }

  let html = `<div class="table-wrap"><table><thead><tr>
  <th>월</th><th>학기중(4h)</th><th>방학(8h)</th><th>미운영(4h)</th></tr></thead><tbody>`;
  [...map.keys()].sort().forEach(ym=>{
    const d = map.get(ym);
    html += `<tr class="month-row" data-month="${ym}">
      <td>${ym}</td>
      <td><input type="number" class="sem-days" value="${d.sem}" /></td>
      <td><input type="number" class="vac-days" value="${d.vac}" /></td>
      <td><input type="number" class="noaf-days" value="${d.noaf}" /></td>
    </tr>`;
  });
  wrap.innerHTML = html + "</tbody></table></div>";
}

// ===== 정근수당 일할계산 (연 단위) =====
function autoFillAnnualLongevityBySchedule() {
  const base = toNumber($("longevityBaseAnnual")?.value);
  if (!base) return;
  const rows = document.querySelectorAll(".month-row");
  if (!rows.length) return;

  let days = 0;
  rows.forEach(r => {
    days += toNumber(r.querySelector(".sem-days")?.value)
          + toNumber(r.querySelector(".vac-days")?.value)
          + toNumber(r.querySelector(".noaf-days")?.value);
  });
  if (!days) return;

  const amt = floorTo10(base * (days / 365));
  document.querySelectorAll(".annual-row").forEach(r => {
    if ((r.querySelector(".annual-name")?.value || "").trim() === "정근수당")
      r.querySelector(".annual-amount").value = amt;
  });
}

// ===== 3단계: 월별 계산 + 산재보험 + 퇴직금 =====
function calcMonthly() {
  const base = buildBasePay();
  const err = $("calcError"), wrap = $("resultWrap");
  err.textContent = ""; wrap.innerHTML = "";
  if (!base) { err.textContent = "1단계를 먼저 실행하세요."; return; }

  if (!document.querySelector(".month-row")) {
    err.textContent = "2단계를 먼저 실행하세요."; return;
  }

  autoFillAnnualLongevityBySchedule();

  // 기관부담 비율(학교 적용)
  const R_PEN = 0.045, R_HEAL = 0.03545;
  const R_LTC = 0.1267 * R_HEAL;
  const R_EMP = 0.0175;
  const R_IND = 0.00966; 

  let totalW = 0, totalA = 0, totalINS = 0, totalDays = 0;

  let annualTotal = 0;
  document.querySelectorAll(".annual-row").forEach(r => {
    annualTotal += toNumber(r.querySelector(".annual-amount")?.value);
  });

  const rows = document.querySelectorAll(".month-row");
  const perMonthAnnual = floorTo10(annualTotal / rows.length);

  let htmlRows = "";
  rows.forEach(r => {
    const ym = r.getAttribute("data-month");
    const sem = toNumber(r.querySelector(".sem-days")?.value);
    const vac = toNumber(r.querySelector(".vac-days")?.value);
    const noAf = toNumber(r.querySelector(".noaf-days")?.value);
    const dsum = sem + vac + noAf; totalDays += dsum;

    let wage = 0;
    if (vac === 0 && noAf === 0 && sem > 0) {
      wage = floorTo10(base.base4Sem + base.allowSem);
    } else {
      wage = floorTo10(
        base.semHour * (sem + noAf) * 4 +
        base.vacHour * vac * 8
      );
    }

    totalW += wage;
    totalA += perMonthAnnual;

    const orgP = wage * R_PEN;
    const orgH = wage * R_HEAL;
    const orgL = wage * R_LTC;
    const orgE = wage * R_EMP;
    const orgI = wage * R_IND;
    const orgSum = floorTo10(orgP + orgH + orgL + orgE + orgI);
    totalINS += orgSum;

    htmlRows += `<tr>
      <td>${ym}</td><td>${sem}</td><td>${vac}</td><td>${noAf}</td>
      <td>${formatWon(wage)}</td><td>${formatWon(perMonthAnnual)}</td>
      <td>${formatWon(wage + perMonthAnnual)}</td>
      <td>${formatWon(orgSum)}</td>
    </tr>`;
  });

  wrap.innerHTML = `
<div class="table-wrap"><table><thead><tr>
<th>월</th><th>학기중</th><th>방학</th><th>미운영</th>
<th>월 임금</th><th>연단위 분배</th><th>총 지급</th><th>기관부담(4대+산재)</th>
</tr></thead><tbody>${htmlRows}</tbody>
<tfoot><tr><th colspan="4">합계</th>
<th>${formatWon(totalW)}</th>
<th>${formatWon(totalA)}</th>
<th>${formatWon(totalW + totalA)}</th>
<th>${formatWon(totalINS)}</th></tr></tfoot></table></div>`;

  // ===== 퇴직금 ≥ 365일 =====
  const s = parseDate($("contractStart")?.value);
  const e = parseDate($("contractEnd")?.value);
  if (s && e) {
    const days = diffDaysInclusive(s, e);
    if (days >= 365 && totalDays > 0) {
      const daily = (totalW + totalA) / totalDays;
      const retire = floorTo10(daily * 30);
      wrap.innerHTML += `
      <div class="card">
        <b>퇴직금(1년 이상)</b>: ${formatWon(retire)}<br/>
        <span class="hint">계약기간 ${days}일 기준</span>
      </div>`;
    } else {
      wrap.innerHTML += `<div class="card">퇴직금 대상 아님 (계약일수 ${days}일)</div>`;
    }
  }
}

// ===== 행 추가 =====
function addAllowanceRow() {
  $("allowanceBody").insertAdjacentHTML("beforeend", `
<tr class="allowance-row">
<td><input type="text" class="allow-name" placeholder="수당명"></td>
<td><input type="number" class="allow-semester"></td>
<td><input type="number" class="allow-vacation"></td></tr>`);
}
function addAnnualRow() {
  $("annualBody").insertAdjacentHTML("beforeend", `
<tr class="annual-row">
<td><input type="text" class="annual-name"></td>
<td><input type="number" class="annual-amount"></td></tr>`);
}
function addVacRow() {
  $("vacationBody").insertAdjacentHTML("beforeend", `
<tr><td><input type="date" class="vac-start"></td>
<td><input type="date" class="vac-end"></td>
<td><input type="text" class="vac-note"></td></tr>`);
}
function addNoAfRow() {
  $("noAfBody").insertAdjacentHTML("beforeend", `
<tr><td><input type="date" class="noaf-start"></td>
<td><input type="date" class="noaf-end"></td>
<td><input type="text" class="noaf-note"></td></tr>`);
}

// ===== 구비서류 =====
const DOC_GUIDES = {
  "time-part": ["교원자격증 사본","행정정보공동이용 동의서","가족 채용 제한 확인서","성범죄·아동학대 조회 동의서","건강검진서","경력증명서(해당자)"],
  "retired": ["건강검진서","경력증명서(과목 필수)","성범죄·아동학대 조회","마약류 검사","가족 채용 제한 확인서"]
};
function renderDocGuide() {
  const key = $("docTypeSelect")?.value;
  const arr = DOC_GUIDES[key] || [];
  $("docGuide").innerHTML = `<ul>${arr.map(i=>`<li>${i}</li>`).join("")}</ul>`;
}

// ===== DOM =====
document.addEventListener("DOMContentLoaded", () => {
  // 호봉 선택 시 TeacherStepCore 적용
  $("stepSelect")?.addEventListener("change", () => {
    const v = $("stepSelect").value;
    if (typeof TeacherStepCore !== "undefined") {
      const pay = TeacherStepCore.getMonthlyBasePay8h(v);
      if (pay) $("basePay8").value = pay;
    }
    const b = buildBasePay();
    $("basePay4Sem").value = b ? Math.round(b.base4Sem) : "";
    $("basePay8Vac").value = b ? Math.round(b.base8Vac) : "";
  });

  // 1단계
  $("stepBaseBtn")?.addEventListener("click", () => {
    const b = buildBasePay();
    if (b) {
      $("basePay4Sem").value = Math.round(b.base4Sem);
      $("basePay8Vac").value = Math.round(b.base8Vac);
    }
  });

  $("addAllowBtn")?.addEventListener("click", addAllowanceRow);
  $("addAnnualBtn")?.addEventListener("click", addAnnualRow);
  $("addVacBtn")?.addEventListener("click", addVacRow);
  $("addNoAfBtn")?.addEventListener("click", addNoAfRow);

  $("buildMonthBtn")?.addEventListener("click", buildMonthTable);
  $("calcBtn")?.addEventListener("click", calcMonthly);

  ["careerYears","careerMonths","careerDays","childThirdCount"]
    .forEach(id => $(id)?.addEventListener("input", buildBasePay));
  ["spouseFlag","firstChildFlag","secondChildFlag","thirdChildFlag"]
    .forEach(n => document.querySelectorAll(`input[name="${n}"]`)
    .forEach(el=>el.addEventListener("change", buildBasePay)));

  $("docTypeSelect")?.addEventListener("change", renderDocGuide);
  renderDocGuide();
});
