// Left tool rail: one entry per installed+enabled tool (from /api/plugins) plus
// the Plugins manager entry. Icons come from each tool's manifest icon keyword.
import { ToolIcon, PluginsIcon } from '../icons.jsx';

export default function Rail({ railRef, plugins, activeId, inPlugins, onSelect, onPlugins }) {
  return (
    <aside className="rail" ref={railRef}>
      <span className="rail-cap">Tools</span>
      <div id="railTools">
        {plugins.filter((p) => p.enabled !== false).map((p) => (
          <button key={p.id} type="button" className={'tool' + (p.id === activeId ? ' active' : '')} aria-current={p.id === activeId ? 'true' : undefined} onClick={() => onSelect(p.id)}>
            <span className="tool-ic"><ToolIcon name={p.icon} size={18} /></span>
            <span className="tool-name">{p.name}</span>
          </button>
        ))}
        <button type="button" className={'tool tool--plugins' + (inPlugins ? ' active' : '')} aria-current={inPlugins ? 'true' : undefined} onClick={onPlugins}>
          <span className="tool-ic"><PluginsIcon size={18} /></span>
          <span className="tool-name">Plugins</span>
        </button>
      </div>
    </aside>
  );
}
