import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TokenChargeBadge, TokenNameBadge, AddHeroBadge } from '../ui/components/board/BoardTile.jsx';

describe('TokenChargeBadge', () => {
    it('is hidden (opacity-0) when not hovered', () => {
        const { container } = render(
            React.createElement(TokenChargeBadge, { tile: 0, usesRemaining: 5900, isDragging: false, isHovered: false })
        );
        expect(container.firstChild.className).toContain('opacity-0');
        expect(container.firstChild.className).toContain('pointer-events-none');
    });

    it('displays full number when hovered (isHovered: true)', () => {
        const { container } = render(
            React.createElement(TokenChargeBadge, { tile: 0, usesRemaining: 5900, isDragging: false, isHovered: true })
        );
        expect(container.firstChild.className).toContain('opacity-100');
        expect(screen.getByText('5,900')).toBeDefined();
        expect(container.firstChild.className).toContain('right-1.5');
    });

    it('renders infinity icon when token has unlimited uses on hover', () => {
        const { container } = render(
            React.createElement(TokenChargeBadge, { tile: 0, usesRemaining: null, isDragging: false, isHovered: true })
        );
        expect(container.firstChild.className).toContain('opacity-100');
        expect(screen.getByLabelText('Unlimited charges')).toBeDefined();
        expect(container.querySelector('svg')).toBeDefined();
    });

    it('does not render while dragging', () => {
        const { container } = render(
            React.createElement(TokenChargeBadge, { tile: 0, usesRemaining: 5900, isDragging: true, isHovered: true })
        );
        expect(container.firstChild).toBeNull();
    });

    it('expands to visible when hovering directly over the badge', () => {
        const { container } = render(
            React.createElement(TokenChargeBadge, { tile: 0, usesRemaining: 12450, isDragging: false, isHovered: false })
        );
        expect(container.firstChild.className).toContain('opacity-0');

        const badge = screen.getByLabelText('12,450 charges remaining');
        fireEvent.mouseEnter(badge);
        expect(container.firstChild.className).toContain('opacity-100');
        expect(screen.getByText('12,450')).toBeDefined();

        fireEvent.mouseLeave(badge);
        expect(container.firstChild.className).toContain('opacity-0');
    });

});

describe('TokenNameBadge', () => {
    it('is hidden (opacity-0) when not hovered', () => {
        const { container } = render(
            React.createElement(TokenNameBadge, { name: 'Ancient Forge', isDragging: false, isHovered: false })
        );
        expect(container.firstChild.className).toContain('opacity-0');
        expect(screen.getByText('Ancient Forge')).toBeDefined();
    });

    it('reveals with opacity-100 at the top when hovered', () => {
        const { container } = render(
            React.createElement(TokenNameBadge, { name: 'Ancient Forge', isDragging: false, isHovered: true })
        );
        expect(container.firstChild.className).toContain('opacity-100');
        expect(container.firstChild.className).toContain('top-1');
        expect(container.firstChild.className).toContain('left-1');
    });

    it('does not render while dragging', () => {
        const { container } = render(
            React.createElement(TokenNameBadge, { name: 'Ancient Forge', isDragging: true, isHovered: true })
        );
        expect(container.firstChild).toBeNull();
    });

    it('does not render if name is null/empty', () => {
        const { container } = render(
            React.createElement(TokenNameBadge, { name: '', isDragging: false, isHovered: true })
        );
        expect(container.firstChild).toBeNull();
    });
});

describe('AddHeroBadge', () => {
    it('is hidden (opacity-0) when not hovered', () => {
        const { container } = render(
            React.createElement(AddHeroBadge, { isHovered: false, isDragging: false, onClick: () => {} })
        );
        expect(container.firstChild.className).toContain('opacity-0');
        expect(container.firstChild.className).toContain('pointer-events-none');
    });

    it('is visible (opacity-100) at bottom-left when hovered', () => {
        const { container } = render(
            React.createElement(AddHeroBadge, { isHovered: true, isDragging: false, onClick: () => {} })
        );
        expect(container.firstChild.className).toContain('opacity-100');
        expect(container.firstChild.className).toContain('left-1.5');
        expect(container.firstChild.className).toContain('bottom-1.5');
        expect(screen.getByLabelText('Assign Hero')).toBeDefined();
    });

    it('fires onClick callback when clicked', () => {
        const handleClick = vi.fn();
        render(
            React.createElement(AddHeroBadge, { isHovered: true, isDragging: false, onClick: handleClick })
        );
        const button = screen.getByLabelText('Assign Hero');
        fireEvent.click(button);
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not render while dragging', () => {
        const { container } = render(
            React.createElement(AddHeroBadge, { isHovered: true, isDragging: true, onClick: () => {} })
        );
        expect(container.firstChild).toBeNull();
    });
});
