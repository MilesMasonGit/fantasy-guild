import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../../utils/cn.js';

export const FPSCounter = React.memo(() => {
    const [fps, setFps] = useState(60);
    const framesRef = useRef(0);
    const lastTimeRef = useRef(performance.now());
    const requestRef = useRef();

    useEffect(() => {
        const calculateFps = (time) => {
            framesRef.current += 1;
            const delta = time - lastTimeRef.current;

            if (delta >= 1000) {
                setFps(Math.round((framesRef.current * 1000) / delta));
                framesRef.current = 0;
                lastTimeRef.current = time;
            }

            requestRef.current = requestAnimationFrame(calculateFps);
        };

        requestRef.current = requestAnimationFrame(calculateFps);
        return () => cancelAnimationFrame(requestRef.current);
    }, []);

    let colorClass = "text-green-500";
    if (fps < 30) colorClass = "text-red-500";
    else if (fps < 50) colorClass = "text-yellow-500";

    return (
        <div className={cn(
            "fixed bottom-2 left-2 z-[9999] pointer-events-none bg-black/60 text-xs font-mono font-bold px-2 py-1 rounded shadow-md border border-white/10",
            colorClass
        )}>
            {fps} FPS
        </div>
    );
});

export default FPSCounter;
