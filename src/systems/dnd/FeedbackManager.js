/**
 * FeedbackManager
 * Decouples UI feedback (audio/notifications) from the core DND resolution logic.
 */
export const FeedbackManager = {
    /**
     * handleResult - Dispatches feedback based on the DND resolution result.
     */
    handleResult(result, engine) {
        if (!result || result.action === 'none') return;

        const { success, action, error, type } = result;

        if (success) {
            this.handleSuccess(action, type, engine);
        } else {
            this.handleFailure(action, error, engine);
        }
    },

    handleSuccess(action, type, engine) {
        let audioClip = 'drop';

        switch (action) {
            case 'assign':
                audioClip = type === 'hero' ? 'hero_assign' : 
                          (type === 'tool' ? 'tool_assign' : 'item_assign');
                break;
            case 'unassign':
                audioClip = 'unassign';
                break;
            case 'hero_bench':
                audioClip = 'hero_bench';
                break;
            case 'hero_activate':
                audioClip = 'hero_activate';
                break;
            case 'hero_swap':
                audioClip = 'hero_swap';
                break;
            case 'card_swap':
                audioClip = 'card_swap';
                break;
            case 'equip':
                audioClip = 'item_equip';
                break;
            case 'assign_blueprint':
            case 'card_place':
            case 'card_move':
            case 'grid_placement':
                audioClip = 'card_place';
                break;
        }

        engine.EventBus.publish('audio:play', { clip: audioClip, type: 'ui' });
    },

    handleFailure(action, error, engine) {
        let message = '';
        let audioClip = 'error';

        switch (error) {
            case 'ALREADY_ASSIGNED':
                message = 'Item already assigned to this card.';
                break;
            case 'NO_VALID_SLOT':
                message = 'No empty valid slots for this item.';
                break;
            case 'ROSTER_FULL':
                message = 'Active roster is full!';
                break;
            case 'INVALID_TARGET':
                message = 'Invalid drop target.';
                break;
            default:
                if (action === 'assign_fail') message = 'Assignment failed.';
                else if (action === 'hero_activate_fail') message = 'Cannot activate hero.';
        }

        if (message) {
            engine.EventBus.publish('notification', { message, type: 'error' });
        }
        
        engine.EventBus.publish('audio:play', { clip: audioClip, type: 'ui' });
    }
};
