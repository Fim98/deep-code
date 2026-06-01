# Contributing to deepcode

Thank you for your interest in contributing to deepcode! This document provides guidelines and information to help you get started.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please check [existing issues](https://github.com/Fim98/deep-code/issues) to avoid duplicates. When creating a bug report, use the [bug report template](https://github.com/Fim98/deep-code/issues/new?template=bug_report.md) and include:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected vs. actual behavior
- Screenshots or screen recordings if applicable
- Your environment (OS, Node.js version, app version)

### Suggesting Features

Feature suggestions are welcome! Use the [feature request template](https://github.com/Fim98/deep-code/issues/new?template=feature_request.md) and include:

- A clear, descriptive title
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

### Submitting Code Changes

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Make your changes** following our coding standards
4. **Test your changes:**
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   ```
5. **Commit your changes** using [Conventional Commits](#commit-messages)
6. **Push to your fork** and open a Pull Request

## Development Setup

### Prerequisites

- Node.js ≥ 22
- npm ≥ 10

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/deep-code.git
cd deep-code

# Add upstream remote
git remote add upstream https://github.com/Fim98/deep-code.git

# Install dependencies
npm install

# Start development server
npm run dev
```

### Keeping Your Fork Updated

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

## Coding Standards

### Code Style

We use [Biome](https://biomejs.dev/) for formatting and linting. Run:

```bash
# Check formatting and linting
npm run lint

# Auto-fix issues
npm run check:write

# Format only
npm run format
```

### TypeScript

- Use TypeScript for all new code
- Ensure types are explicit where beneficial
- Run `npm run typecheck` before committing

### React

- Use functional components with hooks
- Prefer composition over inheritance
- Use meaningful component and variable names

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification. All commits are validated by commitlint.

**Format:**

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files

**Examples:**

```
feat(chat): add streaming response support
fix(terminal): resolve xterm.js resize issue
docs(readme): add installation instructions
refactor(settings): extract provider config logic
```

## Pull Request Process

1. **Update documentation** if your changes add or modify features
2. **Add tests** for new functionality
3. **Ensure CI passes** — all checks must be green
4. **Keep PRs focused** — one feature or fix per PR
5. **Write a clear PR description** explaining what changed and why

### PR Title Format

Use the same Conventional Commits format for PR titles:

```
feat: add dark mode support
fix: resolve memory leak in session manager
```

### Review Process

- PRs require at least one review before merging
- Address all review comments
- Maintainers will merge once approved

## Project Structure

```
deep-code/
├── src/
│   ├── main/          # Electron main process
│   │   ├── index.ts   # Entry point
│   │   └── ...        # IPC handlers, session management
│   ├── preload/       # Preload scripts
│   │   └── index.ts   # Context bridge
│   ├── renderer/      # React UI
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── stores/    # Zustand stores
│   │   └── ...
│   └── test/          # Test utilities
├── resources/         # App icons and static resources
├── .github/           # CI/CD and templates
└── docs/              # Documentation
```

## Testing

We use [Vitest](https://vitest.dev/) for testing.

```bash
# Run all tests
npm run test

# Run main process tests
npm run test:node

# Run renderer tests
npm run test:web

# Watch mode
npm run test:watch
```

### Writing Tests

- Place test files next to the code they test: `Component.test.tsx`
- Use `@testing-library/react` for component tests
- Mock external dependencies appropriately
- Aim for meaningful coverage, not 100%

## Adding Contributors

When you contribute, add yourself to the contributors list in README.md:

```markdown
| <a href="https://github.com/YOUR_USERNAME"><img src="https://github.com/YOUR_USERNAME.png" width="64" height="64" alt="YOUR_USERNAME" style="border-radius:50%"></a> | **[YOUR_USERNAME](https://github.com/YOUR_USERNAME)** — Brief description of contribution |
```

## Questions?

- Open a [discussion](https://github.com/Fim98/deep-code/discussions) for general questions
- Check existing issues and PRs for similar topics
- Reach out to maintainers if you need guidance

## License

By contributing to deepcode, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

Thank you for contributing to deepcode! 🚀
