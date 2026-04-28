# daily-task — Rules

- Source sync and `.env` writeback are two separate gates — never merge into one confirmation.
- Sub-agents must NOT directly invoke write operations (create/clone-repo).
- Sub-agents may freely invoke scan (read-only safe).
