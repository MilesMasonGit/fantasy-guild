import { useEntityStore } from '../../stores/useEntityStore';
import { Settings2 } from 'lucide-react';
import { slugify } from '../../utils/idGenerator';
import { Header, Section, Field, Empty, IdSyncField } from '../shared/EditorLayout';

export default function TagEditor() {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const tag = useEntityStore((s) => s.tags[activeId]);
  const updateTag = useEntityStore((s) => s.updateTag);
  const deleteTag = useEntityStore((s) => s.deleteTag);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);

  if (!tag) return <Empty text="Select a tag from the sidebar to edit" icon="🏷️" />;

  const update = (key, value) => updateTag(activeId, { [key]: value });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Header icon={tag.icon || '🏷️'} name={tag.name} id={tag.id} onDelete={() => { deleteTag(activeId); clearActive(); }} />

      {/* Identity & Meta */}
      <Section title="Identity & Meta" icon={<Settings2 size={14} />}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tag Name">
            <input 
              type="text" 
              value={tag.name} 
              onChange={(e) => update('name', e.target.value)} 
              className="w-full" 
            />
          </Field>
          <Field label="Icon Emoji">
            <input 
              type="text" 
              value={tag.icon} 
              onChange={(e) => update('icon', e.target.value)} 
              className="w-full" 
            />
          </Field>
          
          <IdSyncField entity={tag} entityType="tag" onUpdate={update} />
        </div>
      </Section>

      {/* Description */}
      <Section title="Description & Mechanics">
        <Field label="Tag Description">
          <textarea
            value={tag.description || ''}
            onChange={(e) => update('description', e.target.value)}
            className="w-full min-h-[100px]"
            placeholder="Explain what this tag represents in game mechanics..."
          />
        </Field>
      </Section>
    </div>
  );
}
