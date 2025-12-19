# Card CSS State Report

This document lists all CSS rules that affect the `.card` element's visual appearance (border, box-shadow, animations, transitions) which may conflict with the assignment flash animation.

---

## 🔴 High Conflict Risk (Affects border-color / box-shadow)

### 1. Base Card (Line 8-23)
```css
.card {
    border: 1px solid var(--color-border-default);
    transition: all var(--transition-normal);  // ⚠️ PROBLEM
}
.card:hover {
    border-color: var(--color-border-strong);
}
```
**Issue**: `transition: all` will transition border-color changes, fighting with animation.

---

### 2. Card Active State (Line 705-708)
```css
.card--active {
    border-color: var(--color-accent-primary);
    box-shadow: 0 0 0 1px var(--color-accent-primary);
}
```
**Issue**: Sets box-shadow and border-color that override animation values.

---

### 3. Card Completed State (Line 710-725)
```css
.card--completed {
    border-color: var(--color-success);
    animation: card-complete 0.5s ease;  // Competing animation!
}
```
**Issue**: Has its own animation that may conflict.

---

## 🟡 Medium Conflict Risk

### 4. Card Idle State (Line 701-703)
```css
.card--idle {
    opacity: 0.85;
}
```
**Issue**: May make animation less visible.

---

### 5. Hero Slot States (Line 176-197)
```css
.card.drop-zone--active .card__hero-slot--empty {
    border-color: var(--color-success);
}
.card__hero-slot--filled {
    border-color: var(--color-success);
}
```
**Note**: These affect hero slot, not card itself. Low conflict.

---

### 6. Area Card Border (Line 1002)
```css
.area-card {
    border-color: #40c0a0;  // Always teal
}
```
**Issue**: Area cards have permanent border color.

---

### 7. Recruit Card Border (Line 1166, 1206, 1211)
```css
.card--recruit {
    border-color: var(--color-card-recruit, #9060b0);
}
.recruit-option:hover {
    border-color: #9060b0;
}
```
**Issue**: Recruit cards have permanent purple border.

---

### 8. Error State (Line 1535)
```css
.card--error {
    border-color: var(--color-error);
    box-shadow: 0 0 0 1px var(--color-error), 0 0 10px rgba(220, 53, 69, 0.3);
}
```
**Issue**: Error state has its own box-shadow.

---

## 🟢 Low Risk (Child elements, not card border)

- Input slot states (`.card__input-slot--*`)
- Progress bar animations
- Durability bars
- Damage floaters

---

## Recommended Fixes

### Option A: Remove `transition: all` from base card
Change line 16 from:
```css
transition: all var(--transition-normal);
```
to:
```css
transition: background var(--transition-normal);
```
This stops border-color from being transitioned, allowing animation to work.

### Option B: Strip unnecessary state classes
Consider removing or simplifying:
- `.card--active` (currently adds blue border when hero assigned)
- `.card--completed` (has its own animation)
- `.card--idle` (reduces opacity)

### Option C: Use a different visual for flash
Instead of border/box-shadow animation, use:
- Background color pulse
- Scale/transform animation
- Overlay pseudo-element

---

## Current Flash Animation Location
**File**: `components.css`  
**Lines**: 430-451
```css
.card.card--assign-flash,
.card.card--active.card--assign-flash {
    animation: card-assign-flash 1.2s ease-out forwards !important;
}
```
