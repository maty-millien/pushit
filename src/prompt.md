Generate a conventional commit message for the changes below. Output ONLY the commit message.

Format: <type>(<optional-scope>): <description>
Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore
Rules: imperative mood, lowercase, no period, max 50 chars, explain WHY not WHAT

Branch: {{branch}}

Recent commits:
{{commitHistory}}

Status:
{{status}}

Diff:
{{diff}}
