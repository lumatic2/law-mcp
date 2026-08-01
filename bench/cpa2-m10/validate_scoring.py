import hashlib
import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCORING = ROOT / "evidence/cpa2/2026-m10/scoring"
FROZEN = ROOT / "evidence/cpa2/2026-m10/frozen/rubric.json"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate(data: dict) -> None:
    assert set(data) == {"codex-with", "codex-without", "opus-with", "opus-without"}
    for arm, result in data.items():
        assert round(sum(row["score"] for row in result["units"]), 2) == result["score"]
        assert result["max"] == 24
        assert result["absolute_pass"] is None or arm.endswith("with")
        if arm.endswith("with"):
            assert result["absolute_pass"] == all(result["checks"].values())


def main() -> None:
    adjudicated = json.loads((SCORING / "rubric-adjudicated.json").read_text(encoding="utf-8"))
    assert adjudicated["derived_from_sha256"] == digest(FROZEN)
    assert adjudicated["derived_from_sha256"] == "7a97e05851c1795807ce45bdffc9889b49d753cfa1975a718a7880408a504330"
    before = digest(SCORING / "scores-blind.json")
    subprocess.run([sys.executable, str(ROOT / "bench/cpa2-m10/score_blind.py")], check=True)
    assert before == digest(SCORING / "scores-blind.json"), "blind second pass changed scores"
    scores = json.loads((SCORING / "scores-revealed.json").read_text(encoding="utf-8"))
    validate(scores)

    broken = json.loads(json.dumps(scores))
    broken["codex-with"]["score"] += 0.1
    try:
        validate(broken)
    except AssertionError:
        print("PASS: frozen digest, blind rescore, revealed mapping, and negative corruption probe")
        return
    raise AssertionError("negative corruption probe was not detected")


if __name__ == "__main__":
    main()
