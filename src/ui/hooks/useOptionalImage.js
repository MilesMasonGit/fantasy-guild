import { useEffect, useState } from 'react';

/** A picture that may not exist yet: its size once it loads, else null (a missing file stays null). */
export function useOptionalImage(src) {
    const [art, setArt] = useState(null);
    useEffect(() => {
        let live = true;
        const img = new Image();
        img.onload = () => {
            if (live && img.naturalWidth > 0) setArt({ src, width: img.naturalWidth, height: img.naturalHeight });
        };
        img.src = src;
        return () => { live = false; };
    }, [src]);
    return art;
}
