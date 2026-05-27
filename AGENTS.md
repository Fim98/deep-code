# AI Chat Client Design System

This project follows a premium minimal AI-native desktop aesthetic inspired by:
- ChatGPT
- Linear
- Arc Browser
- Apple Human Interface

The UI must feel like an Apple-designed AI product rather than a traditional web dashboard:
- native desktop
- soft
- spacious
- lightweight
- calm
- precise

DO NOT create a traditional admin dashboard style.

---

# Core Principles

## 1. Native App Layout

Use a macOS-style split-view structure.

Rules:
- app frame should sit flush to the window edge
- do not add floating outer shells around the whole app
- do not add large outer margins around the main layout
- top chrome needs enough internal breathing room for the traffic-light/titlebar area
- sidebar and main area should feel integrated, not like detached cards

Preferred layout rhythm:
- app outer padding: 0px
- sidebar top safe spacing: 28px
- main header height: 68px to 76px
- main horizontal padding: 28px to 32px
- section gap: 24px to 32px

---

## 2. Airy Spacing

Always prefer larger spacing.

Use:
- 24px
- 28px
- 32px

Avoid:
- cramped layouts
- dense tables
- small paddings

Preferred content rhythm:

- section gap: 32px
- card gap: 24px
- inner padding: 24px

---

## 3. Rounded Design Language

Use rounded corners on controls and content elements, not on the entire app frame.

Radius system:

```css
--radius-xl: 32px;
--radius-lg: 24px;
--radius-md: 18px;
--radius-sm: 14px;
```

Rules:

app frame → no radius
split-view regions → no large floating radius
cards/popovers → lg
buttons → md
inputs → full rounded
avatars → circle

Avoid sharp controls, but do not turn the whole application into floating cards.

## 4. Colors
Background
--bg: #f5f5f7;
--card: #ffffff;
Text
--text-primary: #111111;
--text-secondary: #666666;
--text-muted: #999999;
Brand
--primary: #5B5BF7;
--primary-hover: #6B6BFF;
--primary-soft: #ECECFF;
Borders
--border: rgba(0,0,0,0.05);

Avoid high contrast.

## 5. Shadows

Shadows must be subtle.

Use shadows sparingly. Avoid shadows on the main app frame, sidebar, and primary split-view regions.

Allowed:

box-shadow:
0 2px 8px rgba(0,0,0,0.03);

or

box-shadow:
0 10px 30px rgba(0,0,0,0.04);

Never use harsh shadows.

## 6. Typography

Font stack:

font-family:
Inter,
SF Pro Display,
system-ui,
sans-serif;

Typography scale:

Hero title → 56px
Page title → 40px
Card title → 24px
Body → 16px
Small text → 14px

Use:

weight 400
weight 500

Avoid excessive bold text.

## 7. Sidebar Rules

Sidebar should:

feel native and integrated
have a soft translucent background
use a subtle divider from the main content
internal spacing
avoid heavy borders

Sidebar width:

width: 280px to 300px;

Sidebar style:

background: rgba(255,255,255,0.7);
backdrop-filter: blur(20px);
border-right: 1px solid rgba(0,0,0,0.05);

Conversation items:

height: 48px
radius: 14px
hover background only

Avoid visible separators.

## 8. Buttons

Primary button:

background: var(--primary);
color: white;
border-radius: 18px;
height: 48px;
padding-inline: 24px;

Hover:

transform: translateY(-1px);

Transition:

transition: all 0.2s ease;
## 9. Input Box

Chat input must feel premium.

Rules:

full rounded
soft shadow
large horizontal padding

Example:

height: 64px;
border-radius: 999px;
padding-inline: 24px;
background: white;
## 10. Animation

Animations should be:

subtle
smooth
calm

Preferred:

transition:
all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

Avoid:

bounce
elastic
aggressive motion
## 11. DO NOT

Never create:

bootstrap style UI
dark heavy gradients
harsh borders
tiny paddings
square buttons
dense enterprise dashboard feel
detached app-wide floating shells
large outer margins around the app frame

The app must feel:

modern
premium
AI-native
elegant

---

# 三、再给你一份“生成组件”的 AI Prompt

这个特别适合：

- Cursor
- Claude Code
- Lovable
- V0
- Bolt.new

---

# UI Prompt

```txt
Build a modern AI chat client UI.

Style requirements:

- Minimal premium AI-native desktop aesthetic
- Inspired by ChatGPT + Linear + Apple
- Large rounded corners
- Spacious layout
- Soft shadows
- Light gray background
- Native split-view layout
- Integrated translucent sidebar
- Flush-to-edge app frame
- Calm typography
- Smooth animations

Use:
- React
- TailwindCSS
- Framer Motion

Design tokens:

Background:
#f5f5f7

Primary:
#5B5BF7

Card:
#ffffff

Radius:
32px / 24px / 18px

Shadow:
0 10px 30px rgba(0,0,0,0.04)

Sidebar:
- integrated split-view region
- soft translucent background
- 280px to 300px width
- subtle right divider

Chat input:
- pill shape
- soft shadow
- centered

Typography:
- Inter font
- medium weights
- large titles
- subtle secondary text

Avoid:
- bootstrap look
- dense layouts
- sharp corners
- harsh borders
- heavy shadows
