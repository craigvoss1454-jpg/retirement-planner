#!/usr/bin/env python3
"""Single-pass rebuild: Sicily polish + general logic."""
import re
import subprocess
from pathlib import Path

SICILY = Path(r"C:\Users\Craig\Retirement-Projection\Sicily-Retirement-Planner.html")
GENERAL = Path(r"C:\Users\Craig\Retirement-Projection\_general_backup.html")
OUT = Path(r"C:\Users\Craig\Retirement-Projection\Retirement-Planner.html")

UPDATE_CURRENT_PLAN_SUMMARY = """
    function updateCurrentPlanSummary(params, mc) {
      const listEl = document.getElementById("currentPlanSummaryList");
      if (!listEl || !params) return;

      const loc = getUserLocation();
      const locationValue = hasUserLocation(loc) ? loc : "Your City, State / Country";
      const houseLabel = params.house > 0
        ? `Home Purchase (${params.houseYear})`
        : "Home Purchase";

      const items = [
        { label: "Location", value: locationValue },
        { label: "Monthly Spending", value: formatSpendingSummaryValue(params), highlight: true },
        { label: "Retirement Age", value: String(params.retirementAge) },
        { label: "Expected Return Rate", value: `${(params.returnRate * 100).toFixed(1)}%` },
        { label: "Inflation Rate", value: `${(params.inflation * 100).toFixed(1)}%` },
        { label: "Inflate Spending", value: params.inflateSpending ? "On" : "Off" },
        { label: houseLabel, value: formatHouseBuySummaryValue(params) },
        ...getInflowSummaryItems(planState),
        ...getOutflowSummaryItems(params),
        { label: "Social Security", value: `${fmt.format(SS_ANNUAL)}/yr at age ${params.ssStartAge}` },
        { label: "Healthcare", value: formatHealthcareSummaryValue(params) },
      ];

      listEl.innerHTML = items.map((item) => `
        <li class="current-plan-summary-item${item.highlight ? " summary-item-highlight" : ""}">
          <span class="current-plan-summary-label">${item.label}</span>
          <span class="current-plan-summary-value${item.highlight ? " summary-highlight" : ""}">${item.value}</span>
        </li>`
      ).join("");

      updateCurrentPlanSummaryMonteCarlo(mc);
    }
"""

GENERAL_SUMMARY_FORMATTERS = """
    function formatSpendingSummaryValue(params) {
      const total = getTotalMonthlySpending(params);
      return `<span class="spending-total-primary">${fmt.format(total)}/mo</span>`;
    }

    function formatHouseBuySummaryValue(params) {
      if (params.house <= 0) return "None planned";
      return `${fmt.format(params.house)} in ${params.houseYear}`;
    }

    function formatHealthcareSummaryValue(params) {
      const supplementAnnual = params.extraPrivateHealthcare
        ? getHealthcareSupplementMonthly(params.locationRegion) * 12
        : 0;
      const supplementNote = supplementAnnual > 0
        ? ` + ${fmt.format(supplementAnnual)}/yr supplemental`
        : "";

      if (params.locationRegion === "us") {
        const base = params.retirementAge >= 65
          ? params.healthcareMedicareUsd
          : params.healthcarePre65Usd;
        const phase = params.retirementAge >= 65 ? "Medicare" : "pre-65";
        return `${fmt.format(base)}/yr ${phase}${supplementNote}`;
      }

      const publicUsd = params.healthcarePublicEur * EUR_USD;
      return `${fmt.format(publicUsd)}/yr public${supplementNote}`;
    }
"""

GET_TOTAL_MONTHLY_SPENDING = """
    function getTotalMonthlySpending(params) {
      const supplement = params.extraPrivateHealthcare
        ? getHealthcareSupplementMonthly(params.locationRegion)
        : 0;
      return Math.round(params.spending + supplement);
    }
"""


def extract(html: str, tag: str) -> str:
    if tag == "style":
        m = re.search(r"<style>(.*?)</style>", html, re.S)
    elif tag == "script":
        m = re.search(r"<script>(.*?)</script>", html, re.S)
    elif tag == "body":
        m = re.search(r"<body[^>]*>(.*?)</body>", html, re.S)
    else:
        raise ValueError(tag)
    return m.group(1) if m else ""


def lines(text: str, start: int, end: int) -> str:
    return "".join(text.splitlines(keepends=True)[start - 1 : end])


def remove_function(script: str, name: str) -> str:
    old = extract_function(script, name)
    return script.replace(old, "", 1) if old else script


def extract_function(src: str, name: str) -> str:
    pat = rf"    function {re.escape(name)}\("
    m = re.search(pat, src)
    if not m:
        return ""
    start = m.start()
    i = src.index("(", m.end() - 1)
    paren_depth = 0
    while i < len(src):
        if src[i] == "(":
            paren_depth += 1
        elif src[i] == ")":
            paren_depth -= 1
            if paren_depth == 0:
                i += 1
                break
        i += 1
    while i < len(src) and src[i] not in "{":
        i += 1
    if i >= len(src) or src[i] != "{":
        return ""
    depth = 0
    for j in range(i, len(src)):
        if src[j] == "{":
            depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0:
                return src[start : j + 1] + "\n\n"
    return ""


