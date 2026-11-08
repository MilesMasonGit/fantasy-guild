// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TokenNameBadge } from '../ui/components/board/TokenBadges.jsx';

describe('TokenNameBadge', () => {
    it('is not drawn at all until shown', () => {
        const { container } = render(
            React.createElement(TokenNameBadge, { name: 'Ancient Forge', isDragging: false, shown: false })
        );
        expect(container.firstChild).toBeNull();
    });

    it('shown, it sits above the box in the kit small text', () => {
        const { container } = render(
            React.createElement(TokenNameBadge, { name: 'Ancient Forge', isDragging: false, shown: true })
        );
        expect(screen.getByText('Ancient Forge').className).toContain('ui-text-small');
        expect(container.firstChild.style.bottom).toBe('calc(100% + 4px)');
    });

    it('below, it sits under the box, pushed further by the offset', () => {
        const { container } = render(
            React.createElement(TokenNameBadge, { name: 'Ancient Forge', shown: true, below: true, offset: 30 })
        );
        expect(container.firstChild.style.top).toBe('calc(100% + 34px)');
        expect(container.firstChild.style.bottom).toBe('');
    });

    it('does not render while dragging', () => {
        const { container } = render(
            React.createElement(TokenNameBadge, { name: 'Ancient Forge', isDragging: true, shown: true })
        );
        expect(container.firstChild).toBeNull();
    });

    it('does not render if name is null/empty', () => {
        const { container } = render(
            React.createElement(TokenNameBadge, { name: '', isDragging: false, shown: true })
        );
        expect(container.firstChild).toBeNull();
    });
});

// AddHeroBadge (the green plus) was removed; see CornerCentreBadges.test.js.
