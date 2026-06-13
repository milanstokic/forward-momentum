# forward-momentum

A project built with [Claude Code](https://claude.com/claude-code) using the
[agent-skills](https://github.com/addyosmani/agent-skills) plugin — production-grade
engineering skills that drive the full development lifecycle from spec to ship.

## Working with this repo

This repo enables the `agent-skills` plugin marketplace via `.claude/settings.json`,
so the skills and slash commands are available automatically when you open Claude Code here.

### Slash commands

The lifecycle, in order:

| Command         | Phase   | What it does                          |
|-----------------|---------|---------------------------------------|
| `/spec`         | Define  | Write a spec before any code          |
| `/plan`         | Plan    | Break the spec into small, atomic tasks |
| `/build`        | Build   | Implement one slice at a time (`/build auto` runs the whole plan) |
| `/test`         | Verify  | Prove it works with tests             |
| `/review`       | Review  | Improve code health before merge      |
| `/code-simplify`| Review  | Clarity over cleverness               |
| `/ship`         | Ship    | Release to production                 |

Skills also activate automatically based on what you're doing (e.g. designing an API
triggers `api-and-interface-design`, building UI triggers `frontend-ui-engineering`).

### First time setup

If the plugin doesn't auto-load, run once inside Claude Code:

```
/plugin marketplace add addyosmani/agent-skills
/plugin install agent-skills@addy-agent-skills
```

## Getting started

This repo is intentionally empty — start by running `/spec` to define what we're building.