def extract_const_region(src: str, start_pat: str, end_pat: str) -> str:
    m = re.search(start_pat, src)
    if not m:
        return ""
    start = m.start()
    end_m = re.search(rf"^{end_pat}", src[m.end() :], re.M)
    if not end_m:
        return ""
    return src[start : m.end() + end_m.start()].rstrip() + "\n\n"


def has_function(script: str, name: str) -> bool:
    return f"function {name}" in script


def ensure_functions(script: str, g_script: str, names: list[str]) -> str:
    for name in names:
        if not has_function(script, name):
            block = extract_function(g_script, name)
            if not block:
                raise SystemExit(f"Could not extract function {name} from general backup")
            script = inject_after_function(script, "readRetirementAge", block, append=True)
    return script


def inject_after_function(script: str, anchor: str, code: str, append: bool = False) -> str:
    old = extract_function(script, anchor)
    if not old:
        raise SystemExit(f"Anchor function {anchor} not found for injection")
    insertion = old.rstrip() + "\n\n" + code.strip() + "\n\n"
    return script.replace(old, insertion, 1)


def replace_function(script: str, name: str, new_body: str) -> str:
    old = extract_function(script, name)
    if old:
        return script.replace(old, new_body.strip() + "\n\n", 1)
    return inject_after_function(script, "readRetirementAge", new_body)


BODY_REPLS = [
    ('value="3,300"', 'value="4,000"'),
    ('value="3300"', 'value="4000"'),
    ('data-min="2000" data-max="10000"', 'data-min="1000" data-max="20000"'),
    ('data-min="1000" data-max="50000"', 'data-min="1000" data-max="20000"'),
    ('id="sliderSpending" min="2000" max="10000"', 'id="sliderSpending" min="1000" max="20000"'),
    ('id="sliderSpending" min="1000" max="50000"', 'id="sliderSpending" min="1000" max="20000"'),
    ('<span>$2,000</span><span>$10,000</span>', '<span>$1,000</span><span>$20,000</span>'),
    ('<span>$1,000</span><span>$50,000</span>', '<span>$1,000</span><span>$20,000</span>'),
    ('id="retirementAge" value="55"', 'id="retirementAge" value="65"'),
    ('id="sliderRetirementAge" min="50" max="75" step="1" value="55"', 'id="sliderRetirementAge" min="50" max="75" step="1" value="65"'),
    ('<p class="field-micro-hint">Original plan: age 55 (2031)</p>', '<p class="field-micro-hint">When you stop working and start drawing from savings — pension lump sum arrives this year</p>'),
    ('<div class="retirement-impact-inline advanced-only" id="retirementImpactInline"></div>', ''),
    ('in Sicily — drives IRA', '— drives portfolio'),
    ('Desired lifestyle spending · default $3,300/mo', 'How much you want to spend each month after taxes — compare to the cost-of-living box in your plan'),
    ('>Inheritance</span>', '>Inheritance / Other</span>'),
    ('id="k401" value="538,474"', 'id="k401" value="500,000"'),
    ('<label for="k401">401(k) balance</label>', '<label for="k401">401(k) / IRA balance</label>'),
    ('id="pension" value="626,286"', 'id="pension" value="300,000"'),
    ('<label for="pension">Pension lump sum</label>', '<label for="pension">Pension / other lump sum</label>'),
    ('<label for="house">Sicily home buy</label>', '<label for="house">Home purchase</label>'),
    ("Optional future home buy in Sicily. Default $0 — you live in your wife's existing Misterbianco home.", "Optional future home purchase. Default $0 if you do not plan to buy."),
    ("wife's existing Misterbianco home", "no home purchase planned"),
    ("Wife's Misterbianco home", "No home purchase"),
    ("Misterbianco · wife's home · modest spending", "$4,000/mo · retire at 65 · add your location above"),
    ("Your Plan · Realistic Sicily · Misterbianco", "Your Plan"),
    ("Misterbianco, Sicily", "Your City, State / Country"),
    ('typical Catania-area prices', 'research links'),
    ('$31,572/yr ($2,631/mo)', '$13,200/yr ($1,100/mo) typical'),
    ('Original Plan (Age 55)', 'Original Plan (Age 65)'),
    ('Early Retirement (Age 52)', 'Early Retirement (Age 62)'),
    ('Later Retirement (Age 58)', 'Later Retirement (Age 67)'),
    ('<span id="statRetAge">55</span>', '<span id="statRetAge">65</span>'),
    ('Portfolio Projection — Realistic Sicily Plan', 'Portfolio Projection — Your Retirement Plan'),
    ('Local Housing Market – Catania Area', 'Local Housing Market'),
    ('for typical prices &amp; listings', 'for research links'),
    ('Realistic Sicily Plan', 'Your Retirement Plan'),
    ('Realistic Sicily ·', 'Your Plan ·'),
    ('€2,000 – €3,000/mo', '—'),
    ('Estimates based on Numbeo 2026 data + local sources. Actual costs vary by lifestyle and exact neighborhood.', 'Housing, food, transport & leisure for a comfortable lifestyle'),
    ('Comfortable couple / family (incl. rent)', 'Comfortable couple / family'),
    ('Your plan', 'Your monthly spending'),
    ('$3,300/mo', '$4,000/mo'),
    ('IRA pull is sized so after taxes you keep your target monthly spending.', 'Withdrawal is sized so after taxes you keep your target monthly spending.'),
    ('How much to pull from your IRA before taxes', 'How much to pull from retirement accounts before taxes'),
    ('Monthly spending (total)', 'Monthly spending'),
    ('<span class="focus-badge">Default view</span>', '<span class="focus-badge">Getting started</span>'),
    ('<span class="focus-title">Your Retirement Plan</span>', '<span class="focus-title" id="focusPlanTitle">Your Retirement Plan</span>'),
]


