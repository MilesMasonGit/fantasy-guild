// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TokenNameBadge, TokenChargeDeltaFloater } from '../ui/components/board/TokenBadges.jsx';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { act } from '@testing-library/react';

// TokenChargeBadge (the hover charge chip) went with B1.2: charges are a ring in
// the row under the Token now — see TokenBadgeRow.test.js.

describe('TokenChargeDeltaFloater', () => {
    // The event names the Token by instance id (slice 1.6b); the floater is
    // drawn on that Token, so it listens for its own id and nothing else.
    it('displays floating -1 when a charge is consumed', () => {
        render(React.createElement(TokenChargeDeltaFloater, { instanceId: 'tok_a' }));

        act(() => {
            EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, {
                instanceId: 'tok_a',
                delta: -1,
                remaining: 24,
                typeId: 'token_oak_tree'
            });
        });

        expect(screen.getByText('-1')).toBeDefined();
    });

    it('displays floating positive counter when a token is restocked', () => {
        render(React.createElement(TokenChargeDeltaFloater, { instanceId: 'tok_a' }));

        act(() => {
            EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, {
                instanceId: 'tok_a',
                delta: 50,
                remaining: 90,
                typeId: 'token_copper_ore'
            });
        });

        expect(screen.getByText('+50')).toBeDefined();
    });

    it('⭐ ignores another Token’s charges', () => {
        const { container } = render(React.createElement(TokenChargeDeltaFloater, { instanceId: 'tok_a' }));

        act(() => {
            EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, {
                instanceId: 'tok_b',
                delta: -1,
                remaining: 3,
                typeId: 'token_oak_tree'
            });
        });

        expect(container.firstChild).toBeNull();
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

    it('reveals with opacity-100 above the box when hovered', () => {
        const { container } = render(
            React.createElement(TokenNameBadge, { name: 'Ancient Forge', isDragging: false, isHovered: true })
        );
        expect(container.firstChild.className).toContain('opacity-100');
        expect(container.firstChild.style.bottom).toBe('calc(100% + 4px)');
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

// AddHeroBadge (the green plus) was removed; see CornerCentreBadges.test.js.
