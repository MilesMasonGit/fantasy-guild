import { useEffect, useRef } from 'react';
import { FolderOpen } from 'lucide-react';
import * as SaveFiles from '../../../systems/core/SaveFiles.js';
import { KitButton, KIT_BUTTON_TONE } from '../base/KitButton.jsx';
import { cn } from '../../utils/cn.js';
import { t } from '../../../i18n/index.js';

/**
 * Opens the saves folder in the system's file browser, where each slot's save is a file to copy,
 * keep or edit. The desktop build only: in a browser or a dev build saves are not files, and it
 * draws nothing.
 */
export function SaveFolderButton({ className, buttonClassName }) {
    if (!SaveFiles.isActive()) return null;
    const folder = SaveFiles.folderPath();
    return (
        <KitButton
            tone={KIT_BUTTON_TONE.PLAIN}
            data-save-folder
            onClick={() => SaveFiles.openFolder()}
            title={folder ? t('titleScreen.savesFolderTip', { path: folder }) : undefined}
            className={className}
            buttonClassName={cn('gap-2 py-1 px-3 text-xs uppercase tracking-wider', buttonClassName)}
        >
            <FolderOpen size={14} /> {t('titleScreen.openSavesFolder')}
        </KitButton>
    );
}

/**
 * While the slot screen is up in the desktop build, read the saves folder again whenever the
 * window regains focus (a file copied in from the file browser shows up) and call `onChange`
 * whenever the slots' files have changed under it.
 */
export function useSaveFilesWatch(active, onChange) {
    const latest = useRef(onChange);
    latest.current = onChange;
    useEffect(() => {
        if (!active || !SaveFiles.isActive()) return undefined;
        const reread = () => { SaveFiles.refreshAll(); };
        window.addEventListener('focus', reread);
        const off = SaveFiles.onChange(() => latest.current());
        return () => {
            window.removeEventListener('focus', reread);
            off();
        };
    }, [active]);
}