def apply_body_repls(text: str) -> str:
    for a, b in BODY_REPLS:
        text = text.replace(a, b)
    return text


def replace_dashboard_block(body: str, general_body: str) -> str:
    start = body.index('<div class="dashboard-focus-banner"')
    end = body.index('<section class="dashboard-head-meta">', start)
    g_start = general_body.index('<div class="dashboard-focus-banner"')
    g_end = general_body.index('<section class="dashboard-head-meta">', g_start)
    return body[:start] + general_body[g_start:g_end] + body[end:]


def replace_housing_section(body: str, general_body: str) -> str:
    pat = re.compile(
        r'<section class="card housing-market-section collapsible-housing no-print" id="housingMarketSection">.*?</section>',
        re.S,
    )
    g_m = pat.search(general_body)
    if not g_m or not pat.search(body):
        return body
    return pat.sub(apply_body_repls(g_m.group(0)), body, count=1)


def replace_taxhealth_panel(body: str, general_body: str) -> str:
    tax_pat = re.compile(
        r'<div class="dashboard-tab-panel[^"]*" id="tabPanelTaxhealth" role="tabpanel">.*?'
        r'(?=\s*<div class="dashboard-tab-panel[^"]*" id="tabPanelCompare")',
        re.S,
    )
    g_m = tax_pat.search(general_body)
    if not g_m:
        return body
    panel = apply_body_repls(g_m.group(0))
    panel = panel.replace("dashboard-tab-panel advanced-only", "dashboard-tab-panel", 1)
    return tax_pat.sub(panel, body, count=1)


def dedupe_function(script: str, name: str, canonical: str) -> str:
    while extract_function(script, name):
        script = remove_function(script, name)
    return inject_after_function(script, "readRetirementAge", canonical)


POST_BUILD_CSS = """
    .planner-view-simple .dashboard-tab-bar {
      display: flex !important;
    }
    .planner-view-simple #withdrawalRulesWrap[hidden] {
      display: block !important;
    }
    .planner-view-simple #taxDetailSection[hidden] {
      display: block !important;
    }
    .planner-view-simple #taxTabHint {
      display: none !important;
    }
"""

UPDATE_PLAN_SUMMARY_SAFE = """
    function updatePlanSummary(result) {
      const params = result.params;
      const end = getEndBalanceSummary(result.rows, params);
      const balEl = document.getElementById("planSummaryBalance");
      if (!balEl) return;
      balEl.textContent = end.balance >= 1_000_000
        ? fmtMillions(end.balance)
        : fmt.format(end.balance);
      balEl.className = "compare-balance" + (end.className ? ` ${end.className}` : "");
      const metaEl = document.getElementById("planSummaryMeta");
      if (metaEl) metaEl.textContent = end.meta;

      updateWithdrawalBreakdown("planSummary", getWithdrawalEducation(result));

      const tagSpending = document.getElementById("planTagSpending");
      if (tagSpending) tagSpending.textContent = `${fmt.format(params.spending)}/mo`;
      const tagReturn = document.getElementById("planTagReturn");
      if (tagReturn) tagReturn.textContent = `${params.returnRate * 100}% return`;
      const tagSS = document.getElementById("planTagSS");
      if (tagSS) tagSS.textContent = `SS at ${params.ssStartAge}`;

      updateCostOfLivingDisplay(getUserLocation(), params.spending);
      renderPlanSummary(params, end);
    }
"""

SCHEDULE_RECALCULATE = """
    function scheduleRecalculate() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        commitAllPendingInputs();
        recalculate();
      }, 80);
    }
"""

