import { useEffect, useRef } from 'react';
import isEqual from 'fast-deep-equal/es6';

/**
 * Diagnostic hook: Tracks which properties caused a component to re-render.
 * It deeply compares previous props to new props and logs the differences.
 * 
 * @usage
 * function MyComponent(props) {
 *    useRenderTrace('MyComponent', props);
 *    return <div />;
 * }
 */
export function useRenderTrace(componentName, props) {
    const prevProps = useRef(props);

    useEffect(() => {
        const changedProps = Object.entries(props).reduce((ps, [k, v]) => {
            if (prevProps.current[k] !== v) {
                // Determine if it was a shallow ref change but deep equality is the same
                const isDeepEqual = isEqual(prevProps.current[k], v);
                ps[k] = {
                    old: prevProps.current[k],
                    new: v,
                    deepEqual: isDeepEqual,
                    type: typeof v
                };
            }
            return ps;
        }, {});

        if (Object.keys(changedProps).length > 0) {
            console.warn(`[RenderTrace] ${componentName} re-rendered. Changed props:`, changedProps);
        }

        prevProps.current = props;
    });
}
