const fmt = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

    const BASE_YEAR = 2026;

    const CHART_THEME = {
      plan: "#00e676",
      planFill: "rgba(0, 230, 118, 0.18)",
      grid: "rgba(255, 255, 255, 0.06)",
      ticks: "#a8a8a8",
      tooltipBg: "#1e1e1e",
      tooltipBorder: "rgba(0, 230, 118, 0.3)",
      pointBorder: "#1e1e1e",
      retirement: "#00c853",
      house: "#ffb74d",
      ss: "#64b5f6",
      inflow: "#ce93d8",
      realDollars: "#ffb74d",
      realDollarsDim: "rgba(255, 183, 77, 0.45)",
      nominalLabel: "#00e676",
      sorrBad: "#ff7043",
      sorrBadFill: "rgba(255, 112, 67, 0.2)",
      sorrGood: "#4dd0e1",
    };

    const MC_TRIALS = 300;
    const MC_RETURN_VOLATILITY = 0.11;
    const TABLE_PREVIEW_YEARS = 18;
    const PLANNER_VIEW_STORAGE_KEY = "retirementPlannerViewMode";
    const PLANNER_SETTINGS_STORAGE_KEY = "retirementPlannerSettings";
    const PLANNER_SETTINGS_VERSION = 1;
    let settingsToastTimer = null;
    let tableExpanded = false;
    let plannerViewMode = "simple";
    const SS_ANNUAL = 13200;
    
    const EUR_USD = 1.08;

        
    const PRIVATE_TRAVEL_TIER_LABELS = {
      300: "Supplemental",
      500: "Basic",
      650: "Comfort",
      800: "Premium",
    };
    const US_HEALTHCARE_COUPLE_EST = 18000;
    const STANDARD_DEDUCTION_MFJ = 30400;
    const SS_TAXABLE_PORTION = 0.85;
    const ITALY_FLAT_RATE = 0.07;
    const ITALY_REGIONAL_SURCHARGE = 0.015;

    const ITALY_IRPEF_BRACKETS = [
      { upTo: 28000, rate: 0.23 },
      { upTo: 50000, rate: 0.35 },
      { upTo: Infinity, rate: 0.43 },
    ];

    const MFJ_BRACKETS = [
      { upTo: 24800, rate: 0.10 },
      { upTo: 100800, rate: 0.12 },
      { upTo: 211400, rate: 0.22 },
      { upTo: 403550, rate: 0.24 },
      { upTo: 512450, rate: 0.32 },
      { upTo: 768700, rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ];

    const PLAN_NAME = "Your Retirement Plan";

    const ADVANCED_TOGGLE_LABELS = {
      showMonteCarlo: "Monte Carlo",
      showSorrAnalysis: "SORR",
      showSorrOnChart: "SORR chart",
      showInflationImpact: "Inflation",
      showDetailedTax: "Tax detail",
      showWithdrawalRules: "Withdrawal rules",
    };
    const PLAN_DEFAULT = {
      spending: 4000,
      house: 0,
      houseYear: 2032,
      ssStartAge: 62,
      returnRate: 6.5,
      inflows: { inflow1: 0, inflow2: 0, inflow3: 0, inflow4: 0 },
      inflowYears: { inflow1: 2032, inflow2: 2042, inflow3: 0, inflow4: 0 },
      annualDonations: 0,
      specialOutflowAmount: 0,
      specialOutflowYear: 0,
    };

    const inputs = [
      "inflow1Year", "inflow2Year", "inflow3Year", "inflow4Year", "specialOutflowYear",
      "ssStartAge", "inflateSpending",
      "healthcarePublicEur", "extraPrivateHealthcare",
      "assumeFlatTaxRegime",
    ];

    const PLAIN_NUMERIC_FIELDS = [
      { id: "age", min: 40, max: 90, integer: true },
      { id: "lifeExpectancy", min: 70, max: 100, integer: true },
      { id: "houseYear", min: 2026, max: 2050, integer: true },
    ];

    const INFLOW_DEFS = [
      { id: "inflow1", label: "House sale", displayName: "House Sale", summaryLabel: "House Sale Inflow", optionalYear: false },
      { id: "inflow2", label: "Inheritance / other", displayName: "Inheritance", summaryLabel: "Inheritance / Other", optionalYear: false },
      { id: "inflow3", label: "Other Income / Windfall 1", displayName: "Windfall 1", summaryLabel: "Other Income / Windfall 1", optionalYear: true },
      { id: "inflow4", label: "Other Income / Windfall 2", displayName: "Windfall 2", summaryLabel: "Other Income / Windfall 2", optionalYear: true },
    ];

    const INFLOW_DEFAULT_YEARS = { inflow1: 2032, inflow2: 2042, inflow3: 0, inflow4: 0 };
    const INFLOW_SLIDER_MIN = 0;
    const INFLOW_SLIDER_MAX = 100000000;

    const SORR_EARLY_RETIREMENT_YEARS = 10;
    const SORR_BAD_EARLY_OFFSET = 0.045;
    const SORR_GOOD_EARLY_OFFSET = 0.035;
    const SORR_GOOD_EARLY_CAP = 0.11;

    const SORR_SCENARIOS = [
      {
        id: "base",
        label: "Base (Average returns)",
        desc: "Your average return every year",
        rowClass: "sorr-row-base",
      },
      {
        id: "bad",
        label: "Bad Early Sequence",
        desc: "Poor returns in the first 10 retirement years, then average",
        rowClass: "sorr-row-bad",
      },
      {
        id: "good",
        label: "Good Early Sequence",
        desc: "Strong returns in the first 10 retirement years, then average",
        rowClass: "sorr-row-good",
      },
    ];
    const INFLOW_SLIDER_STEP = 100000;
    const INFLOW_INPUT_STEP = 1;

    let chart = null;
    let lastChartDisplayMode = null;
    let chartTooltipAge = 50;
    let debounceTimer = null;
    let applyingWhatIf = false;
    let activeWhatIfPreset = "original";

    const WHAT_IF_PRESETS = {
      original: { retirementAge: 65, resetPlan: true },
      early: { retirementAge: 62, resetPlan: false },
      later: { retirementAge: 67, resetPlan: false },
    };

    function planStateFromDefaults(defaults = PLAN_DEFAULT) {
      return {
        spending: defaults.spending,
        house: defaults.house,
        houseYear: defaults.houseYear,
        ssStartAge: defaults.ssStartAge,
        returnRate: defaults.returnRate,
        inflows: { ...PLAN_DEFAULT.inflows, ...defaults.inflows },
        inflowYears: { ...PLAN_DEFAULT.inflowYears, ...defaults.inflowYears },
        annualDonations: defaults.annualDonations ?? 0,
        specialOutflowAmount: defaults.specialOutflowAmount ?? 0,
        specialOutflowYear: defaults.specialOutflowYear ?? 0,
      };
    }

    let planState = planStateFromDefaults();
    const committedNumericValues = new Map();

    function parseNumericInput(raw, allowEmpty = false) {
      if (raw == null) return allowEmpty ? null : 0;
      const cleaned = String(raw).replace(/[$,\s]/g, "").trim();
      if (cleaned === "" || cleaned === "-" || cleaned === ".") return allowEmpty ? null : 0;
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : (allowEmpty ? null : 0);
    }

    function formatCurrencyDisplay(value) {
      const n = Math.round(Number(value) || 0);
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
    }

    function formatDecimalDisplay(value, places = 1) {
      return (Math.round((Number(value) || 0) * Math.pow(10, places)) / Math.pow(10, places)).toFixed(places);
    }

    function getNumericBounds(el, slider = null) {
      return {
        min: Number(el.dataset.min ?? el.min ?? slider?.min ?? -Infinity),
        max: Number(el.dataset.max ?? el.max ?? slider?.max ?? Infinity),
        step: Number(el.dataset.step ?? el.step ?? slider?.step ?? 1),
      };
    }

    function isCurrencyInput(el) {
      return el?.classList?.contains("currency-num-input");
    }

    function formatInputDisplay(el, value, binding = null) {
      if (binding?.decimal) return formatDecimalDisplay(value, 1);
      if (isCurrencyInput(el)) return formatCurrencyDisplay(value);
      return String(Math.round(Number(value) || 0));
    }

    function readNumericField(id, fallback = 0) {
      const el = document.getElementById(id);
      if (!el) return fallback;
      const parsed = parseNumericInput(el.value, true);
      if (parsed !== null) return parsed;
      const committed = committedNumericValues.get(id);
      if (committed != null && Number.isFinite(committed)) return committed;
      return fallback;
    }

    function setNumericFieldDisplay(id, value, binding = null) {
      const el = document.getElementById(id);
      if (!el) return;
      const num = Number(value);
      if (!Number.isFinite(num)) return;
      committedNumericValues.set(id, num);
      if (el !== document.activeElement) {
        el.value = formatInputDisplay(el, num, binding);
      }
    }

    function clampRetirementAge(age) {
      return Math.min(75, Math.max(50, Math.round(age)));
    }

    function readRetirementAge() {
      return clampRetirementAge(readNumericField("retirementAge", 65));
    }



    function getInflowYearBounds() {
      const age = Number(document.getElementById("age").value) || 50;
      const life = Number(document.getElementById("lifeExpectancy").value) || 90;
      return { min: BASE_YEAR, max: BASE_YEAR + (life - age) };
    }

    function getInflowYearOptions() {
      const { min, max } = getInflowYearBounds();
      const presets = [2028, 2030, 2032, 2035, 2040, 2042, 2045, 2050, 2055, 2060, 2065];
      const years = new Set();
      presets.forEach((y) => { if (y >= min && y <= max) years.add(y); });
      for (let y = min; y <= max; y += 2) years.add(y);
      return [...years].sort((a, b) => a - b);
    }

    function buildYearSelectOptions(options, current, allowNone = false) {
      let years = allowNone ? [0, ...options] : [...options];
      if (current > 0 && !years.includes(current)) {
        years = [...years, current].sort((a, b) => a - b);
      }
      return years.map((y) => {
        const label = y === 0 ? "None" : String(y);
        return `<option value="${y}"${y === current ? " selected" : ""}>${label}</option>`;
      }).join("");
    }

    function syncInflowYearSelects() {
      const options = getInflowYearOptions();
      INFLOW_DEFS.forEach(({ id, optionalYear }) => {
        const sel = document.getElementById(`${id}Year`);
        if (!sel) return;
        const stored = Number(sel.value);
        const defaultYear = INFLOW_DEFAULT_YEARS[id] ?? 0;
        const current = optionalYear
          ? (Number.isFinite(stored) ? stored : defaultYear)
          : (stored || defaultYear || options[0] || BASE_YEAR);
        sel.innerHTML = buildYearSelectOptions(options, current, optionalYear);
      });
      syncSpecialOutflowYearSelect();
    }

    function syncSpecialOutflowYearSelect() {
      const sel = document.getElementById("specialOutflowYear");
      if (!sel) return;
      const options = getInflowYearOptions();
      const stored = Number(sel.value);
      const current = Number.isFinite(stored) ? stored : 0;
      sel.innerHTML = buildYearSelectOptions(options, current, true);
    }

    function syncInflowYearBounds() {
      syncInflowYearSelects();
    }

    function readInflowsFromForm() {
      const inflows = {};
      const inflowYears = {};
      INFLOW_DEFS.forEach(({ id }) => {
        inflows[id] = readNumericField(`${id}Amount`, 0);
        inflowYears[id] = Number(document.getElementById(`${id}Year`).value);
      });
      return { inflows, inflowYears };
    }

    function getInflowsFromState(state) {
      return INFLOW_DEFS.map(({ id, label, displayName }) => ({
        id,
        label,
        displayName: displayName || label,
        amount: state.inflows?.[id] ?? 0,
        year: state.inflowYears?.[id] ?? INFLOW_DEFAULT_YEARS[id],
      })).filter((i) => i.amount > 0 && i.year >= BASE_YEAR);
    }

    function isActiveSpecialOutflow(params) {
      return (params.specialOutflowAmount ?? 0) > 0
        && (params.specialOutflowYear ?? 0) >= BASE_YEAR;
    }




    function buildPlanMilestonesFootnote(params, end) {
      return buildPlanNarrative(params, end).footnote;
    }


    function getInflowsForYear(params, calendarYear) {
      return params.inflows.filter((i) => i.year === calendarYear);
    }

    function getPrivateTravelMonthly(params) {
      const tier = Number(params.privateTravelTier);
      return tier > 0 ? tier : 0;
    }


    function getPrivateTravelTierLabel(monthly) {
      return PRIVATE_TRAVEL_TIER_LABELS[monthly] || null;
    }

    function getTotalMonthlySpending(params) {
      const supplement = params.extraPrivateHealthcare
        ? (params.locationRegion === "us" ? US_SUPPLEMENT_MONTHLY : PRIVATE_HEALTHCARE_MONTHLY)
        : 0;
      return Math.round(params.spending + supplement);
    }























    function balanceAtAge(rows, age) {
      const row = rows.find((r) => r.age === age);
      return row ? row.endBalance : null;
    }

    function afterHouseBalance(rows, params) {
      if (params.house <= 0) return null;
      const houseRow = rows.find((r) => r.calendarYear === params.houseYear);
      return houseRow ? houseRow.endBalance : null;
    }

    function getProbabilityOfSuccess(rows, params) {
      const depletedRow = rows.find((r) => r.depleted);
      const row90 = rows.find((r) => r.age === 90);
      const lastRow = rows[rows.length - 1];
      const endRow = row90 || lastRow;

      if (!depletedRow && endRow.age >= 90 && endRow.endBalance >= 500000) {
        return { label: "99%+", className: "high", note: "Strong surplus at 90" };
      }
      if (!depletedRow && endRow.age >= 90 && endRow.endBalance > 100000) {
        return { label: "98%+", className: "high", note: "Fully funded at 90" };
      }
      if (!depletedRow && endRow.age >= params.lifeExpectancy && endRow.endBalance > 0) {
        return { label: "97%+", className: "high", note: "Plan completes with funds" };
      }
      if (depletedRow) {
        const fundedYears = depletedRow.age - params.retirementAge;
        const planYears = params.lifeExpectancy - params.retirementAge;
        const pct = Math.max(10, Math.round((fundedYears / planYears) * 100));
        return { label: `${pct}%`, className: "low", note: `Depletes age ${depletedRow.age}` };
      }
      return { label: "90%+", className: "high", note: "On track" };
    }

    function calcFederalTax(taxableIncome) {
      const income = Math.max(0, taxableIncome - STANDARD_DEDUCTION_MFJ);
      let tax = 0;
      let prev = 0;
      for (const bracket of MFJ_BRACKETS) {
        const inBracket = Math.min(income, bracket.upTo) - prev;
        if (inBracket <= 0) break;
        tax += inBracket * bracket.rate;
        prev = bracket.upTo;
        if (income <= bracket.upTo) break;
      }
      return tax;
    }

    function getSpendingMultiplier(params, yearIndex) {
      if (!params.inflateSpending) return 1;
      return Math.pow(1 + params.inflation, Math.max(0, yearIndex));
    }


    const SLIDER_BINDINGS = [
      { sliderId: "sliderSpending", inputId: "spending",
        round: (v, step) => Math.round(v / step) * step },
      { sliderId: "sliderRetirementAge", inputId: "retirementAge",
        round: (v) => clampRetirementAge(v) },
      { sliderId: "sliderReturnRate", inputId: "returnRate",
        round: (v, step) => Math.round(v / step) * step, decimal: true },
      { sliderId: "sliderInflation", inputId: "inflation",
        round: (v, step) => Math.round(v / step) * step, decimal: true },
      { sliderId: "sliderInflow1", inputId: "inflow1Amount",
        round: (v) => clampInflowAmount(v) },
      { sliderId: "sliderInflow2", inputId: "inflow2Amount",
        round: (v) => clampInflowAmount(v) },
      { sliderId: "sliderInflow3", inputId: "inflow3Amount",
        round: (v) => clampInflowAmount(v) },
      { sliderId: "sliderInflow4", inputId: "inflow4Amount",
        round: (v) => clampInflowAmount(v) },
    ];

    function clampInflowAmount(amount, snapToSliderStep = false) {
      let val = Math.min(INFLOW_SLIDER_MAX, Math.max(INFLOW_SLIDER_MIN, Math.round(Number(amount) || 0)));
      if (snapToSliderStep) {
        val = Math.round(val / INFLOW_SLIDER_STEP) * INFLOW_SLIDER_STEP;
      }
      return val;
    }

    function inflowSliderPosition(amount) {
      return clampInflowAmount(amount, true);
    }

    function syncInflowSliderBounds() {
      INFLOW_DEFS.forEach(({ id }) => {
        const slider = document.getElementById(`slider${id.charAt(0).toUpperCase()}${id.slice(1)}`);
        const amountInput = document.getElementById(`${id}Amount`);
        if (!slider || !amountInput) return;
        slider.min = INFLOW_SLIDER_MIN;
        slider.max = INFLOW_SLIDER_MAX;
        slider.step = INFLOW_SLIDER_STEP;
        amountInput.dataset.min = INFLOW_SLIDER_MIN;
        amountInput.dataset.max = INFLOW_SLIDER_MAX;
        amountInput.dataset.step = INFLOW_INPUT_STEP;
      });
    }

    function isInflowAmountInput(inputId) {
      return INFLOW_DEFS.some(({ id }) => inputId === `${id}Amount`);
    }

    function clampToInputRange(input, slider, binding) {
      const { min, max, step } = getNumericBounds(input, slider);
      let parsed = parseNumericInput(input.value, true);
      if (parsed === null) {
        const committed = committedNumericValues.get(input.id);
        parsed = committed != null && Number.isFinite(committed) ? committed : min;
      }
      let val = Math.min(max, Math.max(min, parsed));

      if (isInflowAmountInput(binding.inputId)) {
        val = clampInflowAmount(val, false);
      } else if (binding.inputId === "retirementAge") {
        val = clampRetirementAge(val);
      } else if (binding.decimal) {
        val = binding.round(val, step);
      } else if (binding.round) {
        val = binding.round(val, step);
      }

      return val;
    }

    function updateSliderFill(slider) {
      const min = Number(slider.min);
      const max = Number(slider.max);
      const val = Number(slider.value);
      const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
      slider.style.setProperty("--fill-pct", `${pct}%`);
    }

    function commitSliderInput(binding, { recalc = true } = {}) {
      const input = document.getElementById(binding.inputId);
      const slider = document.getElementById(binding.sliderId);
      if (!input || !slider) return null;

      const val = clampToInputRange(input, slider, binding);
      committedNumericValues.set(binding.inputId, val);
      input.value = formatInputDisplay(input, val, binding);
      slider.value = isInflowAmountInput(binding.inputId) ? inflowSliderPosition(val) : val;
      updateSliderFill(slider);
      if (recalc) {
        clearWhatIfHighlight();
        scheduleRecalculate();
      }
      return val;
    }

    function syncSliderFromInput(binding) {
      commitSliderInput(binding, { recalc: false });
    }

    function syncAllSliders() {
      SLIDER_BINDINGS.forEach(syncSliderFromInput);
      document.querySelectorAll("input[type='range'].premium-slider").forEach(updateSliderFill);
    }

    function clearWhatIfHighlight() {
      if (!applyingWhatIf) {
        document.querySelectorAll(".what-if-btn").forEach((btn) => btn.classList.remove("active"));
        activeWhatIfPreset = null;
      }
    }

    function sanitizeTypedNumeric(raw, binding, input) {
      if (isCurrencyInput(input)) {
        return raw.replace(/[^\d,]/g, "");
      }
      if (binding?.decimal) {
        const cleaned = raw.replace(/[^\d.]/g, "");
        const parts = cleaned.split(".");
        return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
      }
      return raw.replace(/[^\d]/g, "");
    }

    function bindSlider(binding) {
      const slider = document.getElementById(binding.sliderId);
      const input = document.getElementById(binding.inputId);
      if (!slider || !input) return;

      const initial = clampToInputRange(input, slider, binding);
      committedNumericValues.set(binding.inputId, initial);
      input.value = formatInputDisplay(input, initial, binding);
      slider.value = isInflowAmountInput(binding.inputId) ? inflowSliderPosition(initial) : initial;
      updateSliderFill(slider);

      input.addEventListener("focus", () => {
        const committed = committedNumericValues.get(binding.inputId);
        if (committed == null) return;
        if (isCurrencyInput(input)) {
          input.value = String(committed);
        } else if (binding.decimal) {
          input.value = formatDecimalDisplay(committed, 1);
        } else {
          input.value = String(committed);
        }
      });

      input.addEventListener("input", () => {
        const sanitized = sanitizeTypedNumeric(input.value, binding, input);
        if (sanitized !== input.value) {
          const pos = input.selectionStart;
          input.value = sanitized;
          if (pos != null) input.setSelectionRange(pos, pos);
        }

        const raw = input.value.trim();
        if (raw === "" || raw === "-" || raw === ".") return;

        const parsed = parseNumericInput(raw, true);
        if (parsed === null) return;

        const { min, max, step } = getNumericBounds(input, slider);
        let val = parsed;
        let sliderVal = parsed;
        if (isInflowAmountInput(binding.inputId)) {
          val = clampInflowAmount(parsed, false);
          sliderVal = inflowSliderPosition(val);
        } else if (binding.inputId === "retirementAge") {
          val = clampRetirementAge(parsed);
          sliderVal = val;
        } else if (binding.decimal) {
          val = binding.round(parsed, step);
          sliderVal = val;
        } else if (binding.round) {
          val = binding.round(parsed, step);
          sliderVal = val;
        } else {
          sliderVal = val;
        }

        if (val >= min && val <= max) {
          slider.value = sliderVal;
          committedNumericValues.set(binding.inputId, val);
          updateSliderFill(slider);
          clearWhatIfHighlight();
          scheduleRecalculate();
        }
      });

      input.addEventListener("blur", () => {
        commitSliderInput(binding);
      });

      input.addEventListener("change", () => {
        commitSliderInput(binding);
      });

      slider.addEventListener("input", () => {
        let val = Number(slider.value);
        if (binding.inputId === "retirementAge") {
          val = clampRetirementAge(val);
        } else if (isInflowAmountInput(binding.inputId)) {
          val = clampInflowAmount(val, false);
        }
        committedNumericValues.set(binding.inputId, val);
        input.value = formatInputDisplay(input, val, binding);
        updateSliderFill(slider);
        clearWhatIfHighlight();
        scheduleRecalculate();
      });
    }

    function commitPlainNumericField(config, { recalc = true } = {}) {
      const el = document.getElementById(config.id);
      if (!el) return null;

      let parsed = parseNumericInput(el.value, true);
      if (parsed === null) {
        const committed = committedNumericValues.get(config.id);
        parsed = committed != null && Number.isFinite(committed) ? committed : config.min;
      }

      let val = Math.min(config.max, Math.max(config.min, parsed));
      if (config.integer) val = Math.round(val);
      if (config.currency) val = Math.round(val);
      if (config.step && config.step > 1) {
        val = Math.round(val / config.step) * config.step;
      }

      committedNumericValues.set(config.id, val);
      el.value = config.currency
        ? formatCurrencyDisplay(val)
        : String(val);

      if (recalc) {
        clearWhatIfHighlight();
        scheduleRecalculate();
      }
      return val;
    }

    function bindPlainNumericField(config) {
      const el = document.getElementById(config.id);
      if (!el) return;

      const initial = commitPlainNumericField(config, { recalc: false });
      committedNumericValues.set(config.id, initial);

      el.addEventListener("focus", () => {
        const committed = committedNumericValues.get(config.id);
        if (committed != null) {
          el.value = config.currency ? String(committed) : String(committed);
        }
      });

      el.addEventListener("input", () => {
        if (config.currency) {
          const sanitized = el.value.replace(/[^\d,]/g, "");
          if (sanitized !== el.value) el.value = sanitized;
        } else if (config.integer) {
          const sanitized = el.value.replace(/[^\d]/g, "");
          if (sanitized !== el.value) el.value = sanitized;
        }

        const raw = el.value.trim();
        if (raw === "" || raw === "-") return;

        const parsed = parseNumericInput(raw, true);
        if (parsed === null) return;

        let val = Math.min(config.max, Math.max(config.min, parsed));
        if (config.integer) val = Math.round(val);
        if (config.currency) val = Math.round(val);

        committedNumericValues.set(config.id, val);
        clearWhatIfHighlight();
        scheduleRecalculate();
      });

      el.addEventListener("blur", () => commitPlainNumericField(config));
      el.addEventListener("change", () => commitPlainNumericField(config));
    }

    function bindCurrencyFieldsWithoutSlider() {
      const currencyFields = [
        { id: "k401", min: 0, max: 10000000, step: 1, currency: true },
        { id: "pension", min: 0, max: 10000000, step: 1, currency: true },
        { id: "house", min: 0, max: 5000000, step: 1000, currency: true },
        { id: "annualDonations", min: 0, max: 1000000, step: 1, currency: true },
        { id: "specialOutflowAmount", min: 0, max: 100000000, step: 1, currency: true },
      ];
      currencyFields.forEach(bindPlainNumericField);
    }

    function readScenarioFieldsFromForm() {
      const { inflows, inflowYears } = readInflowsFromForm();
      return {
        spending: readNumericField("spending", PLAN_DEFAULT.spending),
        house: readNumericField("house", 0),
        houseYear: readNumericField("houseYear", PLAN_DEFAULT.houseYear),
        ssStartAge: Number(document.getElementById("ssStartAge").value),
        returnRate: readNumericField("returnRate", PLAN_DEFAULT.returnRate),
        inflows,
        inflowYears,
        annualDonations: readNumericField("annualDonations", 0),
        specialOutflowAmount: readNumericField("specialOutflowAmount", 0),
        specialOutflowYear: Number(document.getElementById("specialOutflowYear")?.value) || 0,
      };
    }

    function syncPlanFromForm() {
      planState = readScenarioFieldsFromForm();
    }

    function getPlanSpending() {
      return readNumericField("spending", planState?.spending ?? PLAN_DEFAULT.spending);
    }

    function isAdvancedPlannerView() {
      return plannerViewMode === "advanced";
    }

    function setPlannerView(mode, { recalc = true } = {}) {
      plannerViewMode = mode === "advanced" ? "advanced" : "simple";
      document.body.classList.toggle("planner-view-simple", plannerViewMode === "simple");
      document.body.classList.toggle("planner-view-advanced", plannerViewMode === "advanced");

      document.querySelectorAll(".view-mode-btn").forEach((btn) => {
        const active = btn.dataset.view === plannerViewMode;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", String(active));
      });

      if (plannerViewMode === "simple") {
        switchDashboardTab("detail");
        const tableCard = document.getElementById("projectionTableCard");
        if (tableCard) {
          tableCard.classList.remove("collapsed");
          const toggleBtn = document.getElementById("toggleTableBtn");
          if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "true");
        }
      }

      try {
        sessionStorage.setItem(PLANNER_VIEW_STORAGE_KEY, plannerViewMode);
      } catch (_) { /* ignore */ }

      if (recalc) recalculate();
    }

    function initPlannerViewMode() {
      let saved = "simple";
      try {
        saved = sessionStorage.getItem(PLANNER_VIEW_STORAGE_KEY) || "simple";
      } catch (_) { /* ignore */ }
      setPlannerView(saved === "advanced" ? "advanced" : "simple", { recalc: false });
    }

    function getChartDisplayMode() {
      if (!isAdvancedPlannerView()) return "default";
      if (document.getElementById("showSorrOnChart").checked) return "sorr";
      if (document.getElementById("showInflationImpact").checked) return "inflation";
      return "default";
    }

    function switchDashboardTab(target) {
      document.querySelectorAll(".dashboard-tab").forEach((t) => {
        const active = t.dataset.tab === target;
        t.classList.toggle("active", active);
        t.setAttribute("aria-selected", String(active));
      });
      const panelMap = {
        detail: "tabPanelDetail",
        taxhealth: "tabPanelTaxhealth",
        compare: "tabPanelCompare",
      };
      Object.entries(panelMap).forEach(([key, panelId]) => {
        const panel = document.getElementById(panelId);
        if (panel) panel.classList.toggle("active", key === target);
      });
    }

    function focusAdvancedFeature(toggleId) {
      const panelMap = {
        showMonteCarlo: "monteCarloWrap",
        showSorrAnalysis: "sorrCard",
        showWithdrawalRules: "withdrawalRulesWrap",
        showInflationImpact: "inflationImpactBox",
        showDetailedTax: "taxDetailSection",
      };
      const targetId = panelMap[toggleId];
      if (!targetId) return;
      requestAnimationFrame(() => {
        const el = document.getElementById(targetId);
        if (el && !el.hidden) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });
    }

    function updateAdvancedOptionsBadge() {
      const active = Object.keys(ADVANCED_TOGGLE_LABELS).filter((id) => document.getElementById(id).checked);
      const badge = document.getElementById("advancedActiveBadge");
      const card = document.getElementById("advancedOptionsCard");
      const sub = document.getElementById("advancedOptionsSub");

      if (!badge || !card) return;

      if (active.length === 0) {
        badge.hidden = true;
        card.classList.remove("has-active");
        if (sub) sub.textContent = "Optional stress-tests & detail — off by default";
      } else {
        badge.hidden = false;
        badge.textContent = `${active.length} active`;
        card.classList.add("has-active");
        if (sub) {
          sub.textContent = active.map((id) => ADVANCED_TOGGLE_LABELS[id]).join(" · ");
        }
      }
    }


    function formatSpendingSummaryValue(params) {
      const base = Math.round(params.spending);
      const privateMonthly = getPrivateTravelMonthly(params);
      const total = getTotalMonthlySpending(params);
      if (privateMonthly > 0) {
        return `<span class="spending-total-primary">${fmt.format(total)} total</span>`
          + `<span class="spending-breakdown-secondary">(${fmt.format(base)} base + ${fmt.format(privateMonthly)} Private + Travel)</span>`;
      }
      return `<span class="spending-total-primary">${fmt.format(total)} total</span>`;
    }

    function formatHouseBuySummaryValue(params) {
      if (params.house <= 0) {
        return "None — living in wife's existing home";
      }
      return `${fmt.format(params.house)} (house + car + furnishings)`;
    }

    function formatHealthcareSummaryValue(params) {
      const publicEur = params.healthcarePublicEur;
      const privateMonthly = getPrivateTravelMonthly(params);
      const publicPart = `Public SSN €${publicEur.toLocaleString()}/yr`;
      if (privateMonthly <= 0) {
        return `${publicPart} · no private add-on`;
      }
      const tierLabel = PRIVATE_TRAVEL_TIER_LABELS[privateMonthly];
      const tierSuffix = tierLabel ? ` — ${tierLabel}` : "";
      return `${publicPart} + Private + Travel ${fmt.format(privateMonthly)}/mo${tierSuffix}`;
    }

    function getInflowSummaryItems(source = planState) {
      return INFLOW_DEFS.map(({ id, summaryLabel, optionalYear }) => {
        const amount = source.inflows?.[id] ?? 0;
        const year = source.inflowYears?.[id] ?? INFLOW_DEFAULT_YEARS[id];
        if (amount <= 0 || (optionalYear && year < BASE_YEAR)) {
          return { label: summaryLabel, value: "None" };
        }
        return { label: summaryLabel, value: `${fmt.format(amount)} in ${year}` };
      });
    }

    function getOutflowSummaryItems(params) {
      const donations = params.annualDonations ?? 0;
      const specialAmt = params.specialOutflowAmount ?? 0;
      const specialYear = params.specialOutflowYear ?? 0;
      return [
        {
          label: "Annual Donations / Gifts",
          value: donations > 0 ? `${fmt.format(donations)}/yr` : "None",
        },
        {
          label: "One-Time Special Outflow",
          value: specialAmt > 0 && specialYear >= BASE_YEAR
            ? `${fmt.format(specialAmt)} in ${specialYear}`
            : "None",
        },
      ];
    }

    function getMonteCarloSuccessLabel(successPct) {
      if (successPct >= 90) return "Excellent";
      if (successPct >= 75) return "Good";
      if (successPct >= 50) return "Moderate";
      return "At risk";
    }

    function getMonteCarloSuccessClass(successPct) {
      if (successPct >= 90) return "high";
      if (successPct >= 75) return "mid";
      return "low";
    }

    function formatMcBalanceCompact(amount) {
      if (amount == null || Number.isNaN(amount)) return "—";
      if (amount >= 1_000_000) return fmtMillions(amount);
      if (amount >= 1000) return `$${Math.round(amount / 1000)}k`;
      return fmt.format(amount);
    }

    function updateCurrentPlanSummaryMonteCarlo(mc) {
      const successEl = document.getElementById("planSummaryMcSuccess");
      const badgeEl = document.getElementById("planSummaryMcSuccessBadge");
      const medianEl = document.getElementById("planSummaryMcMedian");
      const rangeEl = document.getElementById("planSummaryMcRange");
      if (!mc || !successEl || !medianEl || !rangeEl) return;

      const successClass = getMonteCarloSuccessClass(mc.successPct);
      successEl.textContent = `${mc.successPct}%`;
      successEl.className = `current-plan-summary-mc-value mc-success-${successClass}`;

      if (badgeEl) {
        badgeEl.textContent = `(${getMonteCarloSuccessLabel(mc.successPct)})`;
        badgeEl.className = `current-plan-summary-mc-badge mc-success-${successClass}`;
      }

      medianEl.textContent = formatMcBalanceCompact(mc.p50);
      rangeEl.textContent = `${formatMcBalanceCompact(mc.p10)} – ${formatMcBalanceCompact(mc.p90)}`;
    }


    function revealAdvancedAnalysisPanel(toggleId) {
      const wrap = document.getElementById("advancedAnalysisWrap");
      if (!wrap) return;
      wrap.hidden = false;
      wrap.classList.add("open");
      const headerBtn = document.getElementById("advancedAnalysisToggle");
      if (headerBtn) headerBtn.setAttribute("aria-expanded", "true");

      const panelMap = {
        showMonteCarlo: "monteCarloWrap",
        showSorrAnalysis: "sorrCard",
        showWithdrawalRules: "withdrawalRulesWrap",
      };
      const panelId = panelMap[toggleId];
      if (!panelId) return;
      const panel = document.getElementById(panelId);
      if (!panel) return;
      if (panel.classList.contains("collapsible-advanced")) {
        panel.classList.add("open");
        const toggle = panel.querySelector("[data-advanced-collapse]");
        if (toggle) toggle.setAttribute("aria-expanded", "true");
      }
    }

    function updateAdvancedPanels() {
      const mc = document.getElementById("showMonteCarlo").checked;
      const sorr = document.getElementById("showSorrAnalysis").checked;
      const tax = document.getElementById("showDetailedTax").checked;
      const wr = document.getElementById("showWithdrawalRules").checked;

      document.getElementById("monteCarloWrap").hidden = !mc;

      const sorrCard = document.getElementById("sorrCard");
      sorrCard.hidden = !sorr;

      document.getElementById("withdrawalRulesWrap").hidden = !wr;

      document.getElementById("taxDetailSection").hidden = !tax;
      document.getElementById("taxTabHint").hidden = tax;

      const analysisWrap = document.getElementById("advancedAnalysisWrap");
      const showAnalysis = mc || sorr || wr;
      if (analysisWrap) analysisWrap.hidden = !showAnalysis;

      const summaryEl = document.getElementById("advancedAnalysisSummary");
      if (summaryEl) {
        const parts = [];
        if (mc) parts.push("Monte Carlo");
        if (sorr) parts.push("SORR");
        if (wr) parts.push("Withdrawal rules");
        summaryEl.textContent = parts.length ? parts.join(" · ") : "Optional detail panels";
      }

      updateAdvancedOptionsBadge();
    }

    function handleAdvancedToggleChange(toggleId) {
      const el = document.getElementById(toggleId);
      const on = el.checked;

      if (toggleId === "showSorrOnChart" && on) {
        document.getElementById("showSorrAnalysis").checked = true;
        document.getElementById("showInflationImpact").checked = false;
      }
      if (toggleId === "showInflationImpact" && on) {
        document.getElementById("showSorrOnChart").checked = false;
      }

      updateAdvancedPanels();

      if (toggleId === "showDetailedTax" && on) {
        switchDashboardTab("taxhealth");
      }

      recalculate();

      if (on) {
        if (toggleId === "showSorrOnChart" || toggleId === "showInflationImpact") {
          requestAnimationFrame(() => {
            document.querySelector(".dashboard-primary-zone .dashboard-chart-section")
              ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          });
        } else if (toggleId === "showMonteCarlo" || toggleId === "showSorrAnalysis" || toggleId === "showWithdrawalRules") {
          revealAdvancedAnalysisPanel(toggleId);
          focusAdvancedFeature(toggleId);
        } else {
          focusAdvancedFeature(toggleId);
        }
      }
    }

    function getRetirementPortfolioBasis(row) {
      if (!row) return 0;
      return Math.max(0, row.startBalance + row.pensionAdd + row.inflowTotal - row.houseCost);
    }

    function fmtMillions(value) {
      if (value >= 1_000_000) {
        return "$" + (value / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
      }
      return fmt.format(value);
    }

    function buildParams() {
      const base = readBaseParams();
      const state = planState;
      return {
        ...base,
        spending: getPlanSpending(),
        house: state.house,
        houseYear: state.houseYear,
        ssStartAge: state.ssStartAge,
        returnRate: state.returnRate / 100,
        inflows: getInflowsFromState(state),
        annualDonations: state.annualDonations ?? 0,
        specialOutflowAmount: state.specialOutflowAmount ?? 0,
        specialOutflowYear: state.specialOutflowYear ?? 0,
        scenarioName: getPlanDisplayName(),
      };
    }


    function loadPlanIntoForm() {
      setNumericFieldDisplay("spending", planState.spending, SLIDER_BINDINGS.find((b) => b.inputId === "spending"));
      setNumericFieldDisplay("house", planState.house, { currency: true });
      setNumericFieldDisplay("houseYear", planState.houseYear);
      document.getElementById("ssStartAge").value = planState.ssStartAge;
      setNumericFieldDisplay("returnRate", planState.returnRate, SLIDER_BINDINGS.find((b) => b.inputId === "returnRate"));
      INFLOW_DEFS.forEach(({ id }) => {
        setNumericFieldDisplay(`${id}Amount`, planState.inflows?.[id] ?? 0, SLIDER_BINDINGS.find((b) => b.inputId === `${id}Amount`));
        document.getElementById(`${id}Year`).value = planState.inflowYears?.[id] ?? INFLOW_DEFAULT_YEARS[id];
      });
      setNumericFieldDisplay("annualDonations", planState.annualDonations ?? 0, { currency: true });
      setNumericFieldDisplay("specialOutflowAmount", planState.specialOutflowAmount ?? 0, { currency: true });
      const specialYearEl = document.getElementById("specialOutflowYear");
      if (specialYearEl) specialYearEl.value = planState.specialOutflowYear ?? 0;
      syncInflowYearSelects();
      syncAllSliders();
    }



    function isValidPlannerSettings(data) {
      if (!data || data.version !== PLANNER_SETTINGS_VERSION) return false;
      if (!data.base || !data.scenario) return false;
      const nums = [
        data.base.age, data.base.retirementAge, data.base.lifeExpectancy,
        data.base.k401, data.base.pension, data.base.inflation,
        data.scenario.spending, data.scenario.house, data.scenario.houseYear,
        data.scenario.returnRate,
      ];
      return nums.every((n) => Number.isFinite(Number(n)));
    }

    function clearWhatIfSelection() {
      document.querySelectorAll(".what-if-btn").forEach((btn) => btn.classList.remove("active"));
      activeWhatIfPreset = null;
    }

    function showSettingsToast(message) {
      const toast = document.getElementById("settingsSaveToast");
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add("visible");
      clearTimeout(settingsToastTimer);
      settingsToastTimer = setTimeout(() => toast.classList.remove("visible"), 2200);
    }


    function savePlannerSettings() {
      try {
        const data = collectPlannerSettings();
        localStorage.setItem(PLANNER_SETTINGS_STORAGE_KEY, JSON.stringify(data));
        showSettingsToast("Settings Saved");
      } catch (_) {
        showSettingsToast("Could not save settings");
      }
    }

    function loadPlannerSettings({ showFeedback = true } = {}) {
      try {
        const raw = localStorage.getItem(PLANNER_SETTINGS_STORAGE_KEY);
        if (!raw) {
          if (showFeedback) showSettingsToast("No saved settings found");
          return false;
        }
        const data = JSON.parse(raw);
        if (!applyPlannerSettings(data)) {
          if (showFeedback) showSettingsToast("Saved settings could not be loaded");
          return false;
        }
        if (showFeedback) showSettingsToast("Settings loaded");
        return true;
      } catch (_) {
        if (showFeedback) showSettingsToast("Saved settings could not be loaded");
        return false;
      }
    }

    function tryAutoLoadPlannerSettings() {
      return loadPlannerSettings({ showFeedback: false });
    }

    function resetPlanFromDefaults() {
      planState = planStateFromDefaults();
    }

    function setWhatIfButtonState(presetId) {
      document.querySelectorAll(".what-if-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.preset === presetId);
      });
      activeWhatIfPreset = presetId;
    }

    function applyWhatIfPreset(presetId) {
      const preset = WHAT_IF_PRESETS[presetId];
      if (!preset) return;

      applyingWhatIf = true;
      syncPlanFromForm();

      if (preset.resetPlan) {
        resetPlanFromDefaults();
        loadPlanIntoForm();
      }

      const retBinding = SLIDER_BINDINGS.find((b) => b.inputId === "retirementAge");
      if (retBinding) {
        committedNumericValues.set("retirementAge", preset.retirementAge);
        document.getElementById("retirementAge").value = String(preset.retirementAge);
        document.getElementById("sliderRetirementAge").value = preset.retirementAge;
        updateSliderFill(document.getElementById("sliderRetirementAge"));
      }
      setWhatIfButtonState(presetId);
      applyingWhatIf = false;
      recalculate();
    }

    function getRetirementChartData(result, params) {
      const balanceByAge = new Map(result.rows.map((r) => [r.age, r.endBalance]));
      const labels = [];
      const balances = [];
      let lastBalance = null;
      let depleted = false;

      for (let age = params.retirementAge; age <= params.lifeExpectancy; age++) {
        labels.push(age);
        if (balanceByAge.has(age)) {
          lastBalance = balanceByAge.get(age);
          if (lastBalance <= 0) depleted = true;
        }
        balances.push(depleted && !balanceByAge.has(age) ? 0 : (lastBalance ?? 0));
      }

      return { labels, balances };
    }

    function getEndBalanceSummary(rows, params) {
      const lastRow = rows[rows.length - 1];
      const depletedRow = rows.find((r) => r.depleted);
      const reachedPlanEnd = lastRow.age >= params.lifeExpectancy;

      if (depletedRow) {
        return {
          balance: lastRow.endBalance,
          meta: `Depletes at age ${depletedRow.age}`,
          className: "danger",
        };
      }
      if (reachedPlanEnd) {
        const className = lastRow.endBalance >= 1_000_000
          ? "strong"
          : lastRow.endBalance < 250000
            ? "warning"
            : "";
        return {
          balance: lastRow.endBalance,
          meta: lastRow.endBalance >= 1_000_000
            ? `Fully funded · ${fmtMillions(lastRow.endBalance)} surplus at age ${params.lifeExpectancy}`
            : `Fully funded · ${fmt.format(lastRow.endBalance)} at age ${params.lifeExpectancy}`,
          className,
        };
      }
      return {
        balance: lastRow.endBalance,
        meta: `Ends at age ${lastRow.age}`,
        className: "warning",
      };
    }

    function balanceAtAge90(rows) {
      const row90 = rows.find((r) => r.age === 90);
      return row90 ? row90.endBalance : rows[rows.length - 1]?.endBalance ?? 0;
    }


    function calendarYearForAge(currentAge, targetAge) {
      return BASE_YEAR + (targetAge - currentAge);
    }

    function formatOneTimeEvents(row, params) {
      const parts = [];
      if (row.pensionAdd > 0) parts.push(`+${fmt.format(row.pensionAdd)} pension`);
      getInflowsForYear(params, row.calendarYear).forEach((i) => {
        parts.push(`+${fmt.format(i.amount)} ${i.label.toLowerCase()}`);
      });
      if (row.houseCost > 0) parts.push(`−${fmt.format(row.houseCost)} home`);
      return parts.length ? parts.join(", ") : "—";
    }

    function inflowMilestoneLabel(row, params) {
      const yearInflows = getInflowsForYear(params, row.calendarYear);
      if (yearInflows.length === 1) return yearInflows[0].displayName;
      if (yearInflows.length > 1) return "Cash inflows";
      return "Cash inflow";
    }

    function retirementBeginsLabel(row) {
      if (row.pensionAdd > 0) {
        return `Retirement begins + ${fmt.format(row.pensionAdd)} pension lump sum`;
      }
      return "Retirement begins";
    }

    function milestoneLabel(row, params) {
      if (row.year === 1) return retirementBeginsLabel(row);
      if (row.ssStarts) return "SS STARTS";
      if (row.specialOutflow > 0) return "Special outflow";
      if (params.house > 0 && row.calendarYear === params.houseYear) return "Home purchase";
      if (row.inflowTotal > 0 && row.age !== params.retirementAge) return inflowMilestoneLabel(row, params);
      return "";
    }

    function isKeyProjectionAge(age, params) {
      return age === params.retirementAge
        || age === params.ssStartAge
        || age === params.lifeExpectancy;
    }

    function resolveSorrReturnRate(sequenceType) {
      return (params, ctx) => {
        const base = params.returnRate;
        if (!ctx.isRetired || ctx.yearIndex < 0 || sequenceType === "base") return base;
        if (ctx.yearIndex >= SORR_EARLY_RETIREMENT_YEARS) return base;
        if (sequenceType === "bad") {
          return Math.max(0, base - SORR_BAD_EARLY_OFFSET);
        }
        if (sequenceType === "good") {
          return Math.min(SORR_GOOD_EARLY_CAP, base + SORR_GOOD_EARLY_OFFSET);
        }
        return base;
      };
    }

    function getSorrEarlyRates(baseRate) {
      return {
        bad: Math.max(0, baseRate - SORR_BAD_EARLY_OFFSET),
        base: baseRate,
        good: Math.min(SORR_GOOD_EARLY_CAP, baseRate + SORR_GOOD_EARLY_OFFSET),
      };
    }

    function getSorrProjectionChartData(params, sequenceType) {
      const result = sequenceType === "base"
        ? runProjection(params)
        : runProjection(params, { resolveReturnRate: resolveSorrReturnRate(sequenceType) });
      return getRetirementChartData({ rows: result.rows }, params);
    }

    function gaussianRandom() {
      let u = 0;
      let v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    function percentile(sortedArr, pct) {
      if (!sortedArr.length) return 0;
      const idx = (pct / 100) * (sortedArr.length - 1);
      const lo = Math.floor(idx);
      const hi = Math.ceil(idx);
      if (lo === hi) return sortedArr[lo];
      return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo);
    }

    function runMonteCarloAnalysis(params) {
      let successCount = 0;
      const endBalances = [];

      for (let t = 0; t < MC_TRIALS; t++) {
        const result = runProjection(params, {
          resolveReturnRate: (p) => {
            const noise = gaussianRandom() * MC_RETURN_VOLATILITY;
            return Math.max(-0.1, Math.min(0.17, p.returnRate + noise));
          },
        });
        const depleted = result.rows.some((r) => r.depleted);
        const lastRow = result.rows[result.rows.length - 1];
        const planOk = !depleted && lastRow.endBalance > 0 && lastRow.age >= params.lifeExpectancy;
        if (planOk) successCount += 1;

        const targetAge = Math.min(90, params.lifeExpectancy);
        const atEnd = balanceAtAge(result.rows, targetAge) ?? lastRow.endBalance ?? 0;
        endBalances.push(atEnd);
      }

      endBalances.sort((a, b) => a - b);
      return {
        successPct: Math.round((successCount / MC_TRIALS) * 100),
        p10: percentile(endBalances, 10),
        p50: percentile(endBalances, 50),
        p90: percentile(endBalances, 90),
      };
    }

    function getWithdrawalZone(rate, ruleRate = 4.0) {
      if (rate == null || Number.isNaN(rate)) {
        return { className: "", note: "—" };
      }
      if (rate <= ruleRate) return { className: "safe", note: "Within safe zone" };
      if (rate <= ruleRate + 0.5) return { className: "caution", note: "Borderline" };
      return { className: "danger", note: "Above safe zone" };
    }

    function formatWithdrawalGrossLabel(grossMonthly, netMonthly) {
      if (grossMonthly <= 0) return "—";
      if (netMonthly > 0 && netMonthly !== grossMonthly) {
        return `${fmt.format(grossMonthly)}/mo gross (${fmt.format(netMonthly)} net)`;
      }
      return `${fmt.format(grossMonthly)}/mo gross`;
    }

    function getWithdrawalRateContextNote(rate, params) {
      if (rate == null || Number.isNaN(rate)) return "";
      if (rate > 4.0 && rate <= 5.5 && params.pension > 0) {
        return `${rate.toFixed(1)}% actual — Slightly above classic 4% rule but acceptable due to large pension lump sum + SS at ${params.ssStartAge}`;
      }
      if (rate > 4.0 && rate <= 5.5) {
        return `${rate.toFixed(1)}% actual — Slightly above classic 4% rule but acceptable due to SS at ${params.ssStartAge}`;
      }
      return `${rate.toFixed(1)}% actual`;
    }

    function formatWithdrawalRateCell(rate, grossMonthly, portfolio, netMonthly, contextNote = "") {
      const grossLabel = formatWithdrawalGrossLabel(grossMonthly, netMonthly);
      if (rate == null || Number.isNaN(rate)) {
        return `<span class="wr-spending-primary">${fmt.format(netMonthly)}/mo total spending</span>`
          + `<span class="wr-zone-note">${grossLabel} · portfolio ${fmt.format(portfolio)}</span>`;
      }
      const zone = getWithdrawalZone(rate, 4.0);
      let html = `<span class="wr-spending-primary">${fmt.format(netMonthly)}/mo total spending</span>`;
      if (contextNote) {
        html += `<span class="wr-rate-context-note wr-rate ${zone.className}">${contextNote}</span>`;
      } else {
        html += `<span class="wr-rate ${zone.className}">${rate.toFixed(1)}%</span>`;
      }
      html += `<span class="wr-zone-note">${grossLabel} on ${fmt.format(portfolio)} · ${zone.note}</span>`;
      return html;
    }

    function getWithdrawalRulesMetrics(result) {
      const education = getWithdrawalEducation(result);
      const retRow = result.rows.find((r) => r.age === result.params.retirementAge);
      const portfolio = getRetirementPortfolioBasis(retRow);
      const grossMonthly = education?.grossWithdrawalMonthly ?? 0;
      const netMonthly = education?.desiredSpendingMonthly ?? getTotalMonthlySpending(result.params);
      const annualGross = grossMonthly * 12;
      return {
        portfolio,
        grossMonthly,
        netMonthly,
        actualRate: portfolio > 0 ? (annualGross / portfolio) * 100 : null,
      };
    }

    function getWithdrawalRuleZone(actualRate, ruleRate) {
      if (actualRate == null || Number.isNaN(actualRate)) return "";
      if (actualRate <= ruleRate) return "safe";
      if (actualRate <= ruleRate + 0.5) return "caution";
      return "danger";
    }

    function updateSafetyBuffer(params) {
      const annual = params.spending * 12;
      const low = annual * 2;
      const high = annual * 3;
      document.getElementById("safetyBufferAmount").textContent = `${fmt.format(low)} – ${fmt.format(high)}`;
      document.getElementById("safetyBufferDetail").textContent =
        `Based on ${fmt.format(params.spending)}/mo (${fmt.format(annual)}/yr), keep 2–3 years in cash or short-term bonds — ${fmt.format(low)} to ${fmt.format(high)} set aside from equities.`;
    }

    function updateMonteCarloAnalysis(params, mc) {
      const enabled = document.getElementById("showMonteCarlo").checked;
      const resultsEl = document.getElementById("monteCarloResults");
      const noteEl = document.getElementById("monteCarloNote");
      const introEl = document.getElementById("monteCarloIntro");

      if (!enabled) {
        resultsEl.style.display = "none";
        noteEl.style.display = "none";
        introEl.style.display = "";
        return;
      }

      introEl.style.display = "none";
      resultsEl.style.display = "";
      noteEl.style.display = "";

      const result = mc || runMonteCarloAnalysis(params);
      const successEl = document.getElementById("mcSuccessPct");
      successEl.textContent = `${result.successPct}%`;
      successEl.className = "value" + (
        result.successPct >= 90 ? " high" : result.successPct >= 75 ? " mid" : " low"
      );

      document.getElementById("mcMedian").textContent = formatMcBalanceCompact(result.p50);
      document.getElementById("mcRange").textContent =
        `${formatMcBalanceCompact(result.p10)} – ${formatMcBalanceCompact(result.p90)}`;

      noteEl.textContent =
        `${MC_TRIALS} simulated paths for ${params.scenarioName} · returns vary ±${(MC_RETURN_VOLATILITY * 100).toFixed(0)}% around your ${(params.returnRate * 100).toFixed(1)}% average. Success = funds last through age ${params.lifeExpectancy} without depletion.`;
    }

    function updateWithdrawalRules(result) {
      const data = getWithdrawalRulesMetrics(result);
      const grossLabel = formatWithdrawalGrossLabel(data.grossMonthly, data.netMonthly);
      const totalSpendingLabel = `${fmt.format(data.netMonthly)}/mo total spending`;
      const rateContextNote = getWithdrawalRateContextNote(data.actualRate, result.params);

      const colEl = document.getElementById("wrColPlan");
      if (colEl) {
        colEl.innerHTML = `Your Plan<span class="wr-col-spending">${totalSpendingLabel}</span>`
          + `<span class="wr-col-spending-detail">${grossLabel}</span>`;
      }

      document.getElementById("withdrawalRulesIntro").textContent =
        "Compare your planned spending and gross portfolio withdrawal against classic withdrawal guidelines at retirement.";
      document.getElementById("withdrawalRulesNote").textContent =
        `${totalSpendingLabel} (${grossLabel} gross) at retirement · Green = safe · Yellow = borderline · Red = above safe zone`;

      function ruleCell(ruleRate) {
        if (data.portfolio <= 0) return "<td>—</td>";
        const maxMonthly = (data.portfolio * (ruleRate / 100)) / 12;
        const zoneClass = getWithdrawalRuleZone(data.actualRate, ruleRate);
        return `<td>
          <span class="wr-rate ${zoneClass}">${fmt.format(maxMonthly)}/mo max gross</span>
          <span class="wr-zone-note">Your ${grossLabel} · ${data.actualRate != null ? `${data.actualRate.toFixed(1)}% actual` : "—"}</span>
        </td>`;
      }

      const tbody = document.getElementById("withdrawalRulesBody");
      tbody.innerHTML = `
        <tr>
          <td><strong>4% Rule</strong><span class="sorr-scenario-desc">Withdraw about 4% of your portfolio in year one — a classic rule of thumb for a 30-year retirement.</span></td>
          <td class="wr-max-col">Up to 4%/yr gross</td>
          ${ruleCell(4.0)}
        </tr>
        <tr>
          <td><strong>3.5% Rule</strong><span class="sorr-scenario-desc">A more cautious target — helpful if you retire early or want extra margin for market downturns.</span></td>
          <td class="wr-max-col">Up to 3.5%/yr gross</td>
          ${ruleCell(3.5)}
        </tr>
        <tr class="wr-actual-rate-row">
          <td><strong>Your Actual Rate</strong><span class="sorr-scenario-desc">Annual gross withdrawal ÷ portfolio at retirement — matches the Withdrawals box</span></td>
          <td class="wr-max-col">—</td>
          <td class="wr-actual-rate-cell">${formatWithdrawalRateCell(data.actualRate, data.grossMonthly, data.portfolio, data.netMonthly, rateContextNote)}</td>
        </tr>`;
    }

    function runProjection(params, options = {}) {
      const resolveReturnRate = options.resolveReturnRate
        || ((_params, _ctx) => _params.returnRate);

      const rows = [];
      const chartLabels = [];
      const chartBalances = [];

      let balance = params.k401;

      for (let age = params.age; age <= params.lifeExpectancy; age++) {
        const calendarYear = BASE_YEAR + (age - params.age);
        const isRetired = age >= params.retirementAge;
        const yearIndex = age - params.retirementAge;
        const annualRate = resolveReturnRate(params, {
          age,
          yearIndex,
          isRetired,
          calendarYear,
        });

        const startBalance = balance;
        let growth = 0;
        let withdrawal = 0;
        let pensionAdd = 0;
        let inflowTotal = 0;
        let houseCost = 0;
        let donationOutflow = 0;
        let specialOutflow = 0;

        if (age === params.retirementAge) {
          pensionAdd = params.pension;
          balance += pensionAdd;
        }

        const yearInflows = getInflowsForYear(params, calendarYear);
        if (yearInflows.length > 0) {
          inflowTotal = yearInflows.reduce((sum, i) => sum + i.amount, 0);
          balance += inflowTotal;
        }

        if (params.house > 0 && calendarYear === params.houseYear) {
          houseCost = params.house;
          balance -= houseCost;
        }

        if (isActiveSpecialOutflow(params) && calendarYear === params.specialOutflowYear) {
          specialOutflow = params.specialOutflowAmount;
        }

        let ssBenefit = 0;
        let livingNeed = 0;
        let portfolioNeed = 0;

        if (isRetired) {
          const healthcareAnnual = getHealthcareAnnualCost(params, yearIndex);
          livingNeed = params.spending * 12 * getSpendingMultiplier(params, yearIndex) + healthcareAnnual;
          const ssActive = age >= params.ssStartAge;
          ssBenefit = ssActive ? SS_ANNUAL : 0;
          portfolioNeed = Math.max(0, livingNeed - ssBenefit);
          if ((params.annualDonations ?? 0) > 0) {
            donationOutflow = params.annualDonations;
          }
          growth = balance * annualRate;
          balance += growth;
          withdrawal = Math.min(balance, portfolioNeed);
          balance -= withdrawal;
          if (donationOutflow > 0) {
            const donated = Math.min(balance, donationOutflow);
            balance -= donated;
            donationOutflow = donated;
          }
          if (specialOutflow > 0) {
            const special = Math.min(balance, specialOutflow);
            balance -= special;
            specialOutflow = special;
          }
        } else {
          growth = balance * annualRate;
          balance += growth;
          if (specialOutflow > 0) {
            const special = Math.min(balance, specialOutflow);
            balance -= special;
            specialOutflow = special;
          }
        }

        const retYear = isRetired ? age - params.retirementAge + 1 : null;
        const row = {
          year: retYear,
          age,
          calendarYear: isRetired
            ? calendarYearForAge(params.age, params.retirementAge) + retYear - 1
            : calendarYear,
          startBalance,
          growth,
          withdrawal,
          livingNeed,
          portfolioNeed,
          ssBenefit,
          pensionAdd,
          inflowTotal,
          houseCost,
          donationOutflow,
          specialOutflow,
          ssStarts: age === params.ssStartAge,
          isMilestone: age === params.retirementAge
            || (params.house > 0 && calendarYear === params.houseYear)
            || age === params.ssStartAge
            || inflowTotal > 0
            || specialOutflow > 0,
          endBalance: Math.max(0, balance),
          depleted: balance <= 0 && isRetired,
        };

        rows.push(row);
        chartLabels.push(age);
        chartBalances.push(Math.max(0, balance));

        if (balance <= 0 && isRetired) break;
      }

      const inflowAges = [...new Set(
        params.inflows
          .map((i) => rows.find((r) => r.calendarYear === i.year)?.age)
          .filter((age) => age != null && age !== params.retirementAge),
      )];

      const milestones = {
        retirement: params.retirementAge,
        house: params.house > 0
          ? rows.find((r) => r.calendarYear === params.houseYear)?.age
          : null,
        ss: params.ssStartAge,
        inflows: inflowAges,
      };

      return { rows, chartLabels, chartBalances, milestones };
    }




    function getRowOutflows(row) {
      return row.withdrawal
        + (row.houseCost ?? 0)
        + (row.donationOutflow ?? 0)
        + (row.specialOutflow ?? 0);
    }

    function formatInflowsCell(row, params, isFirst = false) {
      const parts = [];
      if (row.pensionAdd > 0 && !isFirst) {
        parts.push(
          `<span class="inflow-pension">`
          + `+${fmt.format(row.pensionAdd)}<span class="inflow-label">pension lump sum</span></span>`,
        );
      }
      getInflowsForYear(params, row.calendarYear).forEach((i) => {
        parts.push(
          `<span class="inflow-event">+${fmt.format(i.amount)}<span class="inflow-label">${i.displayName.toLowerCase()}</span></span>`,
        );
      });
      return parts.length ? parts.join("") : "—";
    }

    function formatOutflowsCell(row) {
      const withdrawal = row.withdrawal;
      const houseCost = row.houseCost ?? 0;
      const donationOutflow = row.donationOutflow ?? 0;
      const specialOutflow = row.specialOutflow ?? 0;
      if (withdrawal <= 0 && houseCost <= 0 && donationOutflow <= 0 && specialOutflow <= 0) return "—";
      const parts = [];
      if (withdrawal > 0) parts.push(`<span class="num">${fmt.format(withdrawal)}</span>`);
      if (donationOutflow > 0) {
        parts.push(`<span class="event-note">−${fmt.format(donationOutflow)} gifts</span>`);
      }
      if (specialOutflow > 0) {
        parts.push(`<span class="event-note">−${fmt.format(specialOutflow)} special</span>`);
      }
      if (houseCost > 0) {
        parts.push(`<span class="event-note">−${fmt.format(houseCost)} home</span>`);
      }
      return parts.join("");
    }

    function formatSocialSecurityCell(row, prevRow) {
      if (row.ssBenefit <= 0) return "—";
      const saved = prevRow && row.ssStarts ? Math.max(0, prevRow.withdrawal - row.withdrawal) : 0;
      const savedNote = saved >= 500
        ? `<span class="ss-saved">Portfolio −${fmt.format(saved)}/yr</span>`
        : "";
      return `<span class="num">${fmt.format(row.ssBenefit)}</span>${savedNote}`;
    }


    function formatScenarioInflowNote(inflows) {
      if (!inflows.length) return "no optional inflows";
      return formatInflowParts(inflows).join(" + ");
    }

    function updatePlanMilestonesTable(result) {
      const p = result.params;
      const rows = result.rows;
      const end = getEndBalanceSummary(rows, p);
      const atRet = balanceAtAge(rows, p.retirementAge);
      const afterHouse = afterHouseBalance(rows, p);
      const at80 = balanceAtAge(rows, 80);
      const at90 = balanceAtAge(rows, 90);
      const prob = getProbabilityOfSuccess(rows, p);
      const inflowNote = p.inflows.length
        ? formatInflowParts(p.inflows).join(" + ")
        : "no optional inflows";
      const notes = `${fmt.format(p.spending)}/mo · ${inflowNote}`;

      document.getElementById("compareRetAgeHeader").textContent = p.retirementAge;
      document.getElementById("planMilestonesTable").innerHTML = `
        <tr>
          <td>${fmt.format(atRet ?? 0)}</td>
          <td>${afterHouse != null ? fmt.format(afterHouse) : "—"}</td>
          <td>${at80 != null ? fmt.format(at80) : "—"}</td>
          <td>${at90 != null ? fmt.format(at90) : fmt.format(rows[rows.length - 1]?.endBalance ?? 0)}</td>
          <td><span class="prob-badge ${prob.className}">${prob.label}</span></td>
          <td class="notes-cell">${notes}</td>
        </tr>`;
      renderPlanSummary(p, end);
    }

    function deflateToToday(nominal, calendarYear, inflationRate) {
      const years = Math.max(0, calendarYear - BASE_YEAR);
      return nominal / Math.pow(1 + inflationRate, years);
    }

    function getRealChartData(result, params) {
      const nominal = getRetirementChartData(result, params);
      const balances = nominal.labels.map((age, idx) => {
        const calYear = calendarYearForAge(params.age, age);
        return deflateToToday(nominal.balances[idx], calYear, params.inflation);
      });
      return { labels: nominal.labels, balances };
    }

    function calcItalyNormalTax(taxableIncomeUsd) {
      const incomeEur = taxableIncomeUsd / EUR_USD;
      let taxEur = 0;
      let prev = 0;
      for (const bracket of ITALY_IRPEF_BRACKETS) {
        const inBracket = Math.min(incomeEur, bracket.upTo) - prev;
        if (inBracket <= 0) break;
        taxEur += inBracket * bracket.rate;
        prev = bracket.upTo;
        if (incomeEur <= bracket.upTo) break;
      }
      taxEur *= (1 + ITALY_REGIONAL_SURCHARGE);
      return taxEur * EUR_USD;
    }


    function getTaxReferenceRow(rows, params) {
      return rows.find((r) => r.age === params.ssStartAge)
        || rows.find((r) => r.age === params.retirementAge);
    }

    function calcTaxAttributedToWithdrawal(annualWithdrawal, annualSS = 0) {
      if (annualWithdrawal <= 0) return 0;
      const taxableIncome = annualWithdrawal + annualSS * SS_TAXABLE_PORTION;
      const usTax = calcFederalTax(taxableIncome);
      const assumeFlat = document.getElementById("assumeFlatTaxRegime").checked;
      const italyTax = assumeFlat
        ? taxableIncome * ITALY_FLAT_RATE
        : calcItalyNormalTax(taxableIncome);
      const totalTax = usTax + italyTax;
      if (taxableIncome <= 0) return 0;
      return totalTax * (annualWithdrawal / taxableIncome);
    }

    function solveGrossIraWithdrawal(desiredSpendingMonthly, annualSS = 0) {
      const desiredSpendingMonthlyRounded = Math.round(desiredSpendingMonthly);
      const afterTaxTargetAnnual = desiredSpendingMonthlyRounded * 12;

      if (afterTaxTargetAnnual <= 0) {
        return {
          desiredSpendingMonthly: desiredSpendingMonthlyRounded,
          grossWithdrawalMonthly: 0,
          estimatedTaxesMonthly: 0,
        };
      }

      let lo = afterTaxTargetAnnual;
      let hi = afterTaxTargetAnnual * 1.25;
      const maxHi = afterTaxTargetAnnual * 3;
      while (
        hi < maxHi
        && hi - calcTaxAttributedToWithdrawal(hi, annualSS) < afterTaxTargetAnnual
      ) {
        hi *= 1.25;
      }

      for (let i = 0; i < 64; i++) {
        const mid = (lo + hi) / 2;
        const tax = calcTaxAttributedToWithdrawal(mid, annualSS);
        const afterTax = mid - tax;
        if (afterTax < afterTaxTargetAnnual) lo = mid;
        else hi = mid;
      }

      const grossWithdrawalMonthly = Math.round(hi / 12);
      const estimatedTaxesMonthly = Math.max(
        0,
        grossWithdrawalMonthly - desiredSpendingMonthlyRounded,
      );

      return {
        desiredSpendingMonthly: desiredSpendingMonthlyRounded,
        grossWithdrawalMonthly,
        estimatedTaxesMonthly,
      };
    }

    function getWithdrawalEducation(result) {
      const params = result.params;
      const taxRow = getTaxReferenceRow(result.rows, params);
      if (!taxRow) return null;

      const totalSpending = getTotalMonthlySpending(params);
      const solved = solveGrossIraWithdrawal(totalSpending, 0);

      return {
        age: taxRow.age,
        desiredSpendingMonthly: solved.desiredSpendingMonthly,
        grossWithdrawalMonthly: solved.grossWithdrawalMonthly,
        estimatedTaxesMonthly: solved.estimatedTaxesMonthly,
        ssMonthly: taxRow.ssBenefit / 12,
        hasSS: taxRow.ssBenefit > 0,
        baseSpendingMonthly: Math.round(params.spending),
        privateTravelMonthly: getPrivateTravelMonthly(params),
      };
    }

    function formatSpendingBreakdown(education) {
      if (!education.privateTravelMonthly) return null;
      return `(${fmt.format(education.baseSpendingMonthly)} base + ${fmt.format(education.privateTravelMonthly)} Private + Travel)`;
    }

    function withdrawalEducationNote(education) {
      const spend = fmt.format(education.desiredSpendingMonthly);
      const gross = fmt.format(education.grossWithdrawalMonthly);
      let note = `Pull ${gross}/mo from your IRA so that after taxes you have ${spend} left for spending.`;
      if (education.hasSS) {
        note += ` Social Security (${fmt.format(education.ssMonthly)}/mo) reduces how much the portfolio must provide.`;
      }
      return note;
    }

    function updateWithdrawalBreakdown(prefix, education) {
      if (!education) return;
      const spendingEl = document.getElementById(`${prefix}Spending`);
      if (spendingEl) {
        spendingEl.innerHTML = `<span class="wr-spending-primary">${fmt.format(education.desiredSpendingMonthly)}</span>`;
      }
      const spendingDetailEl = document.getElementById(`${prefix}SpendingDetail`);
      if (spendingDetailEl) {
        const breakdown = formatSpendingBreakdown(education);
        spendingDetailEl.textContent = breakdown ? `${breakdown} total monthly spending` : "";
        spendingDetailEl.hidden = !breakdown;
      }
      document.getElementById(`${prefix}Gross`).textContent = fmt.format(education.grossWithdrawalMonthly);
      document.getElementById(`${prefix}Taxes`).textContent = fmt.format(education.estimatedTaxesMonthly);
      const noteEl = document.getElementById(`${prefix}WdNote`);
      if (noteEl) noteEl.textContent = withdrawalEducationNote(education);
    }

    function estimateScenarioTaxes(result) {
      const params = result.params;
      const taxRow = result.rows.find((r) => r.age === params.ssStartAge)
        || result.rows.find((r) => r.age === params.retirementAge);
      if (!taxRow) return null;
      const taxableIncome = getTaxableIncomeFromRow(taxRow);
      const usTax = calcFederalTax(taxableIncome);
      const italyNormalTax = calcItalyNormalTax(taxableIncome);
      const italyFlatTax = taxableIncome * ITALY_FLAT_RATE;
      const flatVsNormalSavings = Math.max(0, italyNormalTax - italyFlatTax);
      const assumeFlat = document.getElementById("assumeFlatTaxRegime").checked;
      return {
        usTax,
        italyNormalTax,
        italyFlatTax,
        italyTax: assumeFlat ? italyFlatTax : italyNormalTax,
        flatVsNormalSavings,
        age: taxRow.age,
        taxableIncome,
        grossCash: taxRow.withdrawal + taxRow.ssBenefit,
      };
    }

    function formatSorrBalance(amount, baseAmount, scenarioId) {
      if (amount == null) return "—";
      const formatted = amount >= 1_000_000 ? fmtMillions(amount) : fmt.format(amount);
      if (scenarioId === "base" || baseAmount == null) {
        return `<span class="num">${formatted}</span>`;
      }
      const delta = amount - baseAmount;
      if (Math.abs(delta) < 500) {
        return `<span class="num">${formatted}</span>`;
      }
      const deltaClass = delta > 0 ? "sorr-delta-pos" : "sorr-delta-neg";
      const sign = delta > 0 ? "+" : "";
      const deltaText = Math.abs(delta) >= 1_000_000
        ? fmtMillions(delta)
        : fmt.format(delta);
      return `<span class="num">${formatted}</span><span class="sorr-delta ${deltaClass}">${sign}${deltaText} vs base</span>`;
    }

    function updateSorrAnalysis(params) {
      const rates = getSorrEarlyRates(params.returnRate);
      const basePct = (rates.base * 100).toFixed(1);
      const badPct = (rates.bad * 100).toFixed(1);
      const goodPct = (rates.good * 100).toFixed(1);
      document.getElementById("sorrRateHint").textContent =
        `First ${SORR_EARLY_RETIREMENT_YEARS} retirement years: Bad ${badPct}% · Base ${basePct}% · Good ${goodPct}% — then ${basePct}% average thereafter (based on your return slider).`;

      const baseResult = runProjection(params);
      const baseAt70 = balanceAtAge(baseResult.rows, 70);
      const baseAt90 = balanceAtAge(baseResult.rows, 90)
        ?? baseResult.rows[baseResult.rows.length - 1]?.endBalance
        ?? 0;

      const tbody = document.getElementById("sorrTableBody");
      tbody.innerHTML = SORR_SCENARIOS.map((scenario) => {
        const result = scenario.id === "base"
          ? baseResult
          : runProjection(params, { resolveReturnRate: resolveSorrReturnRate(scenario.id) });
        const rows = result.rows;
        const at70 = balanceAtAge(rows, 70);
        const at90 = balanceAtAge(rows, 90) ?? rows[rows.length - 1]?.endBalance ?? 0;
        const prob = getProbabilityOfSuccess(rows, params);

        return `
        <tr class="${scenario.rowClass}">
          <td class="scenario-name">
            ${scenario.label}
            <span class="sorr-scenario-desc">${scenario.desc}</span>
          </td>
          <td class="num-cell">${formatSorrBalance(at70, baseAt70, scenario.id)}</td>
          <td class="num-cell">${formatSorrBalance(at90, baseAt90, scenario.id)}</td>
          <td class="sorr-prob-cell">
            <span class="prob-badge ${prob.className}">${prob.label}</span>
            <span class="sorr-prob-note">${prob.note}</span>
          </td>
        </tr>`;
      }).join("");
    }

    function updateInflationImpactBox(activeResult, activeParams) {
      const box = document.getElementById("inflationImpactBox");
      const show = isAdvancedPlannerView() && document.getElementById("showInflationImpact").checked;
      if (!show) {
        box.hidden = true;
        return;
      }
      box.hidden = false;

      const targetAge = Math.min(90, activeParams.lifeExpectancy);
      const row90 = activeResult.rows.find((r) => r.age === targetAge)
        || activeResult.rows[activeResult.rows.length - 1];
      const nominal = row90.endBalance;
      const calYear = row90.calendarYear;
      const real = deflateToToday(nominal, calYear, activeParams.inflation);
      const years = calYear - BASE_YEAR;
      const eroded = nominal > 0 ? ((1 - real / nominal) * 100).toFixed(0) : "0";
      const scenarioName = activeParams.scenarioName;

      box.innerHTML = `
        <div class="inflation-impact-title">Purchasing Power at Age ${row90.age} (${calYear}) · ${scenarioName}</div>
        <div class="inflation-impact-grid">
          <div class="inflation-impact-item nominal">
            <span class="label">Nominal Future Dollars</span>
            <span class="value">${fmt.format(nominal)}</span>
          </div>
          <div class="inflation-impact-item real">
            <span class="label">Today's Dollars</span>
            <span class="value">${fmt.format(real)}</span>
          </div>
        </div>
        <p class="inflation-impact-note">
          At <strong>${(activeParams.inflation * 100).toFixed(1)}%</strong> annual inflation over
          <strong>${years} years</strong> (${BASE_YEAR}→${calYear}), a portfolio of
          <strong>${fmt.format(nominal)}</strong> in ${calYear} has roughly the same buying power as
          <strong>${fmt.format(real)}</strong> today — about <strong>${eroded}%</strong> less purchasing power in real terms.
        </p>`;
    }

    function renderTaxSummaryCard(taxes, label) {
      if (!taxes) {
        return `<div class="tax-savings-scenario-name">${label}</div><p class="tax-savings-lead">No data yet.</p>`;
      }
      const assumeFlat = document.getElementById("assumeFlatTaxRegime").checked;
      const italyApplied = assumeFlat ? taxes.italyFlatTax : taxes.italyNormalTax;
      const italyLabel = assumeFlat ? "Italy (7% flat)" : "Italy (normal rates)";
      const totalApplied = taxes.usTax + italyApplied;
      const totalWithFlat = taxes.usTax + taxes.italyFlatTax;
      const totalNormal = taxes.usTax + taxes.italyNormalTax;
      const monthlyTotal = totalApplied / 12;
      const monthlySavings = taxes.flatVsNormalSavings / 12;

      const savingsBox = taxes.flatVsNormalSavings > 0
        ? (assumeFlat
          ? `<div class="tax-savings-compare-box">`
            + `With the <strong>7% flat regime</strong>, Italy tax is `
            + `<strong>${fmt.format(taxes.italyFlatTax)}/yr</strong> instead of `
            + `<strong>${fmt.format(taxes.italyNormalTax)}/yr</strong> under normal rates — `
            + `saving <strong>${fmt.format(taxes.flatVsNormalSavings)}/yr</strong> `
            + `(≈ <strong>${fmt.format(monthlySavings)}/mo</strong>) on the Italian portion.`
            + `</div>`
          : `<div class="tax-savings-compare-box muted">`
            + `If you qualify for the <strong>7% flat regime</strong>, Italy tax could drop from `
            + `<strong>${fmt.format(taxes.italyNormalTax)}/yr</strong> to `
            + `<strong>${fmt.format(taxes.italyFlatTax)}/yr</strong> — `
            + `up to <strong>${fmt.format(taxes.flatVsNormalSavings)}/yr</strong> `
            + `(≈ <strong>${fmt.format(monthlySavings)}/mo</strong>) less. Toggle above to apply.`
            + `</div>`)
        : `<div class="tax-savings-compare-box muted">7% flat savings not shown at this income level — verify eligibility with an advisor.</div>`;

      return `
        <div class="tax-savings-scenario-name">${label}</div>
        <p class="tax-savings-lead">At age <strong>${taxes.age}</strong> · ~<strong>${fmt.format(taxes.taxableIncome)}</strong> taxable income/yr</p>
        <div class="tax-savings-big">
          <span class="tax-savings-big-label">Est. total tax (US + Italy)</span>
          <span class="tax-savings-big-value">${fmt.format(totalApplied)}/yr</span>
          <span class="tax-savings-big-sub">≈ ${fmt.format(monthlyTotal)}/mo · ${assumeFlat ? "7% flat applied" : "normal Italy rates"}</span>
        </div>
        <div class="tax-savings-metric">
          <span class="label">US federal (est.)</span>
          <span class="value">${fmt.format(taxes.usTax)}/yr</span>
        </div>
        <div class="tax-savings-metric">
          <span class="label">${italyLabel}</span>
          <span class="value ${assumeFlat ? "flat" : ""}">${fmt.format(italyApplied)}/yr</span>
        </div>
        ${!assumeFlat ? `
        <div class="tax-savings-metric">
          <span class="label">Total if 7% flat applied</span>
          <span class="value savings">${fmt.format(totalWithFlat)}/yr</span>
        </div>` : ""}
        ${savingsBox}`;
    }

    function updateTaxOptimization(result) {
      const assumeFlat = document.getElementById("assumeFlatTaxRegime").checked;
      const tbody = document.getElementById("taxOptTableBody");
      const taxes = estimateScenarioTaxes(result);
      const label = PLAN_NAME;

      if (!taxes) {
        tbody.innerHTML = `<tr><td>${label}</td><td colspan="5">—</td></tr>`;
        document.getElementById("taxSummaryPlan").innerHTML = renderTaxSummaryCard(null, label);
        document.getElementById("taxSavingsHighlight").innerHTML = "";
        return;
      }

      const totalFlat = taxes.usTax + taxes.italyFlatTax;
      const flatCell = assumeFlat
        ? `<span class="flat-active">${fmt.format(taxes.italyFlatTax)}</span>`
        : fmt.format(taxes.italyFlatTax);
      const savingsCell = taxes.flatVsNormalSavings > 0
        ? `<span class="savings-cell">${fmt.format(taxes.flatVsNormalSavings)}/yr<br>`
          + `<span style="font-weight:500;color:var(--text-muted);font-size:0.68rem">≈ ${fmt.format(taxes.flatVsNormalSavings / 12)}/mo</span></span>`
        : "—";

      tbody.innerHTML = `
        <tr>
          <td><strong>${label}</strong><br><span style="color:var(--text-muted);font-size:0.72rem">age ${taxes.age}</span></td>
          <td>${fmt.format(taxes.usTax)}</td>
          <td>${fmt.format(taxes.italyNormalTax)}</td>
          <td>${flatCell}</td>
          <td class="total-cell">${fmt.format(totalFlat)}</td>
          <td>${savingsCell}</td>
        </tr>`;

      document.getElementById("taxSummaryPlan").innerHTML = renderTaxSummaryCard(taxes, label);

      const highlight = document.getElementById("taxSavingsHighlight");
      const captionEl = document.getElementById("taxOptTableCaption");
      const activeTotalFlat = taxes.usTax + taxes.italyFlatTax;
      const activeTotalNormal = taxes.usTax + taxes.italyNormalTax;

      if (captionEl) {
        captionEl.textContent = assumeFlat
          ? "Showing totals with 7% flat Italy tax applied. US federal tax is unchanged; the treaty may let you credit Italian tax against US tax."
          : "Showing normal Italy rates in the summary card. The table shows what 7% flat could save on the Italian portion.";
      }

      if (assumeFlat) {
        highlight.innerHTML = `
          <strong>Bottom line:</strong> With the 7% flat regime, you'd pay about
          <strong>${fmt.format(activeTotalFlat)}/yr</strong> total (≈ <strong>${fmt.format(activeTotalFlat / 12)}/mo</strong>)
          in US + Italy tax at age ${taxes.age} — vs. <strong>${fmt.format(activeTotalNormal)}/yr</strong>
          under normal Italian rates. That's <strong>${fmt.format(taxes.flatVsNormalSavings)}/yr</strong>
          (≈ <strong>${fmt.format(taxes.flatVsNormalSavings / 12)}/mo</strong>) less on Italy tax alone.`;
      } else {
        highlight.innerHTML = `
          <strong>Bottom line:</strong> Under normal Italian progressive rates, total tax is about
          <strong>${fmt.format(activeTotalNormal)}/yr</strong> (≈ <strong>${fmt.format(activeTotalNormal / 12)}/mo</strong>) at age ${taxes.age}.
          Turn on the <strong>7% Flat Tax Regime</strong> toggle to see a potential drop to
          <strong>${fmt.format(activeTotalFlat)}/yr</strong> — saving up to
          <strong>${fmt.format(taxes.flatVsNormalSavings)}/yr</strong> (≈ <strong>${fmt.format(taxes.flatVsNormalSavings / 12)}/mo</strong>)
          on Italian tax if you qualify in a qualifying Sicilian municipality.`;
      }
    }


    function updateTaxEstimates(rows, params) {
      const taxRow = getTaxReferenceRow(rows, params);
      if (!taxRow) return;

      document.getElementById("taxScenarioName").textContent = params.scenarioName;

      const ss = taxRow.ssBenefit;
      const taxableIncome = getTaxableIncomeFromRow(taxRow);
      const usTax = calcFederalTax(taxableIncome);
      const italyNormalTax = calcItalyNormalTax(taxableIncome);
      const italyFlatTax = taxableIncome * ITALY_FLAT_RATE;
      const assumeFlat = document.getElementById("assumeFlatTaxRegime").checked;
      const italyTax = assumeFlat ? italyFlatTax : italyNormalTax;
      const flatVsNormalSavings = Math.max(0, italyNormalTax - italyFlatTax);
      const totalSpending = getTotalMonthlySpending(params);
      const solved = solveGrossIraWithdrawal(totalSpending, 0);

      document.getElementById("statUSTax").textContent = fmt.format(usTax);
      document.getElementById("statUSTaxDetail").textContent =
        `At age ${taxRow.age} · taxable ${fmt.format(taxableIncome)} · MFJ 2026 brackets`;

      document.getElementById("statItalyTaxLabel").textContent = assumeFlat
        ? "Italy 7% Flat Regime"
        : "Italy Normal (IRPEF)";
      document.getElementById("statItalyTax").textContent = fmt.format(italyTax);
      document.getElementById("statItalySavings").textContent = assumeFlat
        ? (flatVsNormalSavings > 0
          ? `7% flat saves ${fmt.format(flatVsNormalSavings)}/yr vs normal IRPEF`
          : "7% flat regime assumed — verify eligibility")
        : (flatVsNormalSavings > 0
          ? `7% flat could save ${fmt.format(flatVsNormalSavings)}/yr — toggle to compare`
          : "Normal IRPEF rates applied");

      const wdEducation = {
        desiredSpendingMonthly: solved.desiredSpendingMonthly,
        grossWithdrawalMonthly: solved.grossWithdrawalMonthly,
        estimatedTaxesMonthly: solved.estimatedTaxesMonthly,
        ssMonthly: ss / 12,
        hasSS: ss > 0,
      };

      document.getElementById("statGrossWithdrawalMonthly").textContent =
        fmt.format(solved.grossWithdrawalMonthly);
      document.getElementById("statGrossWdNote").textContent = "";
      document.getElementById("statGrossWithdrawalDetail").textContent =
        withdrawalEducationNote(wdEducation);
    }

    function updateSummary(rows, params) {
      const retirementRow = rows.find((r) => r.age === params.retirementAge);
      const houseRow = rows.find((r) => r.calendarYear === params.houseYear);
      const lastRow = rows[rows.length - 1];
      const depletedRow = rows.find((r) => r.depleted);
      const reachedPlanEnd = lastRow.age >= params.lifeExpectancy;

      document.getElementById("statRetAge").textContent = params.retirementAge;
      document.getElementById("statHouseYear").textContent = params.houseYear;
      document.getElementById("statEndAge").textContent = params.lifeExpectancy;

      const atRetEl = document.getElementById("statAtRetirement");
      atRetEl.textContent = fmt.format(retirementRow ? retirementRow.endBalance : 0);

      const afterHouseCard = document.getElementById("statAfterHouseCard");
      const afterHouseEl = document.getElementById("statAfterHouse");
      if (params.house > 0) {
        afterHouseCard.style.display = "";
        afterHouseEl.textContent = fmt.format(houseRow ? houseRow.endBalance : retirementRow?.endBalance ?? 0);
      } else {
        afterHouseCard.style.display = "none";
      }

      const lastsEl = document.getElementById("statLasts");
      const lastsDetailEl = document.getElementById("statLastsDetail");

      if (depletedRow) {
        lastsEl.textContent = `Depletes at ${depletedRow.age}`;
        lastsEl.className = "stat-value danger";
        lastsDetailEl.textContent = `Portfolio exhausted in ${depletedRow.calendarYear}`;
      } else if (reachedPlanEnd) {
        lastsEl.textContent = "Fully funded";
        lastsEl.className = "stat-value";
        lastsDetailEl.textContent = `No shortfall through age ${params.lifeExpectancy}`;
      } else {
        lastsEl.textContent = `Through age ${lastRow.age}`;
        lastsEl.className = "stat-value warning";
        lastsDetailEl.textContent = "Projection ended before plan horizon";
      }

      const endBalEl = document.getElementById("statEndBalance");
      const endDetailEl = document.getElementById("statEndDetail");
      endBalEl.textContent = lastRow.endBalance >= 1_000_000
        ? fmtMillions(lastRow.endBalance)
        : fmt.format(lastRow.endBalance);
      endBalEl.className = "stat-value" + (
        lastRow.endBalance <= 0
          ? " danger"
          : lastRow.endBalance >= 1_000_000
            ? " strong"
            : lastRow.endBalance < 250000
              ? " warning"
              : ""
      );
      endDetailEl.textContent = depletedRow
        ? "Funds ran out before plan end"
        : lastRow.endBalance >= 1_000_000
          ? `Strong surplus · ${fmtMillions(lastRow.endBalance)} at age ${lastRow.age}`
          : `${fmt.format(lastRow.endBalance)} remaining at age ${lastRow.age}`;
    }

    function getRetirementTableRows(rows, params) {
      return rows
        .filter((r) => r.age >= params.retirementAge && r.age <= params.lifeExpectancy)
        .sort((a, b) => a.age - b.age);
    }

    function retirementYearForAge(params, age) {
      return age - params.retirementAge + 1;
    }

    function retirementCalendarYear(params, retYear) {
      const startYear = calendarYearForAge(params.age, params.retirementAge);
      return startYear + retYear - 1;
    }

    function updateTable(rows, params) {
      const retirementRows = getRetirementTableRows(rows, params);
      const showAll = tableExpanded || retirementRows.length <= TABLE_PREVIEW_YEARS;
      const displayRows = showAll
        ? retirementRows
        : retirementRows.slice(0, TABLE_PREVIEW_YEARS);
      const startYear = calendarYearForAge(params.age, params.retirementAge);

      document.getElementById("tableStartYear").textContent = startYear;
      document.getElementById("tableStartAge").textContent = params.retirementAge;
      const inflNote = params.inflateSpending
        ? `Spending grows at <strong>${(params.inflation * 100).toFixed(1)}%</strong>/yr.`
        : "Spending held flat (no inflation adjustment).";
      const previewNote = !showAll
        ? ` Showing first <strong>${TABLE_PREVIEW_YEARS}</strong> retirement years of <strong>${retirementRows.length}</strong>.`
        : "";
      const ssRetYear = params.ssStartAge - params.retirementAge + 1;
      document.getElementById("tableNote").innerHTML =
        `Ret. Yr <strong>1</strong> = calendar <strong>${startYear}</strong>, age <strong>${params.retirementAge}</strong> — <strong>${fmt.format(params.pension)}</strong> pension lump sum in <strong>In</strong>. ` +
        `<strong>SS STARTS</strong> at Ret. Yr <strong>${ssRetYear}</strong> (age <strong>${params.ssStartAge}</strong>, ${fmt.format(SS_ANNUAL)}/yr). ${inflNote}${previewNote}`;

      const expandBtn = document.getElementById("expandTableBtn");
      const tableCard = document.getElementById("projectionTableCard");
      if (expandBtn) {
        if (retirementRows.length > TABLE_PREVIEW_YEARS) {
          expandBtn.style.display = "";
          expandBtn.textContent = showAll
            ? `Show first ${TABLE_PREVIEW_YEARS} years`
            : `Show More Years (${retirementRows.length} total)`;
        } else {
          expandBtn.style.display = "none";
        }
      }
      if (tableCard) {
        tableCard.classList.toggle("table-preview", !showAll);
      }

      const tbody = document.getElementById("projectionTable");
      tbody.innerHTML = displayRows.map((r, idx) => {
        const retYear = retirementYearForAge(params, r.age);
        const calYear = retirementCalendarYear(params, retYear);
        const isFirst = retYear === 1;
        const isKeyAge = isKeyProjectionAge(r.age, params);
        const tag = milestoneLabel(r, params);
        const tagClass = isFirst
          ? "milestone-tag retirement-tag"
          : (r.ssStarts ? "milestone-tag ss-milestone" : "milestone-tag");
        const rowClass = [
          isFirst ? "first-retirement-row" : "",
          r.depleted ? "depleted" : "",
          r.ssStarts ? "ss-start" : "",
          isKeyAge ? "key-age-row" : "",
          !isFirst && r.isMilestone ? "milestone" : "",
          retYear <= 3 ? "intro-row" : "",
        ].filter(Boolean).join(" ");

        const yearCell = isFirst
          ? `<strong class="key-year">1</strong>`
          : (isKeyAge ? `<strong>${retYear}</strong>` : String(retYear));
        const ageCell = isKeyAge
          ? `<strong class="key-age">${r.age}</strong>${tag ? `<span class="${tagClass}">${tag}</span>` : ""}`
          : `${r.age}${tag ? `<span class="${tagClass}">${tag}</span>` : ""}`;
        const calCell = isKeyAge ? `<strong>${calYear}</strong>` : String(calYear);
        const prevRow = idx > 0 ? displayRows[idx - 1] : null;

        const rowHtml = `
        <tr class="${rowClass}">
          <td class="${isKeyAge ? "key-year" : ""}">${yearCell}</td>
          <td class="${isKeyAge ? "key-age" : ""}">${ageCell}</td>
          <td class="${isKeyAge ? "key-year" : ""}">${calCell}</td>
          <td class="num col-start">${fmt.format(r.startBalance)}</td>
          <td class="num col-growth">${fmt.format(r.growth)}</td>
          <td class="col-in">${formatInflowsCell(r, params, isFirst)}</td>
          <td class="col-out">${formatOutflowsCell(r)}</td>
          <td class="col-ss">${formatSocialSecurityCell(r, prevRow)}</td>
          <td class="num col-end">${fmt.format(r.endBalance)}</td>
        </tr>`;

        if (r.ssStarts) {
          return rowHtml + `
        <tr class="ss-start-note-row">
          <td colspan="9">Withdrawals drop significantly</td>
        </tr>`;
        }
        return rowHtml;
      }).join("");

      const tableWrap = document.getElementById("projectionTableWrap");
      if (tableWrap) tableWrap.scrollTop = 0;
    }

    function isInflowMilestone(age, milestones) {
      return milestones.inflows && milestones.inflows.includes(age);
    }

    function buildPointRadii(labels, milestones) {
      return labels.map((age) => {
        if (age === milestones.retirement || age === milestones.house || age === milestones.ss) return 6;
        if (isInflowMilestone(age, milestones)) return 5;
        return 0;
      });
    }

    function buildPointColors(labels, milestones) {
      return labels.map((age) => {
        if (age === milestones.retirement) return CHART_THEME.retirement;
        if (age === milestones.house) return CHART_THEME.house;
        if (age === milestones.ss) return CHART_THEME.ss;
        if (isInflowMilestone(age, milestones)) return CHART_THEME.inflow;
        return CHART_THEME.plan;
      });
    }

    function updateChart(result, params) {
      const ctx = document.getElementById("projectionChart").getContext("2d");
      chartTooltipAge = params.age;
      const displayMode = getChartDisplayMode();
      const showInflation = displayMode === "inflation";
      const showSorr = displayMode === "sorr";

      if (chart && lastChartDisplayMode !== displayMode) {
        chart.destroy();
        chart = null;
      }
      lastChartDisplayMode = displayMode;

      const planChart = getRetirementChartData(result, params);
      const labels = planChart.labels;
      const milestones = result.milestones;

      const gradientPlan = ctx.createLinearGradient(0, 0, 0, 360);
      gradientPlan.addColorStop(0, CHART_THEME.planFill);
      gradientPlan.addColorStop(1, "rgba(0, 230, 118, 0)");

      const pointRadius = buildPointRadii(labels, milestones);

      const houseNote = params.house > 0
        ? `<span><i style="background:${CHART_THEME.house}"></i> Home (${params.houseYear})</span>`
        : "";
      const inflowNote = params.inflows.length > 0
        ? `<span><i style="background:${CHART_THEME.inflow}"></i> Inflows: ${params.inflows.map((i) => `${i.displayName} ${i.year}`).join(" · ")}</span>`
        : "";

      let legendMain;
      if (showSorr) {
        legendMain = `
          <span><i style="background:${CHART_THEME.sorrBad}"></i> Bad Early Sequence</span>
          <span><i style="background:${CHART_THEME.plan}"></i> Base Case (Average)</span>
          <span><i style="background:${CHART_THEME.sorrGood}"></i> Good Early Sequence</span>`;
      } else if (showInflation) {
        legendMain = `<span><i style="background:${CHART_THEME.plan}"></i> Nominal Future Dollars</span>
           <span><i style="background:${CHART_THEME.realDollars}"></i> Today's Dollars</span>`;
      } else {
        legendMain = `<span><i style="background:${CHART_THEME.plan}"></i> ${getPlanDisplayName()}</span>`;
      }

      const endBal = balanceAtAge(result.rows, params.lifeExpectancy)
        ?? result.rows[result.rows.length - 1]?.endBalance;
      const chartSub = document.getElementById("chartHeaderSub");
      if (chartSub) {
        chartSub.textContent = endBal != null
          ? `Ages ${params.retirementAge}–${params.lifeExpectancy} · projected ${endBal >= 1_000_000 ? fmtMillions(endBal) : fmt.format(endBal)} at age ${params.lifeExpectancy}`
          : `Portfolio balance from age ${params.retirementAge} through ${params.lifeExpectancy}`;
      }

      const sorrNote = showSorr
        ? `<span>First ${SORR_EARLY_RETIREMENT_YEARS} yrs vary</span>`
        : "";
      const milestoneItems = [
        `<span><i style="background:${CHART_THEME.retirement}"></i> Retire · ${milestones.retirement}</span>`,
        houseNote,
        inflowNote,
        `<span><i style="background:${CHART_THEME.ss}"></i> SS · ${milestones.ss}</span>`,
      ].filter(Boolean).join("");

      document.getElementById("chartLegend").innerHTML = `
        <div class="legend-group legend-primary">${legendMain}</div>
        <div class="legend-group legend-milestones">${milestoneItems}</div>
        <span class="legend-range">Ages ${params.retirementAge}–${params.lifeExpectancy}</span>
        ${sorrNote}`;

      const alignBalances = (chartData) => labels.map((age) => {
        const idx = chartData.labels.indexOf(age);
        return idx >= 0 ? chartData.balances[idx] : null;
      });

      let datasets;

      if (showSorr) {
        const baseData = getSorrProjectionChartData(params, "base");
        const badData = getSorrProjectionChartData(params, "bad");
        const goodData = getSorrProjectionChartData(params, "good");
        const badGradient = ctx.createLinearGradient(0, 0, 0, 360);
        badGradient.addColorStop(0, CHART_THEME.sorrBadFill);
        badGradient.addColorStop(1, "rgba(255, 112, 67, 0)");

        datasets = [
          {
            label: "Good Early Sequence",
            data: alignBalances(goodData),
            borderColor: CHART_THEME.sorrGood,
            backgroundColor: "transparent",
            borderWidth: 2,
            borderDash: [7, 5],
            fill: false,
            tension: 0.42,
            cubicInterpolationMode: "monotone",
            spanGaps: false,
            pointRadius: 0,
            pointHoverRadius: 6,
            order: 3,
          },
          {
            label: "Base Case (Average)",
            data: alignBalances(baseData),
            borderColor: CHART_THEME.plan,
            backgroundColor: "transparent",
            borderWidth: 2.5,
            fill: false,
            tension: 0.42,
            cubicInterpolationMode: "monotone",
            spanGaps: false,
            pointRadius: 0,
            pointHoverRadius: 6,
            order: 2,
          },
          {
            label: "Bad Early Sequence",
            data: alignBalances(badData),
            borderColor: CHART_THEME.sorrBad,
            backgroundColor: badGradient,
            borderWidth: 3.5,
            fill: true,
            tension: 0.42,
            cubicInterpolationMode: "monotone",
            spanGaps: false,
            pointRadius: 0,
            pointHoverRadius: 7,
            order: 1,
          },
        ];
      } else if (showInflation) {
        const realData = getRealChartData(result, params);

        datasets = [
          {
            label: "Nominal Future Dollars",
            data: alignBalances(planChart),
            borderColor: CHART_THEME.plan,
            backgroundColor: gradientPlan,
            borderWidth: 3,
            fill: true,
            tension: 0.42,
            cubicInterpolationMode: "monotone",
            spanGaps: false,
            pointRadius,
            pointHoverRadius: 7,
            pointBackgroundColor: buildPointColors(labels, milestones),
            pointBorderColor: CHART_THEME.pointBorder,
            pointBorderWidth: 2,
            order: 1,
          },
          {
            label: "Today's Dollars",
            data: alignBalances(realData),
            borderColor: CHART_THEME.realDollars,
            backgroundColor: "transparent",
            borderWidth: 2.5,
            borderDash: [8, 5],
            fill: false,
            tension: 0.42,
            cubicInterpolationMode: "monotone",
            spanGaps: false,
            pointRadius: 0,
            pointHoverRadius: 6,
            order: 2,
          },
        ];
      } else {
        datasets = [
          {
            label: getPlanDisplayName(),
            data: alignBalances(planChart),
            borderColor: CHART_THEME.plan,
            backgroundColor: gradientPlan,
            borderWidth: 3,
            fill: true,
            tension: 0.42,
            cubicInterpolationMode: "monotone",
            spanGaps: false,
            pointRadius,
            pointHoverRadius: 7,
            pointBackgroundColor: buildPointColors(labels, milestones),
            pointBorderColor: CHART_THEME.pointBorder,
            pointBorderWidth: 2,
            order: 1,
          },
        ];
      }

      const yTitle = showInflation ? "Portfolio Value (USD)" : "Portfolio Value";

      const xScale = {
        min: params.retirementAge,
        max: params.lifeExpectancy,
        grid: { color: CHART_THEME.grid, drawBorder: false },
        ticks: { color: CHART_THEME.ticks, maxTicksLimit: 14, font: { size: 11 } },
        title: { display: true, text: "Age", color: CHART_THEME.ticks, font: { size: 12, weight: "600" } },
      };

      const yScale = {
        grid: { color: CHART_THEME.grid, drawBorder: false },
        ticks: {
          color: CHART_THEME.ticks,
          font: { size: 11 },
          maxTicksLimit: 8,
          callback: (v) => {
            if (v >= 1_000_000) return "$" + (v / 1_000_000).toFixed(1) + "M";
            return "$" + Math.round(v / 1000) + "k";
          },
        },
        title: { display: true, text: yTitle, color: CHART_THEME.ticks, font: { size: 12, weight: "600" } },
      };

      if (chart) {
        chart.data.labels = labels;
        chart.data.datasets = datasets;
        chart.options.scales.x = xScale;
        chart.options.scales.y = yScale;
        chart.update();
        return;
      }

      chart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 400, easing: "easeInOutQuart" },
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: CHART_THEME.tooltipBg,
              borderColor: CHART_THEME.tooltipBorder,
              borderWidth: 1,
              titleColor: "#00e676",
              bodyColor: "#f0f0f0",
              titleFont: { size: 13, weight: "600" },
              bodyFont: { size: 13 },
              padding: 14,
              cornerRadius: 8,
              callbacks: {
                title: (items) => {
                  const age = items[0].label;
                  const year = calendarYearForAge(chartTooltipAge, Number(age));
                  return `Age ${age} · ${year}`;
                },
                label: (ctx) => ` ${ctx.dataset.label}: ${fmt.format(ctx.parsed.y)}`,
              },
            },
          },
          scales: { x: xScale, y: yScale },
        },
      });
    }

    function recalculate() {
      syncPlanFromForm();
      syncInflowYearBounds();

      const params = buildParams();
      const result = { params, ...runProjection(params) };
      const mc = runMonteCarloAnalysis(params);

      updateFocusBanner(params);
      updateCurrentPlanSummary(params, mc);
      updatePlanSummary(result);
      updateHealthcarePanel(params);
      updateTaxEstimates(result.rows, params);
      updateSummary(result.rows, params);
      updateTable(result.rows, params);
      updateChart(result, params);
      updateInflationImpactBox(result, params);
      updateTaxOptimization(result);
      updatePlanMilestonesTable(result);
      updateRetirementImpactSummary(result, params);
      updateSorrAnalysis(params);
      updateSafetyBuffer(params);
      updateMonteCarloAnalysis(params, mc);
      updateWithdrawalRules(result);
      updateAdvancedPanels();
    }

    inputs.forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener("input", () => {
        if (!applyingWhatIf) {
          document.querySelectorAll(".what-if-btn").forEach((btn) => btn.classList.remove("active"));
          activeWhatIfPreset = null;
        }
        scheduleRecalculate();
      });
      el.addEventListener("change", () => {
        if (!applyingWhatIf) {
          document.querySelectorAll(".what-if-btn").forEach((btn) => btn.classList.remove("active"));
          activeWhatIfPreset = null;
        }
        scheduleRecalculate();
      });
    });

    document.querySelectorAll(".what-if-btn").forEach((btn) => {
      btn.addEventListener("click", () => applyWhatIfPreset(btn.dataset.preset));
    });

    document.getElementById("savePdf").addEventListener("click", () => {
      window.print();
    });

    document.getElementById("saveSettingsBtn").addEventListener("click", savePlannerSettings);
    document.getElementById("loadSettingsBtn").addEventListener("click", () => loadPlannerSettings());

    document.getElementById("viewModeSimple").addEventListener("click", () => setPlannerView("simple"));
    document.getElementById("viewModeAdvanced").addEventListener("click", () => setPlannerView("advanced"));

    document.getElementById("toggleTableBtn").addEventListener("click", () => {
      if (!isAdvancedPlannerView()) return;
      const card = document.getElementById("projectionTableCard");
      const collapsed = card.classList.toggle("collapsed");
      document.getElementById("toggleTableBtn").setAttribute("aria-expanded", String(!collapsed));
    });

    document.getElementById("expandTableBtn").addEventListener("click", () => {
      tableExpanded = !tableExpanded;
      recalculate();
    });

    document.querySelectorAll(".dashboard-tab").forEach((tab) => {
      tab.addEventListener("click", () => switchDashboardTab(tab.dataset.tab));
    });

    document.querySelectorAll(".sidebar-accordion-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const accordion = btn.closest(".sidebar-accordion");
        const open = accordion.classList.toggle("open");
        btn.setAttribute("aria-expanded", String(open));
      });
    });

    document.getElementById("advancedOptionsToggle").addEventListener("click", () => {
      const card = document.getElementById("advancedOptionsCard");
      const open = card.classList.toggle("open");
      document.getElementById("advancedOptionsToggle").setAttribute("aria-expanded", String(open));
    });

    document.getElementById("housingToggle").addEventListener("click", () => {
      const section = document.getElementById("housingMarketSection");
      const open = section.classList.toggle("open");
      document.getElementById("housingToggle").setAttribute("aria-expanded", String(open));
    });

    document.getElementById("advancedAnalysisToggle").addEventListener("click", () => {
      const wrap = document.getElementById("advancedAnalysisWrap");
      const open = wrap.classList.toggle("open");
      document.getElementById("advancedAnalysisToggle").setAttribute("aria-expanded", String(open));
    });

    document.querySelectorAll("[data-advanced-collapse]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const wrap = document.getElementById(btn.dataset.advancedCollapse);
        if (!wrap) return;
        const open = wrap.classList.toggle("open");
        btn.setAttribute("aria-expanded", String(open));
      });
    });

    function toggleSorrCard() {
      const sorrCard = document.getElementById("sorrCard");
      if (!sorrCard || sorrCard.hidden) return;
      const collapsed = sorrCard.classList.toggle("sorr-collapsed");
      const header = document.getElementById("sorrHeaderToggle");
      if (header) header.setAttribute("aria-expanded", String(!collapsed));
    }

    document.getElementById("sorrHeaderToggle").addEventListener("click", toggleSorrCard);
    document.getElementById("sorrHeaderToggle").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleSorrCard();
      }
    });

    ["showMonteCarlo", "showSorrAnalysis", "showSorrOnChart", "showInflationImpact",
      "showDetailedTax", "showWithdrawalRules"].forEach((id) => {
      document.getElementById(id).addEventListener("change", () => handleAdvancedToggleChange(id));
    });

    SLIDER_BINDINGS.forEach(bindSlider);
    PLAIN_NUMERIC_FIELDS.forEach(bindPlainNumericField);
    bindCurrencyFieldsWithoutSlider();

    syncInflowSliderBounds();
    syncInflowYearSelects();
    syncAllSliders();

    document.getElementById("userLocation").addEventListener("input", handleLocationInput);
    document.getElementById("userLocation").addEventListener("change", handleLocationInput);
    document.getElementById("userLocation").addEventListener("blur", handleLocationBlur);
    document.getElementById("updatePlanBtn").addEventListener("click", () => runProjectionUpdate({ feedback: true }));

    if (!tryAutoLoadPlannerSettings()) {
      initPlannerViewMode();
      loadPlanIntoForm();
      setWhatIfButtonState("original");    }
    updateAdvancedPanels();
    recalculate();