UPDATE_ADVANCED_PANELS = """
    function updateAdvancedPanels() {
      const mc = document.getElementById("showMonteCarlo").checked;
      const sorr = document.getElementById("showSorrAnalysis").checked;
      const tax = document.getElementById("showDetailedTax").checked;
      const wr = document.getElementById("showWithdrawalRules").checked;
      const simpleView = plannerViewMode === "simple";

      document.getElementById("monteCarloWrap").hidden = !mc;

      const sorrCard = document.getElementById("sorrCard");
      sorrCard.hidden = !sorr;

      const wrWrap = document.getElementById("withdrawalRulesWrap");
      if (wrWrap) wrWrap.hidden = simpleView ? false : !wr;

      const taxSection = document.getElementById("taxDetailSection");
      if (taxSection) taxSection.hidden = simpleView ? false : !tax;
      const taxHint = document.getElementById("taxTabHint");
      if (taxHint) taxHint.hidden = simpleView || tax;

      const analysisWrap = document.getElementById("advancedAnalysisWrap");
      const showAnalysis = mc || sorr || (wr && !simpleView);
      if (analysisWrap) analysisWrap.hidden = !showAnalysis;

      const summaryEl = document.getElementById("advancedAnalysisSummary");
      if (summaryEl) {
        const parts = [];
        if (mc) parts.push("Monte Carlo");
        if (sorr) parts.push("SORR");
        if (wr && !simpleView) parts.push("Withdrawal rules");
        summaryEl.textContent = parts.length ? parts.join(" · ") : "Optional detail panels";
      }

      updateAdvancedOptionsBadge();
    }
"""


def move_withdrawal_rules_to_primary(body: str) -> str:
    pat = (
        r'(\s*<div class="card advanced-plan-block-wrap collapsible-advanced open" id="withdrawalRulesWrap"[^>]*>'
        r'.*?</div>\s*</div>\s*</div>)'
    )
    m = re.search(pat, body, re.S)
    if not m:
        return body
    block = m.group(1).strip()
    body = body.replace(m.group(1), "", 1)
    anchor = '</section>\n        </div>\n\n        <div class="dashboard-secondary-zone'
    if anchor not in body:
        anchor = '</section>\n        </div>\n        <div class="dashboard-secondary-zone'
    if anchor in body:
        body = body.replace(anchor, f'</section>\n\n        {block}\n        </div>\n\n        <div class="dashboard-secondary-zone', 1)
    return body


def apply_post_build_fixes(html: str) -> str:
    html = apply_body_repls(html)
    html = html.replace(
        '<div class="dashboard-tab-bar advanced-only no-print"',
        '<div class="dashboard-tab-bar no-print"',
    )
    html = html.replace("dashboard-tab-panel advanced-only", "dashboard-tab-panel")
    html = html.replace(
        '<span>Portfolio Projection — Your Retirement Plan</span>\n              <span class="chart-header-sub"',
        '<span id="chartSectionTitle">Portfolio Projection — Your Retirement Plan</span>\n              <span class="chart-header-sub"',
        1,
    )
    body_m = re.search(r"<body[^>]*>(.*?)</body>", html, re.S)
    if body_m:
        body = body_m.group(1)
        body = move_withdrawal_rules_to_primary(body)
        html = html[: body_m.start(1)] + body + html[body_m.end(1) :]
    html = html.replace("</style>", POST_BUILD_CSS + "\n  </style>", 1)
    script_m = re.search(r"<script>(.*?)</script>", html, re.S)
    if not script_m:
        return html
    script = script_m.group(1)
    script = replace_function(script, "scheduleRecalculate", SCHEDULE_RECALCULATE)
    script = replace_function(script, "updateAdvancedPanels", UPDATE_ADVANCED_PANELS)
    script = dedupe_function(script, "updatePlanSummary", UPDATE_PLAN_SUMMARY_SAFE)
    script = re.sub(
        r"if \(val >= min && val <= max\) \{",
        'if (binding.inputId === "spending" && parsed !== null && parsed >= 0) {\n'
        "          committedNumericValues.set(binding.inputId, parsed);\n"
        "          const sliderVal = Math.min(max, Math.max(min, parsed));\n"
        "          slider.value = sliderVal;\n"
        "          updateSliderFill(slider);\n"
        "          clearWhatIfHighlight();\n"
        "          scheduleRecalculate();\n"
        "        } else if (val >= min && val <= max) {",
        script,
        count=1,
    )
    script = re.sub(r"^function (\w+)", r"    function \1", script, flags=re.M)
    script = re.sub(r"^const ", r"    const ", script, flags=re.M)
    for el in ["housingToggle", "sorrHeaderToggle", "advancedAnalysisToggle"]:
        script = script.replace(
            f'document.getElementById("{el}").addEventListener',
            f'document.getElementById("{el}")?.addEventListener',
        )
    return html[: script_m.start(1)] + script + html[script_m.end(1) :]


def patch_collect_planner_settings(script: str) -> str:
    old = extract_function(script, "collectPlannerSettings")
    if not old:
        return script
    patched = old.replace(
        "inflowYears: { ...planState.inflowYears },\n        },",
        "inflowYears: { ...planState.inflowYears },\n          annualDonations: planState.annualDonations ?? 0,\n          specialOutflowAmount: planState.specialOutflowAmount ?? 0,\n          specialOutflowYear: planState.specialOutflowYear ?? 0,\n        },",
    )
    return script.replace(old, patched)


