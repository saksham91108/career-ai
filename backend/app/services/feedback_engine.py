import os
import json
import re
import logging
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


class FeedbackEngine:

    SCORE_LABELS = {
        (0, 40):   ("🔴 Not Ready",          "Your resume needs significant improvement for this role."),
        (40, 60):  ("🟡 Needs Improvement",   "Your resume has potential but is missing key requirements."),
        (60, 80):  ("🟢 Competitive",         "Your resume is solid but a few improvements could make it stronger."),
        (80, 101): ("🔥 Strong Candidate",    "Your resume is well-aligned with this role."),
    }

    def __init__(self):
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY environment variable is not set.")
        self.client = Groq(api_key=api_key)

    def generate_feedback(self, analysis_report: dict) -> dict:
        score          = analysis_report.get("overall_score", 0)
        match_details  = analysis_report.get("match_details", {})
        target_role    = analysis_report.get("target_role", "the target role")
        unvalidated    = analysis_report.get("unvalidated_skills", [])
        parsed_data    = analysis_report.get("parsed_data", {})
        score_reasoning= analysis_report.get("score_reasoning", "")

        label, _ = self._get_score_label(score)

        # Build missing skills list with category context
        missing_skills = []
        for category, details in match_details.items():
            if isinstance(details, dict):
                for skill in details.get("missing", []):
                    missing_skills.append(f"{skill} [{category.replace('_', ' ')}]")

        # Get raw resume text from sections for deep LLM analysis
        raw_sections = parsed_data.get("raw_section_text", {})
        full_resume_text = "\n\n".join([
            f"[{k.upper()}]\n{v}"
            for k, v in raw_sections.items()
            if v and v.strip() and k != "other"
        ])
        # Fallback if no sections detected
        if not full_resume_text.strip():
            full_resume_text = "Resume text not available."

        try:
            summary = self._llm_feedback(
                score=score,
                label=label,
                target_role=target_role,
                missing_skills=missing_skills,
                unvalidated=unvalidated,
                match_details=match_details,
                parsed_data=parsed_data,
                full_resume_text=full_resume_text,
                score_reasoning=score_reasoning,
            )
            recommendations = self._llm_recommendations(
                score=score,
                target_role=target_role,
                missing_skills=missing_skills,
                unvalidated=unvalidated,
                parsed_data=parsed_data,
                full_resume_text=full_resume_text,
            )
        except Exception as e:
            logger.warning(f"LLM feedback failed, using fallback: {str(e)}")
            summary = f"{label} — {self._get_score_label(score)[1]}"
            recommendations = self._rule_based_recommendations(match_details)

        return {
            "summary": summary,
            "recommendations": recommendations,
        }

    def _llm_feedback(
        self, score, label, target_role, missing_skills,
        unvalidated, match_details, parsed_data,
        full_resume_text, score_reasoning,
    ) -> str:

        # Human readable experience
        exp = parsed_data.get("experience_years", 0)
        if exp > 0 and exp < 1:
            exp_display = f"{round(exp * 12)} months"
        elif exp == 0:
            exp_display = "no experience detected"
        else:
            exp_display = f"{exp} years"

        sections_present = [k for k, v in parsed_data.get("sections", {}).items() if v]
        sections_missing = [k for k, v in parsed_data.get("sections", {}).items() if not v]
        word_count       = parsed_data.get("word_count", 0)
        education        = parsed_data.get("education", "Not detected")

        # Category breakdown string
        breakdown = ""
        for cat, details in match_details.items():
            if isinstance(details, dict):
                cat_score = details.get("score", 0)
                matched   = details.get("matched", [])
                missing   = details.get("missing", [])
                breakdown += (
                    f"\n  {cat.replace('_', ' ')}: {cat_score:.0f}% "
                    f"| matched: {matched} | missing: {missing}"
                )

        prompt = f"""You are a brutally honest senior tech recruiter with 15+ years experience at Google, Amazon, and Meta.
You have just read this candidate's FULL resume and analyzed it deeply.

TARGET ROLE: {target_role}
SCORE: {score}/100 — {label}
SCORE BREAKDOWN: {score_reasoning}

STRUCTURED ANALYSIS:
- Experience: {exp_display}
- Education: {education}
- Word count: {word_count}
- Sections present: {sections_present}
- Sections missing: {sections_missing}
- Unvalidated skills (listed but NOT shown in experience/projects): {unvalidated}
- Missing skills: {missing_skills[:8]}

SKILL CATEGORY SCORES:{breakdown}

FULL RESUME TEXT (read this carefully before writing your verdict):
---
{full_resume_text}
---

Write a 5-6 sentence brutally honest, DEEPLY SPECIFIC verdict.

You MUST comment on:
1. The actual quality of their project descriptions — are they vague or specific?
2. Whether their internship description shows real impact or just lists duties
3. Any red flags you notice (e.g. declaration section, no metrics, vague bullets)
4. Unvalidated skills by name if any exist
5. Missing sections and why they matter
6. What their score realistically means for getting interviews at companies

RULES:
- Reference ACTUAL content from their resume — project names, company names, specific bullets
- Never say "0.2 years" — say "{exp_display}"
- No bullet points — flowing paragraphs only
- No markdown — plain text only
- Second person only ("Your resume...", "You have...")
- End with ONE clear highest-priority action

Write the verdict now:"""

        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a brutally honest senior tech recruiter. "
                        "You read the full resume carefully and give specific, "
                        "deep feedback referencing actual content. "
                        "Never generic. Never vague. Always specific."
                    )
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=500,
        )
        return response.choices[0].message.content.strip()

    def _llm_recommendations(
        self, score, target_role, missing_skills,
        unvalidated, parsed_data, full_resume_text,
    ) -> list:

        exp = parsed_data.get("experience_years", 0)
        if exp > 0 and exp < 1:
            exp_display = f"{round(exp * 12)} months"
        elif exp == 0:
            exp_display = "none"
        else:
            exp_display = f"{exp} years"

        sections_missing = [k for k, v in parsed_data.get("sections", {}).items() if not v]
        word_count       = parsed_data.get("word_count", 0)

        prompt = f"""You are a senior resume coach. You have read this candidate's full resume.

TARGET ROLE: {target_role}
SCORE: {score}/100
EXPERIENCE: {exp_display}
WORD COUNT: {word_count}
MISSING SKILLS: {missing_skills[:8]}
UNVALIDATED SKILLS: {unvalidated[:5]}
MISSING SECTIONS: {sections_missing}

FULL RESUME TEXT:
---
{full_resume_text}
---

Give exactly 5 highly specific, actionable recommendations based on what you actually read.

RULES:
1. Reference ACTUAL content — mention specific project names, bullet points, or sections you read
2. For unvalidated skills — say exactly which project/experience to add them to by name
3. For vague bullets — rewrite them with a specific improved version as example
4. One recommendation MUST show how to quantify a specific bullet with numbers
5. For missing sections — say specifically what content to put in them
6. Never give generic advice like "add more skills" without naming the skill and where
7. Max 2 sentences per recommendation

Return ONLY a valid JSON array of exactly 5 strings. No markdown, no explanation.
["rec1", "rec2", "rec3", "rec4", "rec5"]"""

        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You return only valid JSON arrays. No markdown, no preamble."
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.5,
            max_tokens=500,
        )

        raw = response.choices[0].message.content.strip()

        try:
            clean = re.sub(r"```(?:json)?|```", "", raw).strip()
            recommendations = json.loads(clean)
            if isinstance(recommendations, list):
                return [str(r) for r in recommendations[:5]]
        except Exception:
            pass

        # Line by line fallback
        lines = [
            line.strip("•-1234567890. ").strip()
            for line in raw.split("\n") if line.strip()
        ]
        return [l for l in lines if len(l) > 10][:5]

    def _get_score_label(self, score: float):
        for (low, high), label in self.SCORE_LABELS.items():
            if low <= score < high:
                return label
        return ("🔴 Not Ready", "Your resume needs significant improvement.")

    def _rule_based_recommendations(self, match_details: dict) -> list:
        recommendations = []
        for category, details in match_details.items():
            if isinstance(details, dict):
                missing = details.get("missing", [])
                if missing:
                    missing_str = ", ".join(missing[:3])
                    recommendations.append(
                        f"Add missing {category.replace('_', ' ')} skills: {missing_str}."
                    )
        if not recommendations:
            recommendations.append(
                "Great coverage! Focus on quantifying achievements with metrics and impact."
            )
        return recommendations