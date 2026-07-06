import re
import logging

logger = logging.getLogger(__name__)


class ResumeScorer:
    """
    100% deterministic scorer.
    Pure text matching with aliases against a fixed skill matrix.
    Same resume + same role = identical score every single run.
    """

    SKILL_ALIASES = {
        "rest api":         ["rest api", "restful api", "restful", "custom api",
                             "custom apis", "external api", "external apis",
                             "rest web services", "rest services", "web services"],
        "oops":             ["oops", "oop", "object oriented", "object-oriented",
                             "object-oriented programming"],
        "data structures":  ["data structures", "data structure", "dsa"],
        "sql":              ["sql", "mysql", "postgresql", "sqlite", "mssql", "mongodb",
                             "nosql", "database"],
        "system design":    ["system design", "architecture", "full-stack architecture",
                             "full stack architecture", "full-stack", "architected",
                             "system architecture", "designed system", "microservices"],
        "agile":            ["agile", "scrum", "sprint", "kanban", "jira"],
        "api integration":  ["api integration", "integrating apis", "integrating external",
                             "api", "apis", "third-party api", "third party api",
                             "external api", "api development"],
        "node.js":          ["node.js", "nodejs", "node js", "expressjs", "express.js",
                             "express js"],
        ".net":             [".net", "dotnet", "dot net", "asp.net"],
        "ci/cd":            ["ci/cd", "ci cd", "continuous integration",
                             "continuous deployment", "continuous delivery",
                             "circleci", "circle ci", "github actions", "jenkins",
                             "jenkins pipeline", "travis ci", "travis"],
        "machine learning": ["machine learning", "ml model", "deep learning", "ml",
                             "artificial intelligence", "ai model", "neural network"],
        "power bi":         ["power bi", "powerbi"],
        "github actions":   ["github actions", "github action", "gh actions"],
        "scikit-learn":     ["scikit-learn", "sklearn"],
        "a/b testing":      ["a/b testing", "ab testing", "split testing"],
        "google sheets":    ["google sheets", "gsheets"],
        "google analytics": ["google analytics", "ga4"],
        "infrastructure as code": ["infrastructure as code", "iac", "terraform",
                                   "ansible", "cloudformation"],
        "data analysis":    ["data analysis", "data analytics", "analytics",
                             "data processing", "data pipeline"],
        "test automation":  ["test automation", "automated testing", "automation testing",
                             "unit testing", "integration testing", "e2e testing",
                             "end to end testing"],
        "api testing":      ["api testing", "postman", "swagger", "rest assured",
                             "insomnia"],
        "react":            ["react", "reactjs", "react.js", "react native"],
        "angular":          ["angular", "angularjs", "angular.js", "angular 2+"],
        "django":           ["django", "django rest framework", "drf"],
        "spring":           ["spring", "spring boot", "spring mvc", "spring framework"],
        "docker":           ["docker", "containerization", "container", "dockerfile"],
        "kubernetes":       ["kubernetes", "k8s", "kubectl", "helm"],
        "aws":              ["aws", "amazon web services", "ec2", "s3", "lambda",
                             "cloudwatch", "rds"],
        "git":              ["git", "github", "gitlab", "bitbucket", "version control"],
        "python":           ["python", "python3", "django", "flask", "fastapi"],
        "javascript":       ["javascript", "js", "es6", "typescript", "ts", "node"],
        "java":             ["java", "spring", "maven", "gradle", "junit"],
        "html":             ["html", "html5", "markup"],
        "css":              ["css", "css3", "sass", "scss", "tailwind", "bootstrap"],
        "tensorflow":       ["tensorflow", "tf", "keras"],
        "pytorch":          ["pytorch", "torch"],
        "pandas":           ["pandas", "dataframe"],
        "numpy":            ["numpy", "np"],
        "selenium":         ["selenium", "webdriver"],
        "pytest":           ["pytest", "unittest", "test suite"],
        "cypress":          ["cypress", "e2e testing"],
        "heroku":           ["heroku", "render", "railway"],
        "mysql":            ["mysql", "mariadb"],
        "postgresql":       ["postgresql", "postgres"],
    }

    ROLE_SKILL_MATRIX = {
        "software engineer": {
            "core_languages":       ["python", "javascript", "java", "c#", "html", "css"],
            "frameworks_libraries": ["react", "angular", "node.js", ".net", "spring", "django"],
            "concepts_practices":   ["rest api", "oops", "data structures", "system design", "agile", "api integration"],
            "tools_platforms":      ["git", "mysql", "sql", "postman", "swagger", "docker"],
        },
        "data scientist": {
            "core_languages":       ["python", "r", "sql", "scala", "julia"],
            "frameworks_libraries": ["tensorflow", "pytorch", "scikit-learn", "pandas", "numpy", "keras"],
            "concepts_practices":   ["machine learning", "deep learning", "statistics", "feature engineering", "data analysis", "nlp"],
            "tools_platforms":      ["jupyter", "tableau", "power bi", "spark", "aws", "git"],
        },
        "devops engineer": {
            "core_languages":       ["python", "bash", "yaml", "golang", "groovy"],
            "frameworks_libraries": ["jenkins", "ansible", "terraform", "github actions", "helm", "argocd"],
            "concepts_practices":   ["ci/cd", "infrastructure as code", "containerization", "monitoring", "cloud architecture", "networking"],
            "tools_platforms":      ["docker", "kubernetes", "aws", "prometheus", "grafana", "git"],
        },
        "product manager": {
            "core_languages":       ["sql", "excel", "python", "google sheets", "data analysis"],
            "frameworks_libraries": ["jira", "figma", "confluence", "notion", "amplitude", "miro"],
            "concepts_practices":   ["roadmapping", "agile", "a/b testing", "user research", "kpi", "product strategy"],
            "tools_platforms":      ["google analytics", "tableau", "slack", "powerpoint", "okr", "competitive analysis"],
        },
        "qa engineer": {
            "core_languages":       ["python", "java", "javascript", "c#", "sql"],
            "frameworks_libraries": ["selenium", "cypress", "pytest", "playwright", "junit", "appium"],
            "concepts_practices":   ["test automation", "api testing", "regression testing", "tdd", "bdd", "test planning"],
            "tools_platforms":      ["jira", "postman", "git", "docker", "swagger", "browserstack"],
        },
    }

    CATEGORY_WEIGHTS = {
        "core_languages":       0.35,
        "frameworks_libraries": 0.25,
        "concepts_practices":   0.25,
        "tools_platforms":      0.15,
    }

    def score(self, parsed_data: dict, role: str) -> dict:
        role_key = role.lower().strip()

        if role_key not in self.ROLE_SKILL_MATRIX:
            return self._fallback_score(parsed_data, role)

        full_text = self._build_full_text(parsed_data)
        role_skills = self.ROLE_SKILL_MATRIX[role_key]
        match_details = {}
        skills_found = []

        for category, skills in role_skills.items():
            matched = []
            missing = []
            for skill in skills:
                if self._skill_present(skill, full_text):
                    matched.append(skill)
                    if skill not in skills_found:
                        skills_found.append(skill)
                else:
                    missing.append(skill)

            total = len(skills)
            cat_score = (len(matched) / total * 100) if total > 0 else 0

            match_details[category] = {
                "matched": matched,
                "missing": missing,
                "score": round(cat_score, 2),
            }

        parsed_data["skills"] = skills_found
        score_result = self._calculate_final_score(match_details, parsed_data)

        return {
            "overall_score": score_result["final_score"],
            "match_details": match_details,
            "score_reasoning": score_result["reasoning"],
            "skills_found": skills_found,
        }

    def _skill_present(self, skill: str, text: str) -> bool:
        terms = [skill] + self.SKILL_ALIASES.get(skill, [])
        for term in terms:
            escaped = re.escape(term.lower())
            pattern = rf'(?<![a-z0-9]){escaped}(?![a-z0-9])'
            if re.search(pattern, text):
                return True
        return False

    def _build_full_text(self, parsed_data: dict) -> str:
        parts = []
        sections = parsed_data.get("raw_section_text", {})
        if sections:
            for content in sections.values():
                if content and content.strip():
                    parts.append(content.lower())
        full = " ".join(parts)
        if not full.strip():
            logger.warning("raw_section_text empty — no skills will match")
        return full

    def _calculate_final_score(self, match_details: dict, parsed_data: dict) -> dict:
        total_weighted = 0.0
        for category, weight in self.CATEGORY_WEIGHTS.items():
            cat_score = match_details.get(category, {}).get("score", 0)
            total_weighted += (cat_score / 100) * weight

        base_score = total_weighted * 100

        exp = parsed_data.get("experience_years", 0)
        if exp >= 5:    exp_bonus = 12
        elif exp >= 3:  exp_bonus = 9
        elif exp >= 1:  exp_bonus = 5
        elif exp > 0:   exp_bonus = 3
        else:           exp_bonus = 0

        edu_bonus = {
            "PhD": 8,
            "Masters": 6,
            "Bachelors": 4,
            "Not detected": 0,
        }.get(parsed_data.get("education", "Not detected"), 0)

        sections = parsed_data.get("sections", {})
        section_bonus = 0
        if sections.get("experience"):  section_bonus += 4
        if sections.get("projects"):    section_bonus += 3
        if sections.get("summary"):     section_bonus += 2

        final = min(round(base_score + exp_bonus + edu_bonus + section_bonus, 1), 100)

        reasoning = (
            f"Skill match: {round(base_score, 1)}/100 | "
            f"Experience bonus: +{exp_bonus} | "
            f"Education bonus: +{edu_bonus} | "
            f"Section bonus: +{section_bonus}"
        )

        return {"final_score": final, "reasoning": reasoning}

    def _fallback_score(self, parsed_data: dict, role: str) -> dict:
        logger.warning(f"Role '{role}' not in matrix, using fallback")
        skills = parsed_data.get("skills", [])
        base = min(len(skills) * 5, 60)
        edu_bonus = {
            "PhD": 10, "Masters": 8, "Bachelors": 5
        }.get(parsed_data.get("education", ""), 0)
        exp_bonus = min(parsed_data.get("experience_years", 0) * 3, 15)
        return {
            "overall_score": min(base + edu_bonus + exp_bonus, 100),
            "match_details": {
                "core_languages": {
                    "matched": skills,
                    "missing": [],
                    "score": 100,
                }
            },
            "score_reasoning": f"Fallback — role not in matrix. {len(skills)} skills detected.",
            "skills_found": skills,
        }