def patch_apply_planner_settings(script: str) -> str:
    old = extract_function(script, "applyPlannerSettings")
    if not old:
        return script
    patched = old.replace(
        "inflowYears: { ...PLAN_DEFAULT.inflowYears, ...scenario.inflowYears },\n      });",
        "inflowYears: { ...PLAN_DEFAULT.inflowYears, ...scenario.inflowYears },\n        annualDonations: scenario.annualDonations ?? 0,\n        specialOutflowAmount: scenario.specialOutflowAmount ?? 0,\n        specialOutflowYear: scenario.specialOutflowYear ?? 0,\n      });",
    )
    return script.replace(old, patched)


def main():
    sicily = SICILY.read_text(encoding="utf-8")
    general = GENERAL.read_text(encoding="utf-8").replace("\r\n", "\n")
    g_script = extract(general, "script").replace("\r\n", "\n")
    s_script = extract(sicily, "script").replace("\r\n", "\n")
    general_body = extract(general, "body")

    # ---- CSS ----
    css = extract(sicily, "style")
    css += """
    .welcome-intro {
      max-width: 42rem;
      margin: 0.45rem auto 0;
      font-size: 0.88rem;
      color: var(--text-secondary);
      line-height: 1.5;
    }
    .assumptions-intro {
      font-size: 0.78rem;
      color: var(--text-secondary);
      line-height: 1.45;
      margin-bottom: 0.75rem;
      padding-bottom: 0.65rem;
      border-bottom: 1px solid var(--border-subtle);
    }
    #taxDetailSection[data-tax-mode="us"] .tax-abroad-only { display: none !important; }
    #taxDetailSection[data-tax-mode="us"] .tax-panel .tax-grid { grid-template-columns: 1fr 1fr; }
    @media (max-width: 800px) {
      #taxDetailSection[data-tax-mode="us"] .tax-panel .tax-grid { grid-template-columns: 1fr; }
    }
"""
    css = css.replace(
        "grid-template-columns: minmax(196px, 214px) minmax(0, 1fr);",
        "grid-template-columns: minmax(260px, 288px) minmax(0, 1fr);",
    )

    # ---- BODY from Sicily with targeted replacements ----
    body = extract(sicily, "body")
    body = re.sub(r"\s*<script>.*?</script>\s*", "\n", body, flags=re.S)

    header_start = general_body.index("<header>")
    header_end = general_body.index("</header>") + len("</header>")
    general_header = general_body[header_start:header_end]
    body = body[: body.index("<header>")] + general_header + body[body.index("</header>") + len("</header>") :]

    body = body.replace(
        '<div class="card-header">Assumptions</div>\n          <div class="card-body">',
        '<div class="card-header">Your Assumptions</div>\n          <div class="card-body">\n            <p class="assumptions-intro">These defaults are a reasonable starting point. Change anything that doesn\'t match your situation — the chart and summary refresh automatically.</p>',
        1,
    )

    body = apply_body_repls(body)

    # Healthcare sidebar accordion from general (before Portfolio)
    hc_acc_start = general_body.index('<div class="sidebar-accordion" data-accordion>\n              <button type="button" class="sidebar-accordion-btn" aria-expanded="false">\n                Healthcare')
    hc_acc_end = general_body.index('<div class="sidebar-accordion sidebar-what-if', hc_acc_start)
    healthcare_accordion = general_body[hc_acc_start:hc_acc_end]

    # Portfolio accordion from Sicily base with general labels/values
    sicily_body = extract(sicily, "body")
    port_start = sicily_body.index(
        '<div class="sidebar-accordion" data-accordion>\n              <button type="button" class="sidebar-accordion-btn" aria-expanded="false">\n                Portfolio'
    )
    port_end = sicily_body.index(
        '<div class="sidebar-accordion" data-accordion>\n              <button type="button" class="sidebar-accordion-btn" aria-expanded="false">\n                Healthcare',
        port_start,
    )
    portfolio_accordion = apply_body_repls(sicily_body[port_start:port_end])

    what_if_marker = '<div class="sidebar-accordion sidebar-what-if'
    sidebar_insert = []
    if 'id="healthcareUsInputs"' not in body:
        sidebar_insert.append(healthcare_accordion.strip())
    if 'id="k401"' not in body:
        sidebar_insert.append(portfolio_accordion.strip())
    if sidebar_insert:
        body = body.replace(
            what_if_marker,
            "\n\n            ".join(sidebar_insert) + "\n\n            " + what_if_marker,
            1,
        )

    # Remove any leftover Sicily-only healthcare accordion
    body = re.sub(
        r'\n            <div class="sidebar-accordion" data-accordion>\s*'
        r'<button type="button" class="sidebar-accordion-btn" aria-expanded="false">\s*'
        r'Healthcare\s*<span class="sidebar-accordion-icon"[^>]*>▼</span>\s*'
        r'</button>\s*<div class="sidebar-accordion-panel assumptions-section">.*?'
        r'Public SSN / yr.*?</div>\s*</div>',
        "",
        body,
        count=1,
        flags=re.S,
    )
    body = body.replace(
        'Opens US/Italy tax estimates, IRA withdrawal math',
        'Opens estimated US tax breakdown, withdrawal math',
    )

    body = replace_dashboard_block(body, general_body)

    body = replace_housing_section(body, general_body)

    # Tax section tweaks
    body = body.replace(
        'for US/Italy estimates and IRA withdrawal math.',
        'for estimated US taxes and retirement-account withdrawal math.',
    )
    body = body.replace('<div id="taxDetailSection" hidden>', '<div id="taxDetailSection" data-tax-mode="us" hidden>', 1)
    body = body.replace('Realistic Sicily Plan', 'Your Retirement Plan')
    body = body.replace('Italy 7% Flat (Optional)', 'Residence tax (if abroad)')
    body = body.replace(
        '<div class="tax-item">\n                  <div class="stat-label" id="statItalyTaxLabel">Residence tax (if abroad)</div>',
        '<div class="tax-item tax-abroad-only" id="taxAbroadItem">\n                  <div class="stat-label" id="statItalyTaxLabel">Residence tax (if abroad)</div>',
        1,
    )
    body = body.replace('<input type="checkbox" id="assumeFlatTaxRegime" checked>', '<input type="checkbox" id="assumeFlatTaxRegime">')
    body = body.replace('Assume 7% Flat Tax Regime in Sicily', 'Illustrative flat-tax abroad scenario')
    body = body.replace('Healthcare — Italy / Sicily (Couple)', 'Healthcare Estimates')

    if "why-panel-sicily" in body:
        why_start = body.index('<div class="why-panel why-panel-sicily"')
        why_end = body.index("</div>\n            </section>", why_start) + len("</div>")
        wg_start = general_body.index('<div class="why-panel why-panel-plan"')
        wg_end = general_body.index("</div>\n            </section>", wg_start) + len("</div>")
        body = body[:why_start] + general_body[wg_start:wg_end] + body[why_end:]

    body = replace_taxhealth_panel(body, general_body)

    # ---- SCRIPT ----
    script = s_script

    script = script.replace('const SS_MONTHLY = 2631;', 'const SS_ANNUAL = 13200;')
    script = script.replace('const SS_ANNUAL = SS_MONTHLY * 12;', '')
    script = script.replace(
        'const fmtEur = new Intl.NumberFormat("en-US", {\n      style: "currency",\n      currency: "EUR",\n      maximumFractionDigits: 0,\n    });\n\n',
        '',
    )

    # Location-specific constants from general (avoid duplicating shared consts)
    loc_consts = (
        extract_const_region(g_script, r"    const PRIVATE_HEALTHCARE_MONTHLY = ", r"    const US_HEALTHCARE_COUPLE_EST = ")
        + extract_const_region(g_script, r"    const US_STATE_NAMES = ", r"    const STANDARD_DEDUCTION_MFJ = ")
        + extract_const_region(g_script, r"    const DEFAULT_LOCATION = ", r"    const ADVANCED_TOGGLE_LABELS = ")
        + "    const COL_DESCRIPTION = \"Housing, food, transport & leisure for a comfortable lifestyle\";\n\n"
    )
    if "DEFAULT_LOCATION" not in script:
        script = script.replace(
            "    const EUR_USD = 1.08;\n",
            "    const EUR_USD = 1.08;\n" + loc_consts,
            1,
        )

    script = script.replace('const PLAN_NAME = "Realistic Sicily Plan";', 'const PLAN_NAME = "Your Retirement Plan";')
    script = script.replace('spending: 3300,', 'spending: 4000,')
    script = script.replace('original: { retirementAge: 55, resetPlan: true }', 'original: { retirementAge: 65, resetPlan: true }')
    script = script.replace('early: { retirementAge: 52, resetPlan: false }', 'early: { retirementAge: 62, resetPlan: false }')
    script = script.replace('later: { retirementAge: 58, resetPlan: false }', 'later: { retirementAge: 67, resetPlan: false }')
    script = script.replace('"sicilyPlannerViewMode"', '"retirementPlannerViewMode"')
    script = script.replace('"sicilyRetirementPlannerSettings"', '"retirementPlannerSettings"')

    script = re.sub(
        r"    const COL_TIERS = \{.*?\n    \};\n\n    function sicilyTown\(.*?\n    let activeSicilyTown = .*?\n",
        "",
        script,
        flags=re.S,
    )
    for pat in [
        r"    const DEFAULT_SICILY_TOWN_KEY = .*?\n",
        r"    const COL_DATA_NOTE = .*?\n",
        r"    const PLAN_OWNER_NAME = .*?\n",
        r"    const BASELINE_RETIREMENT_AGE = .*?\n",
        r"    const PRIVATE_TRAVEL_TIER_LABELS = \{.*?\n    \};\n",
    ]:
        script = re.sub(pat, "", script, count=1, flags=re.S)

    for fn in [
        "sicilyTown", "normalizeTownKey", "getSicilyLocationInput", "getTownSearchHaystack",
        "getTownNameParts", "scoreTownMatch", "filterTownsForSearch", "resolveSicilyTown",
        "getActiveSicilyTown", "getTownDisplayName", "formatCostOfLivingRangeEur",
        "usdSpendingToEurMonthly", "getCostOfLivingComparisonEur", "getNumbeoCostUrl",
        "syncHealthcarePublicSelect", "updateLocationLabels", "applySicilyTown",
        "hideLocationDropdown", "renderLocationDropdown", "getPrivateHealthcareMonthly",
        "getPrivateTravelMonthly", "getPrivateTravelTierLabel",
        "buildPersonalPlanNarrative", "renderPersonalPlanSummary", "updateFocusBanner",
        "formatImpactDelta", "buildRetirementImpactNotes", "updateRetirementImpactSummary",
        "getTaxableIncomeFromRow",
    ]:
        script = remove_function(script, fn)

    # inputs array with general healthcare fields
    script = re.sub(
        r'const inputs = \[.*?\];',
        """const inputs = [
      "inflow1Year", "inflow2Year", "inflow3Year", "inflow4Year", "specialOutflowYear",
      "ssStartAge", "inflateSpending",
      "healthcarePublicEur", "healthcarePre65Usd", "healthcareMedicareUsd",
      "extraPrivateHealthcare",
      "assumeFlatTaxRegime",
    ];""",
        script,
        count=1,
        flags=re.S,
    )

    script = script.replace(
        'return clampRetirementAge(readNumericField("retirementAge", 55));',
        'return clampRetirementAge(readNumericField("retirementAge", 65));',
    )

    # Inject core general functions after readRetirementAge
    core_functions = [
        "isPlaceholderLocation", "hasUserLocation", "getLocationRegion", "readBaseParams",
        "getUserLocation", "normalizeLocationField", "normalizeLocationKey",
        "getCostOfLivingEstimate", "formatCostOfLivingRange", "getCostOfLivingComparison",
        "updateCostOfLivingDisplay", "getPlanDisplayName",
        "formatInflowParts", "formatInflowsSummaryLine", "buildHouseLivingBullet",
        "buildAge90Closing", "buildPlanNarrative", "buildPlanMilestonesFootnote", "renderPlanSummary",
        "getHealthcareSupplementMonthly", "getHealthcareAnnualCost", "buildHousingReferenceLinks",
        "renderHousingReferenceLinks", "updateHousingSection", "updateHealthcareSectionUI",
        "updateDynamicSections", "getInflowSliderId", "updateLocationDisplays", "updateTaxSectionUI",
        "isUsTaxRegion", "isItalyLocation", "shouldIncludeResidenceTax",
        "commitAllInputs", "commitAllPendingInputs", "scheduleRecalculate", "runProjectionUpdate",
        "refreshLocationLabels", "handleLocationInput", "handleLocationBlur",
        "applyBaseParamsToForm", "collectPlannerSettings", "applyPlannerSettings",
        "updateHealthcarePanel", "buildTaxEstimate", "updatePlanSummary",
    ]
    # Remove truncated extractions from prior builds
    if "commitAllInputs({ includeFocused: false })" not in script:
        script = re.sub(r"    function commitAllInputs\(\{[^\}]*\}\s*\n+", "", script)

    script = ensure_functions(script, g_script, core_functions)

    # Force general versions over leftover Sicily implementations
    force_general = [
        "readBaseParams", "getHealthcareAnnualCost",
        "buildHouseLivingBullet", "buildAge90Closing", "buildPlanNarrative",
        "updateHealthcarePanel", "updateCostOfLivingDisplay",
        "runProjectionUpdate", "collectPlannerSettings", "applyPlannerSettings",
        "applyBaseParamsToForm",
    ]
    for fn in force_general + ["updatePlanSummary"]:
        script = remove_function(script, fn)
    for fn in force_general:
        body_src = extract_function(g_script, fn)
        if body_src:
            script = replace_function(script, fn, body_src)

    # CURRENCY_FIELD_CONFIGS const (before commitAllInputs)
    if "const CURRENCY_FIELD_CONFIGS" not in script:
        cfg = extract_const_region(g_script, r"    const CURRENCY_FIELD_CONFIGS = ", r"    function commitAllInputs")
        script = inject_after_function(script, "readRetirementAge", cfg, append=True)

    # Custom general helpers
    script = replace_function(script, "getTotalMonthlySpending", GET_TOTAL_MONTHLY_SPENDING)
    for fn in ["formatSpendingSummaryValue", "formatHouseBuySummaryValue", "formatHealthcareSummaryValue"]:
        block = re.search(rf"    function {fn}\(.*?\n    \}}\n", GENERAL_SUMMARY_FORMATTERS, re.S)
        if block:
            script = replace_function(script, fn, block.group(0))
    script = replace_function(script, "updateCurrentPlanSummary", UPDATE_CURRENT_PLAN_SUMMARY)

    script = patch_collect_planner_settings(script)
    script = patch_apply_planner_settings(script)

    # buildParams with donations
    script = re.sub(
        r"    function buildParams\(\) \{.*?\n    \}\n",
        """    function buildParams() {
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

""",
        script,
        count=1,
        flags=re.S,
    )

    # loadPlanIntoForm donations
    if "annualDonations" not in script.split("function loadPlanIntoForm")[1][:1500]:
        script = script.replace(
            "      syncInflowYearSelects();\n      syncAllSliders();\n    }\n",
            """      setNumericFieldDisplay("annualDonations", planState.annualDonations ?? 0, { currency: true });
      setNumericFieldDisplay("specialOutflowAmount", planState.specialOutflowAmount ?? 0, { currency: true });
      const specialYearEl = document.getElementById("specialOutflowYear");
      if (specialYearEl) specialYearEl.value = planState.specialOutflowYear ?? 0;
      syncInflowYearSelects();
      syncAllSliders();
    }

""",
            1,
        )

    # runProjection: pass age to healthcare cost
    script = script.replace(
        "const healthcareAnnual = getHealthcareAnnualCost(params, yearIndex);",
        "const healthcareAnnual = getHealthcareAnnualCost(params, yearIndex, age);",
    )

    # getTaxReferenceRow from general (more robust)
    g_tax_row = extract_function(g_script, "getTaxReferenceRow")
    if g_tax_row:
        script = replace_function(script, "getTaxReferenceRow", g_tax_row)

    for fn in [
        "getWithdrawalEducation", "withdrawalEducationNote", "updateWithdrawalBreakdown",
        "updateTaxEstimates", "updateTaxOptimization", "estimateScenarioTaxes",
    ]:
        block = extract_function(g_script, fn)
        if block:
            script = replace_function(script, fn, block)

    # recalculate
    script = script.replace("      updateFocusBanner(params);\n", "      updateLocationDisplays(params);\n")
    script = script.replace("      updateRetirementImpactSummary(result, params);\n", "")
    script = script.replace("      updateLocationLabels();\n", "      updateLocationDisplays(params);\n")

    # Chart labels
    script = script.replace(
        'legendMain = `<span><i style="background:${CHART_THEME.plan}"></i> Realistic Sicily Plan</span>`;',
        'legendMain = `<span><i style="background:${CHART_THEME.plan}"></i> ${getPlanDisplayName()}</span>`;',
    )
    script = script.replace('label: "Realistic Sicily Plan",', 'label: getPlanDisplayName(),')

    script = script.replace("renderPersonalPlanSummary(p, end);", "renderPlanSummary(p, end);")
    script = script.replace('<tr class="sicily-row">', "<tr>")

    script = re.sub(
        r"const sicilyLocationInput = document\.getElementById\(\"sicilyLocationInput\"\);.*?document\.getElementById\(\"updatePlanBtn\"\)\?\.addEventListener\(\"click\", \(\) => runProjectionUpdate\(\{ feedback: true \}\)\);",
        """document.getElementById("userLocation").addEventListener("input", handleLocationInput);
    document.getElementById("userLocation").addEventListener("change", handleLocationInput);
    document.getElementById("userLocation").addEventListener("blur", handleLocationBlur);
    document.getElementById("updatePlanBtn").addEventListener("click", () => runProjectionUpdate({ feedback: true }));""",
        script,
        flags=re.S,
    )
    script = re.sub(r"\s*applySicilyTown\(.*?\);\n", "", script)
    script = script.replace("updateRetirementImpactSummary();\n", "")

    # buildPlanMilestonesFootnote
    script = script.replace(
        "return buildPersonalPlanNarrative(params, end).footnote;",
        "return buildPlanNarrative(params, end).footnote;",
    )

    body = apply_body_repls(body)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Retirement Planner</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>{css}
  </style>
