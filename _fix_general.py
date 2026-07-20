#!/usr/bin/env python3
"""Fix remaining issues in rebuilt general Retirement-Planner."""
import re
from pathlib import Path

OUT = Path(r"C:\Users\Craig\Retirement-Projection\Retirement-Planner.html")
GENERAL = Path(r"C:\Users\Craig\Retirement-Projection\_general_backup.html")


def line_slice(text: str, start: int, end: int) -> str:
    lines = text.splitlines(keepends=True)
    return "".join(lines[start - 1 : end])


def main():
    text = OUT.read_text(encoding="utf-8")
    general = GENERAL.read_text(encoding="utf-8")
    g_script = general.split("<script>", 1)[1].split("</script>", 1)[0]

    # Fix broken constants block
    text = re.sub(
        r"const SS_MONTHLY = 2631;\n    const SS_ANNUAL = SS_MONTHLY \* 12;\n    const EUR_USD = 1\.08;\n\n      style: \"currency\",\n      currency: \"EUR\",\n      maximumFractionDigits: 0,\n    \}\);\n\n\n    \n    const PRIVATE_TRAVEL_TIER_LABELS = \{\n      500: \"Basic\",",
        line_slice(g_script, 5099, 5145) + "\n    const PRIVATE_TRAVEL_TIER_LABELS = {\n      300: \"Supplemental\",\n      500: \"Basic\",",
        text,
        count=1,
    )

    # Ensure DEFAULT_LOCATION and COST presets after PLAN_NAME if missing
    if "DEFAULT_LOCATION" not in text:
        text = text.replace(
            'const PLAN_NAME = "Your Retirement Plan";\n',
            'const PLAN_NAME = "Your Retirement Plan";\n'
            + line_slice(g_script, 5161, 5180),
            1,
        )

    # Add getInflowSliderId if missing
    if "function getInflowSliderId" not in text:
        text = text.replace(
            "const INFLOW_DEFAULT_YEARS = { inflow1: 2032, inflow2: 2042, inflow3: 0, inflow4: 0 };",
            line_slice(g_script, 5724, 5728).strip() + "\n    const INFLOW_DEFAULT_YEARS = { inflow1: 2032, inflow2: 2042, inflow3: 0, inflow4: 0 };",
            1,
        )

    # Add inputs array if missing
    if 'const inputs = [' not in text:
        text = text.replace(
            "const PLAN_DEFAULT = {",
            line_slice(g_script, 5703, 5709).strip() + "\n\n    const PLAN_DEFAULT = {",
            1,
        )

    script = text.split("<script>", 1)[1].split("</script>", 1)[0]

    # Inject general location/healthcare/housing block after readRetirementAge
    general_block = (
        line_slice(g_script, 5855, 6411)
        + line_slice(g_script, 6475, 6531)  # commit + location handlers
        + line_slice(g_script, 6357, 6421)  # updateLocationDisplays
        + line_slice(g_script, 8010, 8404)  # healthcare panel + tax
    )

    if "function getUserLocation" not in script:
        script = script.replace(
            "    function readRetirementAge() {\n      return clampRetirementAge(readNumericField(\"retirementAge\", 65));\n    }\n",
            "    function readRetirementAge() {\n      return clampRetirementAge(readNumericField(\"retirementAge\", 65));\n    }\n\n"
            + general_block,
            1,
        )

    # Replace Sicily narrative functions
    script = re.sub(
        r"    function buildHouseLivingBullet\(params\) \{.*?\n    \}\n\n    function buildAge90Closing\(params, end\) \{.*?\n    \}\n\n\n    function buildPlanMilestonesFootnote",
        line_slice(g_script, 5560, 5619).rstrip() + "\n\n    function buildPlanMilestonesFootnote",
        script,
        count=1,
        flags=re.S,
    )

    # Fix getTotalMonthlySpending - use supplemental from extraPrivateHealthcare
    script = re.sub(
        r"    function getTotalMonthlySpending\(params\) \{.*?\n    \}\n",
        """    function getTotalMonthlySpending(params) {
      const supplement = params.extraPrivateHealthcare
        ? getHealthcareSupplementMonthly(params.locationRegion)
        : 0;
      return Math.round(params.spending + supplement);
    }

    function getHealthcareSupplementMonthly(region) {
      return region === "us" ? US_SUPPLEMENT_MONTHLY : PRIVATE_HEALTHCARE_MONTHLY;
    }

""",
        script,
        count=1,
        flags=re.S,
    )

    # readBaseParams from general
    script = re.sub(
        r"    function readBaseParams\(\) \{.*?\n    \}\n",
        line_slice(g_script, 5888, 5903),
        script,
        count=1,
        flags=re.S,
    )

    # buildParams
    script = re.sub(
        r"    function buildParams\(\) \{.*?\n    \}\n",
        line_slice(g_script, 6526, 6539)
        .replace(
            "scenarioName: getPlanDisplayName(),",
            "scenarioName: getPlanDisplayName(),\n        annualDonations: state.annualDonations ?? 0,\n        specialOutflowAmount: state.specialOutflowAmount ?? 0,\n        specialOutflowYear: state.specialOutflowYear ?? 0,",
        ),
        script,
        count=1,
        flags=re.S,
    )

    # loadPlanIntoForm - add donations/outflows from Sicily version if missing
    if "annualDonations" not in script.split("function loadPlanIntoForm")[1].split("function applyBaseParamsToForm")[0]:
        script = script.replace(
            "      syncInflowYearSelects();\n      syncAllSliders();\n    }\n\n    function applyBaseParamsToForm",
            """      setNumericFieldDisplay("annualDonations", planState.annualDonations ?? 0, { currency: true });
      setNumericFieldDisplay("specialOutflowAmount", planState.specialOutflowAmount ?? 0, { currency: true });
      const specialYearEl = document.getElementById("specialOutflowYear");
      if (specialYearEl) specialYearEl.value = planState.specialOutflowYear ?? 0;
      syncInflowYearSelects();
      syncAllSliders();
    }

    function applyBaseParamsToForm""",
            1,
        )

    # applyBaseParamsToForm from general + extraPrivateHealthcare select fix
    script = re.sub(
        r"    function applyBaseParamsToForm\(base\) \{.*?\n    \}\n",
        line_slice(g_script, 6555, 6574).replace(
            'document.getElementById("extraPrivateHealthcare").checked = !!base.extraPrivateHealthcare;',
            'const privateTravelTier = base.privateTravelTier ?? (base.extraPrivateHealthcare ? 500 : 0);\n      document.getElementById("extraPrivateHealthcare").value = String(privateTravelTier);',
        ),
        script,
        count=1,
        flags=re.S,
    )

    # collectPlannerSettings
    script = re.sub(
        r"    function collectPlannerSettings\(\) \{.*?\n    \}\n",
        line_slice(g_script, 6576, 6616).replace(
            "inflowYears: { ...planState.inflowYears },\n        },",
            "inflowYears: { ...planState.inflowYears },\n          annualDonations: planState.annualDonations ?? 0,\n          specialOutflowAmount: planState.specialOutflowAmount ?? 0,\n          specialOutflowYear: planState.specialOutflowYear ?? 0,\n        },",
        ),
        script,
        count=1,
        flags=re.S,
    )

    # applyPlannerSettings
    script = re.sub(
        r"    function applyPlannerSettings\(data\) \{.*?\n      return true;\n    \}\n",
        line_slice(g_script, 6644, 6685),
        script,
        count=1,
        flags=re.S,
    )

    # updatePlanMilestonesTable
    script = script.replace("renderPersonalPlanSummary(p, end);", "renderPlanSummary(p, end);")
    script = script.replace('<tr class="sicily-row">', "<tr>")

    # Chart legend
    script = script.replace(
        'legendMain = `<span><i style="background:${CHART_THEME.plan}"></i> Realistic Sicily Plan</span>`;',
        "legendMain = `<span><i style=\"background:${CHART_THEME.plan}\"></i> ${getPlanDisplayName()}</span>`;",
    )
    script = script.replace(
        'label: "Realistic Sicily Plan",',
        'label: getPlanDisplayName(),',
    )

    # recalculate - ensure updateLocationDisplays
    if "updateLocationDisplays(params)" not in script.split("function recalculate")[1][:800]:
        script = script.replace(
            "      updateCurrentPlanSummary(params, mc);\n",
            "      updateLocationDisplays(params);\n      updateCurrentPlanSummary(params, mc);\n",
            1,
        )

    # Event listeners
    if 'getElementById("userLocation")' not in script:
        script = script.replace(
            'document.getElementById("updatePlanBtn")?.addEventListener("click", () => runProjectionUpdate({ feedback: true }));',
            'document.getElementById("userLocation").addEventListener("input", handleLocationInput);\n'
            '    document.getElementById("userLocation").addEventListener("change", handleLocationInput);\n'
            '    document.getElementById("userLocation").addEventListener("blur", handleLocationBlur);\n'
            '    document.getElementById("updatePlanBtn").addEventListener("click", () => runProjectionUpdate({ feedback: true }));',
        )

    # Remove any leftover sicily init
    script = re.sub(r"applySicilyTown\(.*?\);\n", "", script)
    script = script.replace("updateRetirementImpactSummary();\n", "")

    text = text.split("<script>", 1)[0] + "<script>" + script + "</script>" + text.split("</script>", 1)[1]
    OUT.write_text(text, encoding="utf-8")

    # Validate
    t = OUT.read_text(encoding="utf-8")
    s = t.split("<script>", 1)[1].split("</script>", 1)[0]
    Path(r"C:\Users\Craig\Retirement-Projection\_fullcheck.js").write_text(s, encoding="utf-8")
    import subprocess
    r = subprocess.run(["node", "--check", str(Path(r"C:\Users\Craig\Retirement-Projection\_fullcheck.js"))], capture_output=True, text=True)
    Path(r"C:\Users\Craig\Retirement-Projection\_fullcheck.js").unlink(missing_ok=True)

    bad = ["Sicily Retirement Planner", "sicilyLocationInput", "Misterbianco", "getActiveSicilyTown", "renderPersonalPlanSummary", "buildPersonalPlanNarrative", "PLAN_OWNER_NAME"]
    for b in bad:
        if b in t:
            raise SystemExit(f"Still contains: {b}")
    if r.returncode != 0:
        print(r.stderr)
        raise SystemExit("JS syntax error")
    assert "function getUserLocation" in s
    assert "function updateTable" in s
    assert "Your City, State / Country" in t
    print("Fix complete — JS OK, sanity passed")


if __name__ == "__main__":
    main()