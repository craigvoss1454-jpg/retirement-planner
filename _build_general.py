#!/usr/bin/env python3
"""Rebuild general Retirement-Planner from Sicily base + general backup logic."""
import re
from pathlib import Path

SICILY = Path(r"C:\Users\Craig\Retirement-Projection\Retirement-Planner.html")
GENERAL = Path(r"C:\Users\Craig\Retirement-Projection\_general_backup.html")
OUT = Path(r"C:\Users\Craig\Retirement-Projection\Retirement-Planner.html")


def extract_between(text: str, start_marker: str, end_marker: str) -> str:
    i = text.index(start_marker)
    j = text.index(end_marker, i + len(start_marker))
    return text[i:j]


def line_slice(text: str, start: int, end: int) -> str:
    lines = text.splitlines(keepends=True)
    return "".join(lines[start - 1 : end])


def main():
    sicily = SICILY.read_text(encoding="utf-8")
    general = GENERAL.read_text(encoding="utf-8")

    g_script = extract_between(general, "<script>", "</script>")
    s_script = extract_between(sicily, "<script>", "</script>")

    # --- CSS: add general-only rules from backup if missing ---
    extra_css = """
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

    #taxDetailSection[data-tax-mode="us"] .tax-abroad-only {
      display: none !important;
    }

    #taxDetailSection[data-tax-mode="us"] .tax-panel .tax-grid {
      grid-template-columns: 1fr 1fr;
    }

    @media (max-width: 800px) {
      #taxDetailSection[data-tax-mode="us"] .tax-panel .tax-grid {
        grid-template-columns: 1fr;
      }
    }

    .impact-risks strong {
      color: var(--accent-soft);
    }
"""
    sicily = sicily.replace("</style>", extra_css + "\n  </style>", 1)

    # Widen sidebar like polished general layout
    sicily = sicily.replace(
        "grid-template-columns: minmax(196px, 214px) minmax(0, 1fr);",
        "grid-template-columns: minmax(260px, 288px) minmax(0, 1fr);",
    )
    sicily = sicily.replace("gap: 0.55rem;", "gap: 0.75rem;", 1)

    # --- HEADER ---
    sicily = re.sub(
        r"<title>.*?</title>",
        "<title>Retirement Planner</title>",
        sicily,
        count=1,
    )

    old_header = extract_between(sicily, "<header>", "</header>")
    new_header = """<header>
      <div class="location-field-wrap no-print">
        <label for="userLocation" class="location-label">Your Location / City</label>
        <div class="location-input-row">
          <input type="text" id="userLocation" class="location-input" placeholder="e.g. Denver, CO or Barcelona, Spain" maxlength="80" value="Your City, State / Country" aria-label="Your location or city">
          <button type="button" class="update-plan-btn" id="updatePlanBtn">Update Plan</button>
        </div>
        <p class="location-hint no-print">Enter where you plan to live — cost-of-living and healthcare estimates update automatically</p>
      </div>
      <h1 id="plannerTitle">Retirement Planner</h1>
      <p class="subtitle" id="plannerSubtitle">See if your savings can fund the retirement you want</p>
      <p class="welcome-intro no-print">A friendly starting point for any retiree or pre-retiree. Adjust the assumptions on the left — your projection updates as you go. Switch to <strong>Advanced View</strong> only when you want extra detail.</p>
      <div class="header-actions">
        <div class="view-mode-toggle no-print" role="group" aria-label="Planner view mode">
          <button type="button" class="view-mode-btn active" id="viewModeSimple" data-view="simple" aria-pressed="true">Simple View</button>
          <span class="view-mode-divider" aria-hidden="true">↔</span>
          <button type="button" class="view-mode-btn" id="viewModeAdvanced" data-view="advanced" aria-pressed="false">Advanced View</button>
        </div>
        <button type="button" class="pdf-btn settings-btn no-print" id="saveSettingsBtn">Save Current Inputs</button>
        <button type="button" class="pdf-btn settings-btn no-print" id="loadSettingsBtn">Load Saved Inputs</button>
        <button type="button" class="pdf-btn" id="savePdf">Save as PDF</button>
        <span class="live-indicator no-print"><span class="live-dot"></span> Live updates</span>
      </div>
    </header>"""
    sicily = sicily.replace(old_header, new_header)

    # --- ASSUMPTIONS CARD HEADER + INTRO ---
    sicily = sicily.replace(
        '<div class="card-header">Assumptions</div>\n          <div class="card-body">',
        '<div class="card-header">Your Assumptions</div>\n          <div class="card-body">\n            <p class="assumptions-intro">These defaults are a reasonable starting point. Change anything that doesn\'t match your situation — the chart and summary refresh automatically.</p>',
        1,
    )

    # Essentials defaults
    replacements = [
        ('data-tip="After-tax cash you want to spend each month in Sicily — drives IRA withdrawals and taxes."',
         'data-tip="After-tax cash you want to spend each month — drives portfolio withdrawals and taxes."'),
        ('id="spending" value="3,300"', 'id="spending" value="4,000"'),
        ('value="3300"', 'value="4000"'),
        ('<p class="field-micro-hint">Desired lifestyle spending · default $3,300/mo</p>',
         '<p class="field-micro-hint">How much you want to spend each month after taxes — compare to the cost-of-living box in your plan</p>'),
        ('id="retirementAge" value="55"', 'id="retirementAge" value="65"'),
        ('id="sliderRetirementAge" min="50" max="75" step="1" value="55"', 'id="sliderRetirementAge" min="50" max="75" step="1" value="65"'),
        ('<p class="field-micro-hint">Original plan: age 55 (2031)</p>',
         '<p class="field-micro-hint">When you stop working and start drawing from savings — pension lump sum arrives this year</p>'),
        ('<div class="retirement-impact-inline advanced-only" id="retirementImpactInline"></div>', ''),
        ('Inheritance\n                    <span class="info-tip field-tip" tabindex="0" data-tip="Any other lump sum — inheritance, gift, or asset sale — added in the year selected. Default $0.">?',
         'Inheritance / Other\n                    <span class="info-tip field-tip" tabindex="0" data-tip="Inheritance, gift, or other lump sum — added to your portfolio in the year selected. Default $0.">?'),
        ('<label for="k401">401(k) balance</label>',
         '<label for="k401">401(k) / IRA balance</label>'),
        ('id="k401" value="538,474"', 'id="k401" value="500,000"'),
        ('aria-label="Current 401k balance"', 'aria-label="Current 401k or IRA balance"'),
        ('<label for="pension">Pension lump sum</label>',
         '<label for="pension">Pension / other lump sum</label>'),
        ('id="pension" value="626,286"', 'id="pension" value="300,000"'),
        ('aria-label="Pension lump sum"', 'aria-label="Pension or other lump sum"'),
        ('<label for="house">Sicily home buy</label>',
         '<label for="house">Home purchase</label>'),
        ('data-tip="Optional future home buy in Sicily. Default $0 — you live in your wife\'s existing Misterbianco home."',
         'data-tip="Optional future home purchase. Default $0 if you do not plan to buy."'),
        ('<p class="field-micro-hint">See housing market section for typical Catania-area prices</p>',
         '<p class="field-micro-hint">Optional — see housing market section for research links</p>'),
        ('data-tip="When you claim Social Security — $31,572/yr ($2,631/mo) for this plan. Portfolio withdrawals drop once SS begins."',
         'data-tip="When you claim Social Security — $13,200/yr ($1,100/mo) typical. Portfolio withdrawals drop once SS begins."'),
        ('<button type="button" class="what-if-btn active" data-preset="original">Original Plan (Age 55)</button>',
         '<button type="button" class="what-if-btn active" data-preset="original">Original Plan (Age 65)</button>'),
        ('<button type="button" class="what-if-btn" data-preset="early">Early Retirement (Age 52)</button>',
         '<button type="button" class="what-if-btn" data-preset="early">Early Retirement (Age 62)</button>'),
        ('<button type="button" class="what-if-btn" data-preset="later">Later Retirement (Age 58)</button>',
         '<button type="button" class="what-if-btn" data-preset="later">Later Retirement (Age 67)</button>'),
    ]
    for old, new in replacements:
        sicily = sicily.replace(old, new)

    # Healthcare section - replace entire accordion panel
    hc_old = extract_between(
        sicily,
        '<div class="sidebar-accordion" data-accordion>\n              <button type="button" class="sidebar-accordion-btn" aria-expanded="false">\n                Healthcare',
        '</div>\n            </div>\n\n            <div class="sidebar-accordion sidebar-what-if',
    )
    hc_new = line_slice(
        general,
        4987,
        5064,
    )
    sicily = sicily.replace(hc_old, hc_new)

    # Dashboard focus banner + plan summary
    dashboard_old_start = sicily.index('<div class="dashboard-focus-banner"')
    dashboard_old_end = sicily.index('</section>\n\n        <section class="dashboard-head-meta">')
    dashboard_new = """<div class="dashboard-focus-banner" id="dashboardFocusBanner">
            <span class="focus-badge">Getting started</span>
            <span class="focus-title" id="focusPlanTitle">Your Retirement Plan</span>
            <span class="focus-sub" id="focusBannerSub">$4,000/mo · retire at 65 · add your location above</span>
          </div>

        <section class="dashboard-head">
          <div class="plan-summary-card card">
            <div class="plan-summary-header" id="planSummaryHeader">Your Plan</div>
            <div class="plan-summary-body">
              <div class="plan-summary-columns">
                <div class="plan-summary-main">
                  <div class="compare-balance-label">Balance at age 90</div>
                  <div class="compare-balance" id="planSummaryBalance">—</div>
                  <div class="compare-meta" id="planSummaryMeta">—</div>
                  <div class="compare-tags" id="planSummaryTags">
                    <span class="compare-tag" id="planTagHousing">No home purchase</span>
                    <span class="compare-tag" id="planTagSpending">$4,000/mo</span>
                    <span class="compare-tag" id="planTagReturn">6.5% return</span>
                    <span class="compare-tag" id="planTagSS">SS at 62</span>
                  </div>
                </div>
                <div class="compare-withdrawal-breakdown plan-withdrawal-panel">
                  <div class="compare-wd-title">Withdrawals</div>
                  <div class="compare-wd-row">
                    <span class="compare-wd-label">Monthly spending (total)</span>
                    <span class="compare-wd-value" id="planSummarySpending">—</span>
                  </div>
                  <p class="compare-wd-spending-detail" id="planSummarySpendingDetail" hidden></p>
                  <div class="compare-wd-row compare-wd-gross">
                    <span class="compare-wd-label">Gross withdrawal needed<span class="info-tip" tabindex="0" data-tip="How much to pull from retirement accounts before taxes, so you still have your target spending left after estimated taxes.">?</span></span>
                    <span class="compare-wd-value" id="planSummaryGross">—</span>
                  </div>
                  <div class="compare-wd-row">
                    <span class="compare-wd-label">Est. taxes<span class="info-tip" tabindex="0" data-tip="Taxes are paid from your IRA withdrawal, so the gross pull is higher than what you actually spend.">?</span></span>
                    <span class="compare-wd-value compare-wd-tax" id="planSummaryTaxes">—</span>
                  </div>
                  <p class="compare-wd-note" id="planSummaryWdNote">Withdrawal is sized so after taxes you keep your target monthly spending.</p>
                </div>
                <div class="cost-of-living-panel" id="costOfLivingPanel">
                  <div class="col-panel-title">Average Cost of Living</div>
                  <div class="col-panel-location" id="costOfLivingLocation">Your City, State / Country</div>
                  <div class="col-panel-value" id="costOfLivingRange">—</div>
                  <div class="col-panel-audience">Comfortable couple / family</div>
                  <p class="col-panel-note" id="costOfLivingNote">Housing, food, transport &amp; leisure for a comfortable lifestyle</p>
                  <div class="col-panel-compare" id="costOfLivingCompare" hidden>
                    <span class="col-compare-label">Your monthly spending</span>
                    <span class="col-compare-value" id="costOfLivingPlanSpending">$4,000/mo</span>
                    <span class="col-compare-vs" id="costOfLivingVsNote"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>"""
    sicily = sicily[:dashboard_old_start] + dashboard_new + sicily[dashboard_old_end:]

    # Stats row defaults
    sicily = sicily.replace('<span id="statRetAge">55</span>', '<span id="statRetAge">65</span>')

    # Chart title
    sicily = re.sub(
        r'<span[^>]*>Portfolio Projection — Realistic Sicily Plan</span>',
        '<span id="chartSectionTitle">Portfolio Projection — Your Retirement Plan</span>',
        sicily,
        count=1,
    )

    # Housing section
    housing_old = extract_between(
        sicily,
        '<section class="card housing-market-section',
        '</section>\n\n        <div class="advanced-analysis-wrap',
    )
    housing_new = line_slice(general, 5260, 5278)
    sicily = sicily.replace(housing_old, housing_new.lstrip())

    # Tax tab hint + section opening
    sicily = sicily.replace(
        'Enable <strong>Detailed tax breakdown</strong> in Advanced Options (below the chart) for US/Italy estimates and IRA withdrawal math.',
        'Enable <strong>Detailed tax breakdown</strong> in Advanced Options (below the chart) for estimated US taxes and retirement-account withdrawal math.',
    )
    sicily = sicily.replace(
        '<div id="taxDetailSection" hidden>',
        '<div id="taxDetailSection" data-tax-mode="us" hidden>',
        1,
    )

    # Replace tax intro block
    tax_intro_old = extract_between(
        sicily,
        '<div class="tax-plan-intro">',
        '</div>\n\n        <section class="dashboard-row dashboard-taxhealth"',
    )
    tax_intro_new = line_slice(general, 5416, 5424)
    sicily = sicily.replace(tax_intro_old, tax_intro_new)

    # Tax scenario name default
    sicily = sicily.replace(
        'Tax Estimates — <span id="taxScenarioName">Realistic Sicily Plan</span>',
        'Tax Estimates — <span id="taxScenarioName">Your Retirement Plan</span>',
    )
    sicily = sicily.replace(
        '<div class="stat-label" id="statItalyTaxLabel">Italy 7% Flat (Optional)</div>',
        '<div class="stat-label" id="statItalyTaxLabel">Residence tax (if abroad)</div>',
    )
    sicily = sicily.replace(
        'class="tax-item">\n                  <div class="stat-label" id="statItalyTaxLabel">Residence tax (if abroad)</div>',
        'class="tax-item tax-abroad-only" id="taxAbroadItem">\n                  <div class="stat-label" id="statItalyTaxLabel">Residence tax (if abroad)</div>',
        1,
    )

    # Flat tax toggle
    sicily = sicily.replace(
        '<input type="checkbox" id="assumeFlatTaxRegime" checked>',
        '<input type="checkbox" id="assumeFlatTaxRegime">',
    )
    sicily = sicily.replace(
        'Assume 7% Flat Tax Regime in Sicily',
        'Illustrative flat-tax abroad scenario',
    )
    sicily = sicily.replace('id="flatTaxToggleLabel"', 'id="flatTaxToggleLabel"', 1)

    # Healthcare panel in tax tab
    sicily = re.sub(
        r'<div class="card-header">Healthcare — Italy / Sicily \(Couple\)</div>',
        '<div class="card-header" id="healthcarePanelHeader">Healthcare Estimates</div>',
        sicily,
        count=1,
    )

    # --- JAVASCRIPT MERGE ---
    # Remove Sicily town data and functions
    s_script = re.sub(
        r"function sicilyTown\(.*?\n    const SICILY_GENERIC_TOWN = \{.*?\n    \};\n",
        "",
        s_script,
        flags=re.S,
    )
    s_script = re.sub(
        r"    const SICILY_TOWNS = \[.*?\n    \];\n",
        "",
        s_script,
        flags=re.S,
    )
    s_script = re.sub(
        r"    const SICILY_TOWN_BY_KEY = .*?\n",
        "",
        s_script,
    )
    s_script = re.sub(
        r"    const DEFAULT_SICILY_TOWN_KEY = .*?\n",
        "",
        s_script,
    )
    s_script = re.sub(
        r"    const COL_TIERS = \{.*?\n    \};\n",
        "",
        s_script,
        flags=re.S,
    )
    s_script = re.sub(
        r"    const COL_DATA_NOTE = .*?\n",
        "",
        s_script,
    )
    s_script = re.sub(
        r"    const fmtEur = .*?\n",
        "",
        s_script,
    )
    s_script = re.sub(
        r"    let activeSicilyTown = .*?\n",
        "",
        s_script,
    )
    s_script = re.sub(
        r"    const PLAN_OWNER_NAME = .*?\n",
        "",
        s_script,
    )
    s_script = re.sub(
        r"    const BASELINE_RETIREMENT_AGE = .*?\n",
        "",
        s_script,
    )

    # Remove Sicily-only functions (block removals)
    sicily_fn_patterns = [
        r"    function normalizeTownKey\(.*?\n    \}\n",
        r"    function getSicilyLocationInput\(.*?\n    \}\n",
        r"    function getTownSearchHaystack\(.*?\n    \}\n",
        r"    function getTownNameParts\(.*?\n    \}\n",
        r"    function scoreTownMatch\(.*?\n    \}\n",
        r"    function filterTownsForSearch\(.*?\n    \}\n",
        r"    function resolveSicilyTown\(.*?\n    \}\n",
        r"    function getActiveSicilyTown\(.*?\n    \}\n",
        r"    function getTownDisplayName\(.*?\n    \}\n",
        r"    function formatCostOfLivingRangeEur\(.*?\n    \}\n",
        r"    function usdSpendingToEurMonthly\(.*?\n    \}\n",
        r"    function getCostOfLivingComparisonEur\(.*?\n    \}\n",
        r"    function getNumbeoCostUrl\(.*?\n    \}\n",
        r"    function syncHealthcarePublicSelect\(.*?\n    \}\n",
        r"    function updateLocationLabels\(.*?\n    \}\n",
        r"    function applySicilyTown\(.*?\n    \}\n",
        r"    function hideLocationDropdown\(.*?\n    \}\n",
        r"    function renderLocationDropdown\(.*?\n    \}\n",
        r"    function getPrivateHealthcareMonthly\(.*?\n    \}\n",
        r"    function buildPersonalPlanNarrative\(.*?\n    \}\n",
        r"    function renderPersonalPlanSummary\(.*?\n    \}\n",
        r"    function updateFocusBanner\(.*?\n    \}\n",
        r"    function formatImpactDelta\(.*?\n    \}\n",
        r"    function buildRetirementImpactNotes\(.*?\n    \}\n",
        r"    function updateRetirementImpactSummary\(.*?\n    \}\n",
        r"    function getTaxableIncomeFromRow\(.*?\n    \}\n",
    ]
    for pat in sicily_fn_patterns:
        s_script = re.sub(pat, "", s_script, flags=re.S)

    # Replace Sicily updateCostOfLivingDisplay with general version
    s_script = re.sub(
        r"    function updateCostOfLivingDisplay\(.*?\n    \}\n",
        line_slice(g_script, 6057, 6088),
        s_script,
        count=1,
        flags=re.S,
    )

    # Inject general constants after SS_ANNUAL
    general_constants = line_slice(g_script, 5614, 5680)
    general_constants += line_slice(g_script, 5726, 5728)  # getInflowSliderId
    s_script = s_script.replace(
        "    const SS_ANNUAL = 31572;",
        "    const SS_ANNUAL = 13200;\n" + general_constants,
        1,
    )

    # Replace PLAN_NAME, PLAN_DEFAULT, WHAT_IF_PRESETS, storage keys
    s_script = re.sub(
        r'const PLAN_NAME = "Realistic Sicily Plan";',
        'const PLAN_NAME = "Your Retirement Plan";',
        s_script,
    )
    s_script = re.sub(
        r"spending: 3300,", "spending: 4000,", s_script, count=1
    )
    s_script = re.sub(
        r"original: \{ retirementAge: 55, resetPlan: true \}",
        "original: { retirementAge: 65, resetPlan: true }",
        s_script,
    )
    s_script = re.sub(
        r"early: \{ retirementAge: 52, resetPlan: false \}",
        "early: { retirementAge: 62, resetPlan: false }",
        s_script,
    )
    s_script = re.sub(
        r"later: \{ retirementAge: 58, resetPlan: false \}",
        "later: { retirementAge: 67, resetPlan: false }",
        s_script,
    )
    s_script = s_script.replace(
        'const PLANNER_VIEW_STORAGE_KEY = "sicilyPlannerViewMode";',
        'const PLANNER_VIEW_STORAGE_KEY = "retirementPlannerViewMode";',
    )
    s_script = s_script.replace(
        'const PLANNER_SETTINGS_STORAGE_KEY = "sicilyRetirementPlannerSettings";',
        'const PLANNER_SETTINGS_STORAGE_KEY = "retirementPlannerSettings";',
    )

    # Update inputs array
    s_script = re.sub(
        r'const inputs = \[[^\]]+\];',
        line_slice(g_script, 5703, 5709).strip(),
        s_script,
        count=1,
        flags=re.S,
    )

    # Insert general location helpers after readRetirementAge
    insert_block = (
        line_slice(g_script, 5855, 5886)
        + line_slice(g_script, 5984, 6093)
        + line_slice(g_script, 6133, 6182)
        + line_slice(g_script, 6201, 6411)
    )
    s_script = s_script.replace(
        "    function readRetirementAge() {\n      return clampRetirementAge(readNumericField(\"retirementAge\", 55));\n    }\n",
        "    function readRetirementAge() {\n      return clampRetirementAge(readNumericField(\"retirementAge\", 65));\n    }\n\n"
        + insert_block,
        1,
    )

    # readBaseParams - use general version
    s_script = re.sub(
        r"    function readBaseParams\(\) \{.*?\n    \}\n",
        line_slice(g_script, 5888, 5903),
        s_script,
        count=1,
        flags=re.S,
    )

    # Replace getHealthcareAnnualCost
    s_script = re.sub(
        r"    function getHealthcareAnnualCost\(params, yearIndex\) \{.*?\n    \}\n",
        line_slice(g_script, 6229, 6240),
        s_script,
        count=1,
        flags=re.S,
    )

    # Insert commit helpers before scheduleRecalculate
    if "function commitAllPendingInputs" not in s_script:
        s_script = s_script.replace(
            "    function scheduleRecalculate() {",
            line_slice(g_script, 6475, 6495) + "\n    function scheduleRecalculate() {",
            1,
        )
        s_script = s_script.replace(
            "    function scheduleRecalculate() {\n      clearTimeout(debounceTimer);\n      debounceTimer = setTimeout(recalculate, 120);\n    }",
            line_slice(g_script, 6497, 6502),
            1,
        )

    # runProjectionUpdate - use general
    s_script = re.sub(
        r"    function runProjectionUpdate\(\{ feedback = false \} = \{\}\) \{.*?\n    \}\n",
        line_slice(g_script, 6505, 6516),
        s_script,
        count=1,
        flags=re.S,
    )

    # Location handlers
    if "function handleLocationInput" not in s_script:
        s_script = s_script.replace(
            "    function bindSlider(binding) {",
            line_slice(g_script, 6518, 6531) + "\n    function bindSlider(binding) {",
            1,
        )

    # updateLocationDisplays
    if "function updateLocationDisplays" not in s_script:
        s_script = s_script.replace(
            "    function updateAdvancedPanels() {",
            line_slice(g_script, 6948, 7012) + "\n    function updateAdvancedPanels() {",
            1,
        )

    # updatePlanSummary references
    s_script = s_script.replace(
        "renderPersonalPlanSummary(params, end);",
        "renderPlanSummary(params, end);",
    )
    s_script = s_script.replace(
        "updateCostOfLivingDisplay(getActiveSicilyTown(params), params.spending);",
        "updateCostOfLivingDisplay(getUserLocation(), params.spending);",
    )

    # recalculate - ensure updateLocationDisplays and updateDynamicSections
    s_script = s_script.replace(
        "      updateLocationLabels();\n",
        "      updateLocationDisplays(params);\n      updateDynamicSections(params);\n",
    )

    # updateCurrentPlanSummary - use general location
    s_script = re.sub(
        r"    function updateCurrentPlanSummary\(params, mc\) \{.*?\n      updateCurrentPlanSummaryMonteCarlo\(mc\);\n    \}\n",
        line_slice(g_script, 7541, 7572),
        s_script,
        count=1,
        flags=re.S,
    )

    # updatePlanSummary
    s_script = re.sub(
        r"    function updatePlanSummary\(result\) \{.*?\n    \}\n",
        line_slice(g_script, 7574, 7593),
        s_script,
        count=1,
        flags=re.S,
    )

    # buildParams scenarioName
    s_script = s_script.replace(
        'scenarioName: "Realistic Sicily Plan"',
        'scenarioName: PLAN_NAME',
    )
    s_script = s_script.replace(
        "getPlanDisplayName()",
        "getPlanDisplayName()",
    )
    if "function getPlanDisplayName" not in s_script:
        pass  # already injected

    # Tax functions from general
    for fn_block, start, end in [
        ("buildTaxEstimate", 8238, 8268),
        ("tax_flags", 8270, 8282),
        ("updateTaxSectionUI", 8284, 8376),
        ("tax_calc", 8378, 8404),
    ]:
        pass

    if "function buildTaxEstimate" not in s_script:
        tax_block = (
            line_slice(g_script, 8238, 8404)
            + line_slice(g_script, 8010, 8105)  # updateHealthcarePanel
        )
        s_script = s_script.replace(
            "    function updateHealthcarePanel(params) {",
            tax_block + "\n    function updateHealthcarePanel(params) {",
            1,
        )
        # Remove old sicily updateHealthcarePanel body - actually we prepended, need to replace whole function
        s_script = re.sub(
            r"    function updateHealthcarePanel\(params\) \{.*?\n    \}\n",
            line_slice(g_script, 8010, 8105),
            s_script,
            count=1,
            flags=re.S,
        )

    # updateTaxOptimization / updateTaxEstimates - ensure they call updateTaxSectionUI
    if "updateTaxSectionUI" not in s_script:
        s_script = s_script.replace(
            "    function updateTaxEstimates(",
            line_slice(g_script, 8270, 8404) + "\n    function updateTaxEstimates(",
            1,
        )

    # getWithdrawalRateContextNote - general wording
    s_script = s_script.replace("pension / IRA rollover", "pension / lump sum")

    # formatInflowsCell label
    s_script = s_script.replace(
        'const label = params.pension > 0 ? "pension / IRA rollover" : "lump sum";',
        'const label = params.pension > 0 ? "pension / lump sum" : "lump sum";',
    )

    # Event listeners - replace sicily location with general
    s_script = re.sub(
        r"const sicilyLocationInput = document\.getElementById\(\"sicilyLocationInput\"\);.*?applySicilyTown\(.*?\);\n",
        "",
        s_script,
        flags=re.S,
    )
    if 'getElementById("userLocation")' not in s_script:
        s_script = s_script.replace(
            'document.getElementById("updatePlanBtn")?.addEventListener("click", () => runProjectionUpdate({ feedback: true }));',
            'document.getElementById("userLocation").addEventListener("input", handleLocationInput);\n'
            '    document.getElementById("userLocation").addEventListener("change", handleLocationInput);\n'
            '    document.getElementById("userLocation").addEventListener("blur", handleLocationBlur);\n'
            '    document.getElementById("updatePlanBtn").addEventListener("click", () => runProjectionUpdate({ feedback: true }));',
        )

    # Remove sicily init
    s_script = s_script.replace(
        "applySicilyTown(SICILY_TOWN_BY_KEY[DEFAULT_SICILY_TOWN_KEY], { updateInput: true, syncHealthcare: true });\n",
        "",
    )
    s_script = s_script.replace(
        "updateRetirementImpactSummary();\n",
        "",
    )

    # Reassemble
    sicily = sicily.replace(extract_between(sicily, "<script>", "</script>"), s_script)

    OUT.write_text(sicily, encoding="utf-8")
    print("Built", OUT, "size", OUT.stat().st_size)

    # sanity
    text = OUT.read_text(encoding="utf-8")
    assert "Sicily Retirement Planner" not in text
    assert "sicilyLocationInput" not in text
    assert "Misterbianco" not in text
    assert "Your City, State / Country" in text
    assert "function updateTable" in text
    assert "function updateWithdrawalRules" in text
    print("Sanity checks passed")


if __name__ == "__main__":
    main()