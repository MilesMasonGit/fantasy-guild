// Fantasy Guild — test helper: a hero walking across the mat, step by step, as the game moves them.

import React from 'react';
import { render, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { GameState } from '../../state/GameState.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as BoardRunner from '../../systems/board/BoardRunner.js';
import * as HeroMotion from '../../systems/board/HeroMotion.js';
import * as Orders from '../../systems/board/Orders.js';
import { setMatTuning } from '../../config/matTuning.js';
import { MatBoard } from '../../ui/components/board/MatBoard.jsx';
import { MatFitProvider } from '../../ui/components/board/MatFitContext.jsx';
import { placeAt } from './mat.js';

/**
 * Hero `h1` stands on bare ground, then is sent to a Token 300 u away at `walkSpeed` u/s, the mat
 * drawn at `fit`. After each tick of the walk that moved them, `check(figure, dx, dy)` with the
 * hero's box and the step's move in mat units. Resolves to the number of steps checked.
 * The caller resets the game, the mat and `BoardState.setInstantArrival(true)` afterwards.
 */
export async function walkHero({ fit = 1, walkSpeed = 120, ticks = 60 } = {}, check = () => {}) {
    BoardState.setInstantArrival(false);
    setMatTuning('walkSpeed', walkSpeed);
    setMatTuning('potterRadius', 0);
    GameState.state.heroes = [{ id: 'h1', name: 'h1', status: 'idle', level: 50, skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } }];
    placeAt('fixture_producer', 1500, 500);
    const view = render(React.createElement(DndContext, null,
        React.createElement(MatFitProvider, { value: fit }, React.createElement(MatBoard))));
    await act(async () => { Orders.orderAt('h1', { x: 1200, y: 500 }); });
    await act(async () => { Orders.orderAt('h1', { x: 1500, y: 500 }); });
    const figure = () => view.container.querySelector('[data-board-hero="h1"]');
    let steps = 0;
    for (let i = 0; i < ticks && HeroMotion.isWalking('h1'); i++) {
        const p0 = { ...HeroMotion.bodyView('h1') };
        await act(async () => { BoardRunner.tick(100); });
        const p1 = HeroMotion.bodyView('h1');
        if (!HeroMotion.isWalking('h1') || !p1 || (p1.x === p0.x && p1.y === p0.y)) continue;
        steps++;
        check(figure(), p1.x - p0.x, p1.y - p0.y);
    }
    return { steps, view, figure };
}