</head>
<body class="planner-view-simple">
{body}
  <script>
{script}
  </script>
</body>
</html>
"""

    html = apply_post_build_fixes(html)
    OUT.write_text(html, encoding="utf-8")

    t = OUT.read_text(encoding="utf-8")
    s = extract(t, "script")
    chk = OUT.parent / "_fullcheck.js"
    chk.write_text(s, encoding="utf-8")
    r = subprocess.run(["node", "--check", str(chk)], capture_output=True, text=True)
    chk.unlink(missing_ok=True)
    if r.returncode != 0:
        print(r.stderr)
        raise SystemExit(1)

    required_fns = [
        "getUserLocation", "readBaseParams", "scheduleRecalculate", "runProjectionUpdate",
        "updatePlanSummary", "updateCurrentPlanSummary", "updateLocationDisplays",
        "getHealthcareAnnualCost", "buildTaxEstimate", "updateHealthcarePanel",
        "buildPlanNarrative", "renderPlanSummary", "handleLocationInput",
    ]
    for fn in required_fns:
        if f"function {fn}" not in s:
            raise SystemExit(f"Missing required function: {fn}")

    for bad in [
        "Sicily Retirement Planner", "sicilyLocationInput", "Misterbianco", "getActiveSicilyTown",
        "renderPersonalPlanSummary", "buildPersonalPlanNarrative", "activeSicilyTown", "SICILY_TOWNS",
        "wife's existing home", "Catania Area", "PLAN_OWNER_NAME", "getTownDisplayName",
        "getPrivateHealthcareMonthly", "updateLocationLabels", "activeSicilyTown",
        "resolveSicilyTown", "getSicilyLocationInput", "sicilyLocation",
    ]:
        if bad in t:
            raise SystemExit(f"Still has {bad}")

    print(f"OK — {OUT.stat().st_size} bytes, {t.count(chr(10))} lines")


if __name__ == "__main__":
    main()