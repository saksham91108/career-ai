import re
from datetime import datetime

SECTION_ALIASES = {
    "experience": [
        "experience", "work experience", "professional experience",
        "employment history", "internship experience", "internships",
        "work history", "professional background",
    ],
    "projects": [
        "projects", "academic projects", "personal projects",
        "side projects", "key projects", "project work",
    ],
    "skills": [
        "skills", "technical skills", "core competencies",
        "technologies", "tech stack", "tools", "core skills",
    ],
    "education": [
        "education", "academic background", "academic qualifications",
        "educational background", "qualifications", "academics",
    ],
    "achievements": [
        "achievements", "awards", "certifications", "accomplishments",
        "honors", "technical certificates", "certificates",
        "certifications & awards",
    ],
    "summary": [
        "summary", "objective", "profile", "about me",
        "professional summary", "career objective",
    ],
}

VALIDATED_SECTIONS = {"experience", "projects"}


class ResumeParser:

    def parse(self, text: str) -> dict:
        text_lower = text.lower()
        sections = self._extract_sections(text)

        return {
            "email": self._extract_email(text),
            "skills": [],
            "experience_years": self._extract_experience(text, sections),
            "education": self._extract_education(text_lower),
            "word_count": len(text.split()),
            "sections": {
                k: bool(v.strip())
                for k, v in sections.items()
                if k != "other"
            },
            "unvalidated_skills": [],
            "skill_evidence": {},
            "raw_section_text": sections,
        }

    def _extract_sections(self, text: str) -> dict:
        text_lower = text.lower()
        header_positions = []

        for section_key, aliases in SECTION_ALIASES.items():
            for alias in aliases:
                pattern = rf'(?:^|\n)\s*{re.escape(alias)}\s*(?:\n|:|\Z)'
                match = re.search(pattern, text_lower)
                if match:
                    header_positions.append((section_key, match.start()))
                    break

        header_positions.sort(key=lambda x: x[1])

        sections = {key: "" for key in SECTION_ALIASES.keys()}
        sections["other"] = ""

        for i, (section_key, start_pos) in enumerate(header_positions):
            end_pos = (
                header_positions[i + 1][1]
                if i + 1 < len(header_positions)
                else len(text)
            )
            sections[section_key] = text[start_pos:end_pos].strip()

        if header_positions:
            sections["other"] = text[:header_positions[0][1]].strip()

        return sections

    def _extract_email(self, text: str) -> str:
        match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", text)
        return match.group(0) if match else "Not found"

    def _extract_experience(self, text: str, sections: dict) -> float:
        """
        Scans only the EXPERIENCE section for date ranges.
        Prevents education dates from inflating experience years.
        Falls back to full text if no experience section found.
        """
        now = datetime.now()

        # Only scan experience section — avoids education date pollution
        exp_text = sections.get("experience", "").lower()
        scan_text = exp_text if exp_text.strip() else text.lower()

        total_months = 0

        date_range_pattern = re.findall(
            r'((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)'
            r'[a-z]*\.?\s+\d{4}|\d{4})'
            r'\s*[-–—to]+\s*'
            r'((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)'
            r'[a-z]*\.?\s+\d{4}|\d{4}|present|current|now|till date|to date)',
            scan_text
        )

        def parse_date(s: str):
            s = s.strip()
            if s in ("present", "current", "now", "till date", "to date"):
                return now
            for fmt in ("%b %Y", "%B %Y", "%Y"):
                try:
                    return datetime.strptime(s, fmt)
                except ValueError:
                    continue
            return None

        seen = set()
        for start_str, end_str in date_range_pattern:
            key = (start_str.strip(), end_str.strip())
            if key in seen:
                continue
            seen.add(key)
            start = parse_date(start_str)
            end = parse_date(end_str)
            if start and end and end >= start:
                months = (
                    (end.year - start.year) * 12
                    + (end.month - start.month)
                )
                total_months += max(months, 1)

        if total_months > 0:
            return min(round(total_months / 12, 1), 50)

        # Fallback: explicit "3 years", "6 months experience"
        year_matches = re.findall(
            r"\b([1-9]|[1-4][0-9])\+?\s*(?:years?|yrs?)"
            r"\s*(?:of\s*)?(?:experience)?",
            scan_text
        )
        month_matches = re.findall(
            r"\b(\d+)\s*-?\s*months?\s*"
            r"(?:of\s*)?(?:experience|internship|training)?",
            scan_text
        )

        all_values = (
            [int(m) for m in year_matches]
            + [round(int(m) / 12, 1) for m in month_matches]
        )
        return max(all_values, default=0)

    def _extract_education(self, text: str) -> str:
        if any(k in text for k in ["ph.d", "phd", "doctorate"]):
            return "PhD"
        if any(k in text for k in [
            "master", "m.s", "m.tech", "mca",
            "mba", "m.e", "m.sc", "pgdm",
            "post graduate", "postgraduate", "pg diploma",
        ]):
            return "Masters"
        if any(k in text for k in [
            "bachelor", "b.s", "b.tech", "b.e",
            "bca", "b.sc", "b.com", "b.a",
            "undergraduate", "under graduate",
        ]):
            return "Bachelors"
        return "Not detected"