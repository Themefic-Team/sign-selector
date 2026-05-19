/**
 * Sign Selector Admin – React-based settings panel built on wp-element.
 *
 * Uses wp.apiFetch for REST communication.  Each tab manages one collection
 * type (steps, surfaces, shapes, etc.) with add / edit / delete / enable-disable.
 */

/* global SIGN_SELECTOR_ADMIN, wp */
(function () {
  'use strict';

  const { createElement: el, useState, useEffect, useCallback, Fragment } = wp.element;
  const apiFetch = wp.apiFetch;
  const __ = wp.i18n.__;

  /* ─── Helpers ─────────────────────────────────────────── */

  const uid = () => 'id-' + Math.random().toString(36).slice(2, 10);

  const Toast = ({ message, type }) => {
    if (!message) return null;
    return el('div', { className: 'ss-toast' + (type === 'error' ? ' ss-toast-error' : '') }, message);
  };

  const Toggle = ({ checked, onChange }) =>
    el('label', { className: 'ss-toggle' },
      el('input', { type: 'checkbox', checked, onChange: (e) => onChange(e.target.checked) }),
      el('span', { className: 'ss-toggle-slider' })
    );

  const openMediaPicker = (callback) => {
    const frame = wp.media({ title: __('Select Image', 'sign-selector'), multiple: false, library: { type: 'image' } });
    frame.on('select', () => {
      const url = frame.state().get('selection').first().toJSON().url;
      callback(url);
    });
    frame.open();
  };

  /* ─── Confirm Modal ──────────────────────────────────── */

  const ConfirmModal = ({ message, onConfirm, onCancel }) => {
    if (!message) return null;
    return el('div', { className: 'ss-modal-overlay', onClick: onCancel },
      el('div', { className: 'ss-modal', onClick: (e) => e.stopPropagation() },
        el('p', null, message),
        el('div', { className: 'ss-modal-actions' },
          el('button', { className: 'ss-btn ss-btn-danger', onClick: onConfirm }, __('Remove', 'sign-selector')),
          el('button', { className: 'ss-btn', onClick: onCancel }, __('Cancel', 'sign-selector'))
        )
      )
    );
  };

  const useConfirmRemove = (items, setItems) => {
    const [pendingIndex, setPendingIndex] = useState(null);
    const askRemove = (index) => setPendingIndex(index);
    const confirmRemove = () => {
      if (pendingIndex !== null) {
        setItems(items.filter((_, i) => i !== pendingIndex));
        setPendingIndex(null);
      }
    };
    const cancelRemove = () => setPendingIndex(null);
    const label = pendingIndex !== null ? (items[pendingIndex]?.label || items[pendingIndex]?.id || '') : '';
    return { askRemove, confirmRemove, cancelRemove, pendingIndex, pendingLabel: label };
  };

  /* ─── Generic CRUD section ───────────────────────────── */

  const useCollection = (endpoint) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ message: '', type: '' });

    const showToast = (message, type) => {
      setToast({ message, type });
      setTimeout(() => setToast({ message: '', type: '' }), 3000);
    };

    const load = useCallback(() => {
      setLoading(true);
      apiFetch({ path: endpoint }).then(data => {
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
      }).catch(() => {
        showToast(__('Failed to load data.', 'sign-selector'), 'error');
        setLoading(false);
      });
    }, [endpoint]);

    useEffect(() => { load(); }, [load]);

    const save = useCallback((data) => {
      const toSave = data || items;
      return apiFetch({
        path: endpoint,
        method: 'POST',
        data: toSave,
      }).then(saved => {
        setItems(saved);
        showToast(__('Saved successfully!', 'sign-selector'), 'success');
        return saved;
      }).catch(() => {
        showToast(__('Save failed.', 'sign-selector'), 'error');
      });
    }, [endpoint, items]);

    return { items, setItems, loading, save, toast, showToast };
  };

  /* ─── Tab: Steps ──────────────────────────────────────── */

  const StepsTab = () => {
    const { items, setItems, loading, save, toast } = useCollection('/sign-selector/v1/steps');
    const { askRemove, confirmRemove, cancelRemove, pendingIndex, pendingLabel } = useConfirmRemove(items, setItems);
    const [editingIndex, setEditingIndex] = useState(null);
    const [isAddingStep, setIsAddingStep] = useState(false);

    const updateField = (index, field, value) => {
      const next = [...items];
      next[index] = { ...next[index], [field]: value };
      setItems(next);
    };

    const addItem = () => {
      const nextItems = [...items, { id: items.length + 1, title: '', heading: '', subheading: '', enabled: true }];
      setItems(nextItems);
      setIsAddingStep(true);
      setEditingIndex(nextItems.length - 1);
    };

    const openEditor = (index) => {
      setIsAddingStep(false);
      setEditingIndex(index);
    };

    const closeEditor = () => {
      setEditingIndex(null);
      setIsAddingStep(false);
    };

    if (loading) return el('p', null, __('Loading…', 'sign-selector'));

    return el(Fragment, null,
      el('div', { className: 'ss-toolbar' },
        el('h2', null, __('Step Definitions', 'sign-selector')),
        el('button', { className: 'ss-btn ss-btn-primary', onClick: addItem }, __('+ Add Step', 'sign-selector'))
      ),
      el('table', { className: 'ss-table' },
        el('thead', null,
          el('tr', null,
            el('th', null, '#'),
            el('th', null, __('Title', 'sign-selector')),
            el('th', null, __('Status', 'sign-selector')),
            el('th', null, __('Actions', 'sign-selector'))
          )
        ),
        el('tbody', null,
          items.map((item, i) =>
            el('tr', { key: i },
              el('td', null, item.id),
              el('td', null,
                el('div', { className: 'ss-template-meta' },
                  el('strong', { className: 'ss-template-title' }, item.title || __('Untitled Step', 'sign-selector')),
                  el('span', { className: 'ss-template-id' }, item.heading || __('No heading', 'sign-selector'))
                )
              ),
              el('td', null,
                el('span', { className: `ss-status-pill ${item.enabled !== false ? 'enabled' : 'disabled'}` }, item.enabled !== false ? __('Enabled', 'sign-selector') : __('Disabled', 'sign-selector'))
              ),
              el('td', null,
                el('div', { className: 'ss-actions' },
                  el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openEditor(i) }, __('Edit', 'sign-selector')),
                  el('button', { className: 'ss-btn ss-btn-danger ss-btn-sm', onClick: () => askRemove(i) }, __('Remove', 'sign-selector'))
                )
              )
            )
          )
        )
      ),
      el('div', { className: 'ss-save-bar' },
        el('button', { className: 'ss-btn ss-btn-primary', onClick: () => save() }, __('Save Steps', 'sign-selector'))
      ),
      el(Toast, toast),
      editingIndex !== null && items[editingIndex] && el('div', { className: 'ss-modal-overlay', onClick: closeEditor },
        el('div', { className: 'ss-modal ss-template-options-modal', onClick: (e) => e.stopPropagation() },
          el('h3', { className: 'ss-template-options-title' }, isAddingStep ? __('Add Step', 'sign-selector') : __('Edit Step', 'sign-selector')),
          el('div', { className: 'ss-template-options-section' },
            el('label', { className: 'ss-template-field-label' }, __('Title', 'sign-selector')),
            el('input', { className: 'ss-input', value: items[editingIndex].title || '', onChange: (e) => updateField(editingIndex, 'title', e.target.value) }),
            el('label', { className: 'ss-template-field-label' }, __('Heading', 'sign-selector')),
            el('input', { className: 'ss-input', value: items[editingIndex].heading || '', onChange: (e) => updateField(editingIndex, 'heading', e.target.value) }),
            el('label', { className: 'ss-template-field-label' }, __('Subheading', 'sign-selector')),
            el('input', { className: 'ss-input', value: items[editingIndex].subheading || '', onChange: (e) => updateField(editingIndex, 'subheading', e.target.value) }),
            el('div', { className: 'ss-template-enabled-row' },
              el('span', { className: 'ss-template-field-label ss-template-field-label-inline' }, __('Enabled', 'sign-selector')),
              el(Toggle, { checked: items[editingIndex].enabled !== false, onChange: (v) => updateField(editingIndex, 'enabled', v) })
            )
          ),
          el('div', { className: 'ss-modal-actions' },
            el('button', { className: 'ss-btn ss-btn-primary', onClick: closeEditor }, __('Done', 'sign-selector'))
          )
        )
      ),
      pendingIndex !== null && el(ConfirmModal, {
        message: __('Are you sure you want to remove', 'sign-selector') + ' "' + pendingLabel + '"?',
        onConfirm: confirmRemove,
        onCancel: cancelRemove
      })
    );
  };

  /* ─── Tab: Sign Styles ────────────────────────────────── */

  /** All available flow section ids + labels, from PHP (review excluded – always last). */
  const ALL_FLOW_SECTIONS = (typeof SIGN_SELECTOR_ADMIN !== 'undefined' && SIGN_SELECTOR_ADMIN.flowSections)
    ? Object.entries(SIGN_SELECTOR_ADMIN.flowSections).map(([id, label]) => ({ id, label }))
    : [
      { id: 'installation-surface', label: 'Installation Surface' },
      { id: 'size-shape', label: 'Size & Shape' },
      { id: 'slate-color', label: 'Slate Color' },
      { id: 'design-template', label: 'Design Template' },
      { id: 'paint-color', label: 'Paint Color' },
    ];

  const defaultFlow = ALL_FLOW_SECTIONS.map(s => s.id);

  /** Sub-component: drag-and-drop flow editor for a single sign style. */
  const FlowEditor = ({ flow, onChange }) => {
    // Only keep ids that exist in ALL_FLOW_SECTIONS (strip legacy 'review' etc.)
    const validIds = ALL_FLOW_SECTIONS.map(s => s.id);
    const cleaned = (Array.isArray(flow) && flow.length ? flow : defaultFlow).filter(id => validIds.includes(id));
    const sections = cleaned.length ? cleaned : defaultFlow;

    const [dragIdx, setDragIdx] = useState(null);
    const [overIdx, setOverIdx] = useState(null);

    const toggleSection = (sectionId) => {
      if (sections.includes(sectionId)) {
        onChange(sections.filter(s => s !== sectionId));
      } else {
        onChange([...sections, sectionId]);
      }
    };

    // Build ordered list: active items in their current order, then inactive items
    const activeItems = sections.map(id => ALL_FLOW_SECTIONS.find(s => s.id === id)).filter(Boolean);
    const inactiveItems = ALL_FLOW_SECTIONS.filter(s => !sections.includes(s.id));

    const onDragStart = (e, idx) => {
      setDragIdx(idx);
      e.dataTransfer.effectAllowed = 'move';
    };

    const onDragOver = (e, idx) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setOverIdx(idx);
    };

    const onDrop = (e, dropIdx) => {
      e.preventDefault();
      if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); setOverIdx(null); return; }
      const next = [...sections];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(dropIdx, 0, moved);
      onChange(next);
      setDragIdx(null);
      setOverIdx(null);
    };

    const onDragEnd = () => { setDragIdx(null); setOverIdx(null); };

    return el('div', { className: 'ss-flow-editor' },
      // Active (draggable) items
      activeItems.map((sec, idx) =>
        el('div', {
          className: 'ss-flow-item active'
            + (dragIdx === idx ? ' dragging' : '')
            + (overIdx === idx && dragIdx !== idx ? ' drag-over' : ''),
          key: sec.id,
          draggable: true,
          onDragStart: (e) => onDragStart(e, idx),
          onDragOver: (e) => onDragOver(e, idx),
          onDrop: (e) => onDrop(e, idx),
          onDragEnd: onDragEnd
        },
          el('span', { className: 'ss-flow-grip', title: 'Drag to reorder' }, '\u2630'),
          el('label', { className: 'ss-flow-check' },
            el('input', { type: 'checkbox', checked: true, onChange: () => toggleSection(sec.id) }),
            ' ' + sec.label
          ),
          el('span', { className: 'ss-flow-pos' }, '#' + (idx + 1))
        )
      ),
      // Inactive items (not draggable)
      inactiveItems.map((sec) =>
        el('div', { className: 'ss-flow-item', key: sec.id },
          el('span', { className: 'ss-flow-grip disabled' }),
          el('label', { className: 'ss-flow-check' },
            el('input', { type: 'checkbox', checked: false, onChange: () => toggleSection(sec.id) }),
            ' ' + sec.label
          )
        )
      ),
      // Fixed review step indicator
      el('div', { className: 'ss-flow-item fixed' },
        el('span', { className: 'ss-flow-grip disabled' }),
        el('span', { className: 'ss-flow-check' }, '\uD83D\uDD12 Review & Add to Cart'),
        el('span', { className: 'ss-flow-pos' }, __('always last', 'sign-selector'))
      )
    );
  };

  const SignStylesTab = () => {
    const { items, setItems, loading, save, toast } = useCollection('/sign-selector/v1/sign-styles');
    const { askRemove, confirmRemove, cancelRemove, pendingIndex, pendingLabel } = useConfirmRemove(items, setItems);
    const [editingIndex, setEditingIndex] = useState(null);
    const [isAddingStyle, setIsAddingStyle] = useState(false);

    const updateField = (index, field, value) => {
      const next = [...items];
      next[index] = { ...next[index], [field]: value };
      setItems(next);
    };

    const addItem = () => {
      const nextItems = [...items, { id: uid(), label: '', description: '', icon: '', iconUrl: '', enabled: true, flow: [...defaultFlow] }];
      setItems(nextItems);
      setIsAddingStyle(true);
      setEditingIndex(nextItems.length - 1);
    };

    const openEditor = (index) => {
      setIsAddingStyle(false);
      setEditingIndex(index);
    };

    const closeEditor = () => {
      setEditingIndex(null);
      setIsAddingStyle(false);
    };

    if (loading) return el('p', null, __('Loading…', 'sign-selector'));

    return el(Fragment, null,
      el('div', { className: 'ss-toolbar' },
        el('h2', null, __('Sign Styles (Products)', 'sign-selector')),
        el('button', { className: 'ss-btn ss-btn-primary', onClick: addItem }, __('+ Add Style', 'sign-selector'))
      ),
      el('table', { className: 'ss-table' },
        el('thead', null,
          el('tr', null,
            el('th', null, __('Preview', 'sign-selector')),
            el('th', null, __('Style', 'sign-selector')),
            el('th', null, __('Description', 'sign-selector')),
            el('th', null, __('Status', 'sign-selector')),
            el('th', null, __('Actions', 'sign-selector'))
          )
        ),
        el('tbody', null,
          items.map((item, i) =>
            el('tr', { key: i },
              el('td', null,
                item.iconUrl
                  ? el('img', { className: 'ss-img-preview', src: item.iconUrl, alt: item.label, style: { width: '48px', height: '48px', objectFit: 'contain' } })
                  : item.icon && item.icon.trim().startsWith('<')
                    ? el('span', { className: 'ss-svg-preview', dangerouslySetInnerHTML: { __html: item.icon }, style: { display: 'inline-block', width: '48px', height: '48px' } })
                    : el('span', { style: { fontSize: '28px' } }, item.icon || '—')
              ),
              el('td', null,
                el('div', { className: 'ss-template-meta' },
                  el('strong', { className: 'ss-template-title' }, item.label || __('Untitled Style', 'sign-selector')),
                  el('span', { className: 'ss-template-id' }, item.id || __('No ID', 'sign-selector'))
                )
              ),
              el('td', null, item.description || '—'),
              el('td', null,
                el('span', { className: `ss-status-pill ${item.enabled !== false ? 'enabled' : 'disabled'}` }, item.enabled !== false ? __('Enabled', 'sign-selector') : __('Disabled', 'sign-selector'))
              ),
              el('td', null,
                el('div', { className: 'ss-actions' },
                  el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openEditor(i) }, __('Edit', 'sign-selector')),
                  el('button', { className: 'ss-btn ss-btn-danger ss-btn-sm', onClick: () => askRemove(i) }, __('Remove', 'sign-selector'))
                )
              )
            )
          )
        )
      ),
      el('div', { className: 'ss-save-bar' },
        el('button', { className: 'ss-btn ss-btn-primary', onClick: () => save() }, __('Save Sign Styles', 'sign-selector'))
      ),
      el(Toast, toast),
      editingIndex !== null && items[editingIndex] && el('div', { className: 'ss-modal-overlay', onClick: closeEditor },
        el('div', { className: 'ss-modal ss-template-options-modal', onClick: (e) => e.stopPropagation() },
          el('h3', { className: 'ss-template-options-title' }, isAddingStyle ? __('Add Style', 'sign-selector') : __('Edit Style', 'sign-selector')),
          el('div', { className: 'ss-template-form-grid ss-slate-form-grid' },
            el('div', { className: 'ss-template-options-section ss-slate-basic-section' },
              el('h4', null, __('Basic Details', 'sign-selector')),
              el('label', { className: 'ss-template-field-label' }, __('ID', 'sign-selector')),
              el('input', { className: 'ss-input', value: items[editingIndex].id || '', onChange: (e) => updateField(editingIndex, 'id', e.target.value) }),
              el('label', { className: 'ss-template-field-label' }, __('Label', 'sign-selector')),
              el('input', { className: 'ss-input', value: items[editingIndex].label || '', onChange: (e) => updateField(editingIndex, 'label', e.target.value) }),
              el('label', { className: 'ss-template-field-label' }, __('Description', 'sign-selector')),
              el('input', { className: 'ss-input', value: items[editingIndex].description || '', onChange: (e) => updateField(editingIndex, 'description', e.target.value) }),
              el('label', { className: 'ss-template-field-label' }, __('Image URL', 'sign-selector')),
              el('div', { className: 'ss-img-cell' },
                el('input', { className: 'ss-input', value: items[editingIndex].iconUrl || '', onChange: (e) => updateField(editingIndex, 'iconUrl', e.target.value) }),
                el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openMediaPicker((url) => updateField(editingIndex, 'iconUrl', url)) }, __('Browse', 'sign-selector'))
              ),
              el('label', { className: 'ss-template-field-label' }, __('Inline SVG (optional)', 'sign-selector')),
              el('textarea', { className: 'ss-input ss-svg-textarea', rows: 4, value: items[editingIndex].icon || '', onChange: (e) => updateField(editingIndex, 'icon', e.target.value) }),
              el('div', { className: 'ss-template-enabled-row' },
                el('span', { className: 'ss-template-field-label ss-template-field-label-inline' }, __('Enabled', 'sign-selector')),
                el(Toggle, { checked: items[editingIndex].enabled !== false, onChange: (v) => updateField(editingIndex, 'enabled', v) })
              )
            ),
            el('div', { className: 'ss-template-options-section', style: { gridColumn: 'span 2' } },
              el('h4', null, __('Configurator Flow', 'sign-selector')),
              el('p', { className: 'ss-flow-hint' }, __('Check/uncheck sections and drag to reorder. Review always stays last.', 'sign-selector')),
              el(FlowEditor, {
                flow: items[editingIndex].flow || defaultFlow,
                onChange: (newFlow) => updateField(editingIndex, 'flow', newFlow)
              })
            )
          ),
          el('div', { className: 'ss-modal-actions' },
            el('button', { className: 'ss-btn ss-btn-primary', onClick: closeEditor }, __('Done', 'sign-selector'))
          )
        )
      ),
      pendingIndex !== null && el(ConfirmModal, {
        message: __('Are you sure you want to remove', 'sign-selector') + ' "' + pendingLabel + '"?',
        onConfirm: confirmRemove,
        onCancel: cancelRemove
      })
    );
  };

  /* ─── Tab: Installation Surfaces ──────────────────────── */

  const SurfacesTab = () => {
    const { items, setItems, loading, save, toast } = useCollection('/sign-selector/v1/surfaces');
    const { items: signStyles, loading: signStylesLoading } = useCollection('/sign-selector/v1/sign-styles');
    const [shapeOptions, setShapeOptions] = useState([]);

    useEffect(() => {
      apiFetch({ path: '/sign-selector/v1/shapes' }).then((data) => {
        const options = (Array.isArray(data) ? data : [])
          .filter((shape) => shape && shape.id)
          .map((shape) => ({ id: shape.id, label: shape.label || shape.id }));
        setShapeOptions(options);
      }).catch(() => { });
    }, []);

    const { askRemove, confirmRemove, cancelRemove, pendingIndex, pendingLabel } = useConfirmRemove(items, setItems);
    const [editingIndex, setEditingIndex] = useState(null);
    const [isAddingSurface, setIsAddingSurface] = useState(false);

    const signStyleOptions = signStyles.map((style) => ({
      id: style.id,
      label: style.label || style.id
    }));

    const updateField = (index, field, value) => {
      const next = [...items];
      if (field === 'isDefault' && value === true) {
        next.forEach((item, i) => {
          if (i !== index) item.isDefault = false;
        });
      }
      next[index] = { ...next[index], [field]: value };
      setItems(next);
    };

    const updateShapeImage = (index, shapeId, url) => {
      const next = [...items];
      const images = { ...(next[index].images || {}) };
      images[shapeId] = url;
      next[index] = { ...next[index], images };
      setItems(next);
    };

    const getAssignedSignStyleIds = (item) => {
      if (Array.isArray(item.signStyleIds)) {
        return item.signStyleIds;
      }

      return signStyleOptions.map((style) => style.id);
    };

    const toggleSignStyle = (index, styleId, checked) => {
      const next = [...items];
      const currentIds = getAssignedSignStyleIds(next[index]);
      const newIds = checked
        ? Array.from(new Set([...currentIds, styleId]))
        : currentIds.filter((id) => id !== styleId);

      next[index] = { ...next[index], signStyleIds: newIds };
      setItems(next);
    };

    const getStyleSummary = (item) => {
      const assignedIds = getAssignedSignStyleIds(item);

      if (!signStyleOptions.length || assignedIds.length === signStyleOptions.length) {
        return __('All sign styles selected', 'sign-selector');
      }

      if (!assignedIds.length) {
        return __('No sign styles selected', 'sign-selector');
      }

      const labels = assignedIds
        .map((id) => signStyleOptions.find((style) => style.id === id)?.label || id)
        .filter(Boolean);

      return labels.join(', ');
    };

    const addItem = () => {
      const nextItems = [...items, {
        id: uid(),
        label: '',
        image: '',
        imageUrl: '',
        images: {},
        signStyleIds: signStyleOptions.map((style) => style.id),
        enabled: true,
        isDefault: false
      }];
      setItems(nextItems);
      setIsAddingSurface(true);
      setEditingIndex(nextItems.length - 1);
    };

    const openEditor = (index) => {
      setIsAddingSurface(false);
      setEditingIndex(index);
    };

    const closeEditor = () => {
      setEditingIndex(null);
      setIsAddingSurface(false);
    };

    const saveSurfaces = () => {
      const normalized = items.map((item) => ({
        ...item,
        signStyleIds: Array.isArray(item.signStyleIds)
          ? item.signStyleIds
          : signStyleOptions.map((style) => style.id)
      }));

      save(normalized);
    };

    if (loading || signStylesLoading) return el('p', null, __('Loading…', 'sign-selector'));

    return el(Fragment, null,
      el('div', { className: 'ss-toolbar' },
        el('h2', null, __('Installation Surfaces', 'sign-selector')),
        el('button', { className: 'ss-btn ss-btn-primary', onClick: addItem }, __('+ Add Surface', 'sign-selector'))
      ),
      el('table', { className: 'ss-table' },
        el('thead', null,
          el('tr', null,
            el('th', null, __('Preview', 'sign-selector')),
            el('th', null, __('Surface', 'sign-selector')),
            el('th', null, __('Sign Styles', 'sign-selector')),
            el('th', null, __('Status', 'sign-selector')),
            el('th', null, __('Actions', 'sign-selector'))
          )
        ),
        el('tbody', null,
          items.map((item, i) =>
            el('tr', { key: i },
              el('td', null,
                item.imageUrl
                  ? el('img', { className: 'ss-img-preview', src: item.imageUrl, alt: item.label })
                  : el('span', { className: 'ss-img-preview ss-img-preview-empty', style: { display: 'inline-block' } })
              ),
              el('td', null,
                el('div', { className: 'ss-template-meta' },
                  el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                    el('strong', { className: 'ss-template-title' }, item.label || __('Untitled Surface', 'sign-selector')),
                    item.isDefault && el('span', { className: 'ss-status-pill', style: { background: '#e0f2fe', color: '#0369a1', fontSize: '10px', padding: '2px 6px', lineHeight: '1' } }, __('Default', 'sign-selector'))
                  ),
                  el('span', { className: 'ss-template-id' }, item.id || __('No ID', 'sign-selector'))
                )
              ),
              el('td', null,
                el('span', null, getStyleSummary(item))
              ),
              el('td', null,
                el('span', { className: `ss-status-pill ${item.enabled !== false ? 'enabled' : 'disabled'}` }, item.enabled !== false ? __('Enabled', 'sign-selector') : __('Disabled', 'sign-selector'))
              ),
              el('td', null,
                el('div', { className: 'ss-actions' },
                  el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openEditor(i) }, __('Edit', 'sign-selector')),
                  el('button', { className: 'ss-btn ss-btn-danger ss-btn-sm', onClick: () => askRemove(i) }, __('Remove', 'sign-selector'))
                )
              )
            )
          )
        )
      ),
      el('div', { className: 'ss-save-bar' },
        el('button', { className: 'ss-btn ss-btn-primary', onClick: saveSurfaces }, __('Save Surfaces', 'sign-selector'))
      ),
      el(Toast, toast),
      editingIndex !== null && items[editingIndex] && el('div', { className: 'ss-modal-overlay', onClick: closeEditor },
        el('div', { className: 'ss-modal ss-template-options-modal', onClick: (e) => e.stopPropagation() },
          el('h3', { className: 'ss-template-options-title' }, isAddingSurface ? __('Add Surface', 'sign-selector') : __('Edit Surface', 'sign-selector')),
          el('div', { className: 'ss-template-form-grid' },
            el('div', { className: 'ss-template-options-section' },
              el('label', { className: 'ss-template-field-label' }, __('ID', 'sign-selector')),
              el('input', { className: 'ss-input', value: items[editingIndex].id || '', onChange: (e) => updateField(editingIndex, 'id', e.target.value) }),
              el('label', { className: 'ss-template-field-label' }, __('Label', 'sign-selector')),
              el('input', { className: 'ss-input', value: items[editingIndex].label || '', onChange: (e) => updateField(editingIndex, 'label', e.target.value) }),
              el('label', { className: 'ss-template-field-label' }, __('Default Image URL', 'sign-selector')),
              el('div', { className: 'ss-img-cell' },
                el('input', { className: 'ss-input', value: items[editingIndex].imageUrl || '', onChange: (e) => updateField(editingIndex, 'imageUrl', e.target.value) }),
                el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openMediaPicker((url) => updateField(editingIndex, 'imageUrl', url)) }, __('Browse', 'sign-selector'))
              ),
              el('div', { className: 'ss-template-enabled-row' },
                el('span', { className: 'ss-template-field-label ss-template-field-label-inline' }, __('Enabled', 'sign-selector')),
                el(Toggle, { checked: items[editingIndex].enabled !== false, onChange: (v) => updateField(editingIndex, 'enabled', v) })
              ),
              el('div', { className: 'ss-template-enabled-row' },
                el('span', { className: 'ss-template-field-label ss-template-field-label-inline' }, __('Is Default', 'sign-selector')),
                el(Toggle, { checked: items[editingIndex].isDefault === true, onChange: (v) => updateField(editingIndex, 'isDefault', v) })
              )
            ),
            el('div', { className: 'ss-template-options-section' },
              el('h4', null, __('Sign Styles', 'sign-selector')),
              signStyleOptions.map((style) =>
                el('label', { key: style.id, className: 'ss-template-option-check' },
                  el('input', {
                    type: 'checkbox',
                    checked: getAssignedSignStyleIds(items[editingIndex]).includes(style.id),
                    onChange: (e) => toggleSignStyle(editingIndex, style.id, e.target.checked)
                  }),
                  style.label
                )
              )
            ),
            el('div', { className: 'ss-template-options-section ss-slate-images-section', style: { gridColumn: 'span 2' } },
              el('h4', null, __('Shape-specific Images', 'sign-selector')),
              el('div', { className: 'ss-shape-images-grid' },
                shapeOptions.map(shape =>
                  el('div', { className: 'ss-shape-img-item', key: shape.id },
                    el('label', { className: 'ss-template-field-label' }, shape.label || shape.id),
                    items[editingIndex].images && items[editingIndex].images[shape.id]
                      ? el('img', { className: 'ss-img-preview', src: items[editingIndex].images[shape.id], alt: shape.id })
                      : null,
                    el('div', { className: 'ss-img-cell' },
                      el('input', {
                        className: 'ss-input',
                        value: (items[editingIndex].images && items[editingIndex].images[shape.id]) || '',
                        onChange: (e) => updateShapeImage(editingIndex, shape.id, e.target.value),
                        placeholder: __('Image URL', 'sign-selector')
                      }),
                      el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openMediaPicker((url) => updateShapeImage(editingIndex, shape.id, url)) }, __('Browse', 'sign-selector'))
                    )
                  )
                )
              )
            )
          ),
          el('div', { className: 'ss-modal-actions' },
            el('button', { className: 'ss-btn ss-btn-primary', onClick: closeEditor }, __('Done', 'sign-selector'))
          )
        )
      ),
      pendingIndex !== null && el(ConfirmModal, {
        message: __('Are you sure you want to remove', 'sign-selector') + ' "' + pendingLabel + '"?',
        onConfirm: confirmRemove,
        onCancel: cancelRemove
      })
    );
  };

  /* ─── Tab: Shapes & Sizes ─────────────────────────────── */

  const ShapesTab = () => {
    const { items, setItems, loading, save, toast } = useCollection('/sign-selector/v1/shapes');
    const { items: signStyles, loading: signStylesLoading } = useCollection('/sign-selector/v1/sign-styles');
    const { askRemove, confirmRemove, cancelRemove, pendingIndex, pendingLabel } = useConfirmRemove(items, setItems);
    const [editingIndex, setEditingIndex] = useState(null);
    const [isAddingShape, setIsAddingShape] = useState(false);

    const signStyleOptions = signStyles.map((style) => ({
      id: style.id,
      label: style.label || style.id
    }));

    const updateField = (index, field, value) => {
      const next = [...items];
      if (field === 'isDefault' && value === true) {
        next.forEach((item, i) => {
          if (i !== index) item.isDefault = false;
        });
      }
      const parsed = (field === 'width' || field === 'height' || field === 'basePrice') ? Number(value) || 0 : value;
      next[index] = { ...next[index], [field]: parsed };
      setItems(next);
    };

    const getAssignedSignStyleIds = (item) => {
      if (Array.isArray(item.signStyleIds)) {
        return item.signStyleIds;
      }

      return signStyleOptions.map((style) => style.id);
    };

    const toggleSignStyle = (index, styleId, checked) => {
      const next = [...items];
      const currentIds = getAssignedSignStyleIds(next[index]);
      const newIds = checked
        ? Array.from(new Set([...currentIds, styleId]))
        : currentIds.filter((id) => id !== styleId);

      next[index] = { ...next[index], signStyleIds: newIds };
      setItems(next);
    };

    const getStyleSummary = (item) => {
      const assignedIds = getAssignedSignStyleIds(item);

      if (!signStyleOptions.length || assignedIds.length === signStyleOptions.length) {
        return __('All sign styles selected', 'sign-selector');
      }

      if (!assignedIds.length) {
        return __('No sign styles selected', 'sign-selector');
      }

      const labels = assignedIds
        .map((id) => signStyleOptions.find((style) => style.id === id)?.label || id)
        .filter(Boolean);

      return labels.join(', ');
    };

    const addItem = () => {
      const nextItems = [...items, {
        id: uid(),
        label: '',
        width: 10,
        height: 5,
        basePrice: 0,
        signStyleIds: signStyleOptions.map((style) => style.id),
        enabled: true,
        isDefault: false
      }];
      setItems(nextItems);
      setIsAddingShape(true);
      setEditingIndex(nextItems.length - 1);
    };

    const openEditor = (index) => {
      setIsAddingShape(false);
      setEditingIndex(index);
    };

    const closeEditor = () => {
      setEditingIndex(null);
      setIsAddingShape(false);
    };

    const saveShapes = () => {
      const normalized = items.map((item) => ({
        ...item,
        signStyleIds: Array.isArray(item.signStyleIds)
          ? item.signStyleIds
          : signStyleOptions.map((style) => style.id)
      }));

      save(normalized);
    };

    if (loading || signStylesLoading) return el('p', null, __('Loading…', 'sign-selector'));

    return el(Fragment, null,
      el('div', { className: 'ss-toolbar' },
        el('h2', null, __('Size & Shape', 'sign-selector')),
        el('button', { className: 'ss-btn ss-btn-primary', onClick: addItem }, __('+ Add Shape', 'sign-selector'))
      ),
      el('table', { className: 'ss-table' },
        el('thead', null,
          el('tr', null,
            el('th', null, __('Shape', 'sign-selector')),
            el('th', null, __('Dimensions', 'sign-selector')),
            el('th', null, __('Base Price', 'sign-selector')),
            el('th', null, __('Sign Styles', 'sign-selector')),
            el('th', null, __('Status', 'sign-selector')),
            el('th', null, __('Actions', 'sign-selector'))
          )
        ),
        el('tbody', null,
          items.map((item, i) =>
            el('tr', { key: i },
              el('td', null,
                el('div', { className: 'ss-template-meta' },
                  el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                    el('strong', { className: 'ss-template-title' }, item.label || __('Untitled Shape', 'sign-selector')),
                    item.isDefault && el('span', { className: 'ss-status-pill', style: { background: '#e0f2fe', color: '#0369a1', fontSize: '10px', padding: '2px 6px', lineHeight: '1' } }, __('Default', 'sign-selector'))
                  ),
                  el('span', { className: 'ss-template-id' }, item.id || __('No ID', 'sign-selector'))
                )
              ),
              el('td', null, `${item.width ?? 0}" × ${item.height ?? 0}"`),
              el('td', null, `$${Number(item.basePrice ?? 0).toFixed(2)}`),
              el('td', null,
                el('span', null, getStyleSummary(item))
              ),
              el('td', null,
                el('span', { className: `ss-status-pill ${item.enabled !== false ? 'enabled' : 'disabled'}` }, item.enabled !== false ? __('Enabled', 'sign-selector') : __('Disabled', 'sign-selector'))
              ),
              el('td', null,
                el('div', { className: 'ss-actions' },
                  el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openEditor(i) }, __('Edit', 'sign-selector')),
                  el('button', { className: 'ss-btn ss-btn-danger ss-btn-sm', onClick: () => askRemove(i) }, __('Remove', 'sign-selector'))
                )
              )
            )
          )
        )
      ),
      el('div', { className: 'ss-save-bar' },
        el('button', { className: 'ss-btn ss-btn-primary', onClick: saveShapes }, __('Save Shapes', 'sign-selector'))
      ),
      el(Toast, toast),
      editingIndex !== null && items[editingIndex] && el('div', { className: 'ss-modal-overlay', onClick: closeEditor },
        el('div', { className: 'ss-modal ss-template-options-modal', onClick: (e) => e.stopPropagation() },
          el('h3', { className: 'ss-template-options-title' }, isAddingShape ? __('Add Shape', 'sign-selector') : __('Edit Shape', 'sign-selector')),
          el('div', { className: 'ss-template-form-grid' },
            el('div', { className: 'ss-template-options-section' },
              el('label', { className: 'ss-template-field-label' }, __('ID', 'sign-selector')),
              el('input', { className: 'ss-input', value: items[editingIndex].id || '', onChange: (e) => updateField(editingIndex, 'id', e.target.value) }),
              el('label', { className: 'ss-template-field-label' }, __('Label', 'sign-selector')),
              el('input', { className: 'ss-input', value: items[editingIndex].label || '', onChange: (e) => updateField(editingIndex, 'label', e.target.value) }),
              el('label', { className: 'ss-template-field-label' }, __('Width', 'sign-selector')),
              el('input', { className: 'ss-input', type: 'number', value: items[editingIndex].width ?? 0, onChange: (e) => updateField(editingIndex, 'width', e.target.value) }),
              el('label', { className: 'ss-template-field-label' }, __('Height', 'sign-selector')),
              el('input', { className: 'ss-input', type: 'number', value: items[editingIndex].height ?? 0, onChange: (e) => updateField(editingIndex, 'height', e.target.value) }),
              el('label', { className: 'ss-template-field-label' }, __('Base Price ($)', 'sign-selector')),
              el('input', { className: 'ss-input', type: 'number', step: '0.01', value: items[editingIndex].basePrice ?? 0, onChange: (e) => updateField(editingIndex, 'basePrice', e.target.value) }),
              el('div', { className: 'ss-template-enabled-row' },
                el('span', { className: 'ss-template-field-label ss-template-field-label-inline' }, __('Enabled', 'sign-selector')),
                el(Toggle, { checked: items[editingIndex].enabled !== false, onChange: (v) => updateField(editingIndex, 'enabled', v) })
              ),
              el('div', { className: 'ss-template-enabled-row' },
                el('span', { className: 'ss-template-field-label ss-template-field-label-inline' }, __('Is Default', 'sign-selector')),
                el(Toggle, { checked: items[editingIndex].isDefault === true, onChange: (v) => updateField(editingIndex, 'isDefault', v) })
              )
            ),
            el('div', { className: 'ss-template-options-section' },
              el('h4', null, __('Sign Styles', 'sign-selector')),
              signStyleOptions.map((style) =>
                el('label', { key: style.id, className: 'ss-template-option-check' },
                  el('input', {
                    type: 'checkbox',
                    checked: getAssignedSignStyleIds(items[editingIndex]).includes(style.id),
                    onChange: (e) => toggleSignStyle(editingIndex, style.id, e.target.checked)
                  }),
                  style.label
                )
              )
            )
          ),
          el('div', { className: 'ss-modal-actions' },
            el('button', { className: 'ss-btn ss-btn-primary', onClick: closeEditor }, __('Done', 'sign-selector'))
          )
        )
      ),
      pendingIndex !== null && el(ConfirmModal, {
        message: __('Are you sure you want to remove', 'sign-selector') + ' "' + pendingLabel + '"?',
        onConfirm: confirmRemove,
        onCancel: cancelRemove
      })
    );
  };

  /* ─── Tab: Slate Colors ───────────────────────────────── */

  const SlateColorsTab = () => {
    const { items, setItems, loading, save, toast } = useCollection('/sign-selector/v1/slate-colors');
    const [shapeOptions, setShapeOptions] = useState([]);
    const [editingIndex, setEditingIndex] = useState(null);
    const [isAddingColor, setIsAddingColor] = useState(false);

    useEffect(() => {
      apiFetch({ path: '/sign-selector/v1/shapes' }).then((data) => {
        const options = (Array.isArray(data) ? data : [])
          .filter((shape) => shape && shape.id)
          .map((shape) => ({
            id: shape.id,
            label: shape.label || shape.id,
            width: shape.width,
            height: shape.height
          }));
        setShapeOptions(options);
      }).catch(() => { });
    }, []);

    const updateField = (index, field, value) => {
      const next = [...items];
      const parsed = field === 'price' ? Number(value) || 0 : value;
      next[index] = { ...next[index], [field]: parsed };
      setItems(next);
    };

    const updateShapeImage = (index, shapeId, url) => {
      const next = [...items];
      const images = { ...(next[index].images || {}) };
      images[shapeId] = url;
      next[index] = { ...next[index], images };
      setItems(next);
    };

    const getAssignedShapeIds = (item) => {
      if (Array.isArray(item.shapeIds)) {
        return item.shapeIds;
      }

      return shapeOptions.map((shape) => shape.id);
    };

    const toggleShape = (index, shapeId, checked) => {
      const next = [...items];
      const currentIds = getAssignedShapeIds(next[index]);
      const nextIds = checked
        ? Array.from(new Set([...currentIds, shapeId]))
        : currentIds.filter((id) => id !== shapeId);

      next[index] = { ...next[index], shapeIds: nextIds };
      setItems(next);
    };

    const getShapeSummary = (item) => {
      const assignedIds = getAssignedShapeIds(item);

      if (!shapeOptions.length || assignedIds.length === shapeOptions.length) {
        return __('All sizes & shapes', 'sign-selector');
      }

      if (!assignedIds.length) {
        return __('No sizes & shapes selected', 'sign-selector');
      }

      return assignedIds
        .map((id) => shapeOptions.find((shape) => shape.id === id)?.id || id)
        .filter(Boolean)
        .join(', ');
    };

    const getShapeDisplayLabel = (shapeId) => {
      if (shapeId === 'default') {
        return __('Default', 'sign-selector');
      }

      const shape = shapeOptions.find((s) => s.id === shapeId);
      if (!shape) return shapeId;

      return shape.id + ` ( ` + shape.label + ` )`;
    };

    const getVisibleShapeIds = (item) => {
      const assigned = getAssignedShapeIds(item);
      // Always include 'default', plus any checked shapes
      return ['default'].concat(assigned);
    };

    const addItem = () => {
      const nextItems = [...items, { id: uid(), label: '', price: 0, imageUrl: '', images: {}, shapeIds: shapeOptions.map((shape) => shape.id), enabled: true }];
      setItems(nextItems);
      setIsAddingColor(true);
      setEditingIndex(nextItems.length - 1);
    };

    const openEditor = (index) => {
      setIsAddingColor(false);
      setEditingIndex(index);
    };

    const closeEditor = () => {
      setEditingIndex(null);
      setIsAddingColor(false);
    };

    const saveSlateColors = () => {
      const normalized = items.map((item) => ({
        ...item,
        shapeIds: Array.isArray(item.shapeIds)
          ? item.shapeIds
          : shapeOptions.map((shape) => shape.id)
      }));

      save(normalized);
    };

    const { askRemove, confirmRemove, cancelRemove, pendingIndex, pendingLabel } = useConfirmRemove(items, setItems);

    return el(Fragment, null,
      el('div', { className: 'ss-toolbar' },
        el('h2', null, __('Slate Colors', 'sign-selector')),
        el('button', { className: 'ss-btn ss-btn-primary', onClick: addItem }, __('+ Add Color', 'sign-selector'))
      ),
      el('table', { className: 'ss-table' },
        el('thead', null,
          el('tr', null,
            el('th', null, __('Preview', 'sign-selector')),
            el('th', null, __('Slate Color', 'sign-selector')),
            el('th', null, __('Price ($)', 'sign-selector')),
            el('th', null, __('Sizes & Shapes', 'sign-selector')),
            el('th', null, __('Status', 'sign-selector')),
            el('th', null, __('Actions', 'sign-selector'))
          )
        ),
        el('tbody', null,
          items.map((item, i) =>
            el('tr', { key: i },
              el('td', null, item.imageUrl
                ? el('img', { className: 'ss-img-preview', src: item.imageUrl, alt: item.label })
                : el('div', { className: 'ss-color-preview' })
              ),
              el('td', null,
                el('div', { className: 'ss-template-meta' },
                  el('strong', { className: 'ss-template-title' }, item.label || __('Untitled Slate Color', 'sign-selector')),
                  el('span', { className: 'ss-template-id' }, item.id || __('No ID', 'sign-selector'))
                )
              ),
              el('td', null, Number(item.price ?? 0).toFixed(2)),
              el('td', null, getShapeSummary(item)),
              el('td', null,
                el('span', { className: `ss-status-pill ${item.enabled !== false ? 'enabled' : 'disabled'}` }, item.enabled !== false ? __('Enabled', 'sign-selector') : __('Disabled', 'sign-selector'))
              ),
              el('td', null, el('div', { className: 'ss-actions' },
                el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openEditor(i) }, __('Edit', 'sign-selector')),
                el('button', { className: 'ss-btn ss-btn-danger ss-btn-sm', onClick: () => askRemove(i) }, __('Remove', 'sign-selector'))
              ))
            )
          )
        )
      ),
      el('div', { className: 'ss-save-bar' },
        el('button', { className: 'ss-btn ss-btn-primary', onClick: saveSlateColors }, __('Save Slate Colors', 'sign-selector'))
      ),
      el(Toast, toast),
      editingIndex !== null && items[editingIndex] && el('div', { className: 'ss-modal-overlay', onClick: closeEditor },
        el('div', { className: 'ss-modal ss-template-options-modal', onClick: (e) => e.stopPropagation() },
          el('h3', { className: 'ss-template-options-title' }, isAddingColor ? __('Add Slate Color', 'sign-selector') : __('Edit Slate Color', 'sign-selector')),
          el('div', { className: 'ss-template-form-grid' },
            el('div', { className: 'ss-template-options-section' },
              el('h4', null, __('Basic Details', 'sign-selector')),
              items[editingIndex].imageUrl ? el('img', { className: 'ss-img-preview ss-template-modal-preview', src: items[editingIndex].imageUrl, alt: items[editingIndex].label || 'Slate preview' }) : null,
              el('label', { className: 'ss-template-field-label' }, __('ID', 'sign-selector')),
              el('input', { className: 'ss-input', value: items[editingIndex].id || '', onChange: (e) => updateField(editingIndex, 'id', e.target.value) }),
              el('label', { className: 'ss-template-field-label' }, __('Label', 'sign-selector')),
              el('input', { className: 'ss-input', value: items[editingIndex].label || '', onChange: (e) => updateField(editingIndex, 'label', e.target.value) }),
              el('label', { className: 'ss-template-field-label' }, __('Price ($)', 'sign-selector')),
              el('input', { className: 'ss-input', type: 'number', step: '0.01', value: items[editingIndex].price ?? 0, onChange: (e) => updateField(editingIndex, 'price', e.target.value) }),
              el('label', { className: 'ss-template-field-label' }, __('Default Image URL', 'sign-selector')),
              el('div', { className: 'ss-img-cell' },
                el('input', { className: 'ss-input', value: items[editingIndex].imageUrl || '', onChange: (e) => updateField(editingIndex, 'imageUrl', e.target.value) }),
                el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openMediaPicker((url) => updateField(editingIndex, 'imageUrl', url)) }, __('Browse', 'sign-selector'))
              ),
              el('div', { className: 'ss-template-enabled-row' },
                el('span', { className: 'ss-template-field-label ss-template-field-label-inline' }, __('Enabled', 'sign-selector')),
                el(Toggle, { checked: items[editingIndex].enabled !== false, onChange: (v) => updateField(editingIndex, 'enabled', v) })
              ),
              el('div', { className: 'ss-template-enabled-row', style: { marginTop: '8px' } },
                el('span', { className: 'ss-template-field-label ss-template-field-label-inline' }, __('Default', 'sign-selector')),
                el(Toggle, { checked: Boolean(items[editingIndex].isDefault), onChange: (v) => updateField(editingIndex, 'isDefault', v) })
              )
            ),
            el('div', { className: 'ss-template-options-section ss-slate-shapes-section' },
              el('h4', null, __('Show For Sizes & Shapes', 'sign-selector')),
              shapeOptions.map((shape) =>
                el('label', { key: shape.id, className: 'ss-template-option-check' },
                  el('input', {
                    type: 'checkbox',
                    checked: getAssignedShapeIds(items[editingIndex]).includes(shape.id),
                    onChange: (e) => toggleShape(editingIndex, shape.id, e.target.checked)
                  }),
                  getShapeDisplayLabel(shape.id)
                )
              )
            ),
            el('div', { className: 'ss-template-options-section ss-slate-images-section' },
              el('h4', null, __('Shape-specific Images', 'sign-selector')),
              el('div', { className: 'ss-shape-images-grid' },
                getVisibleShapeIds(items[editingIndex]).map(shapeId =>
                  el('div', { className: 'ss-shape-img-item', key: shapeId },
                    el('label', { className: 'ss-template-field-label' }, getShapeDisplayLabel(shapeId)),
                    items[editingIndex].images && items[editingIndex].images[shapeId]
                      ? el('img', { className: 'ss-img-preview', src: items[editingIndex].images[shapeId], alt: shapeId })
                      : null,
                    el('div', { className: 'ss-img-cell' },
                      el('input', {
                        className: 'ss-input',
                        value: (items[editingIndex].images && items[editingIndex].images[shapeId]) || '',
                        onChange: (e) => updateShapeImage(editingIndex, shapeId, e.target.value),
                        placeholder: __('Image URL', 'sign-selector')
                      }),
                      el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openMediaPicker((url) => updateShapeImage(editingIndex, shapeId, url)) }, __('Browse', 'sign-selector'))
                    )
                  )
                )
              )
            )
          ),
          el('div', { className: 'ss-modal-actions' },
            el('button', { className: 'ss-btn ss-btn-primary', onClick: closeEditor }, __('Done', 'sign-selector'))
          )
        )
      ),
      pendingIndex !== null && el(ConfirmModal, {
        message: __('Are you sure you want to remove', 'sign-selector') + ' "' + pendingLabel + '"?',
        onConfirm: confirmRemove,
        onCancel: cancelRemove
      })
    );
  };

  /* ─── Tab: Design Templates ───────────────────────────── */

  const DesignTemplatesTab = () => {
    const { items, setItems, loading, save, toast } = useCollection('/sign-selector/v1/design-templates');
    const { askRemove, confirmRemove, cancelRemove, pendingIndex, pendingLabel } = useConfirmRemove(items, setItems);
    const [shapeOptions, setShapeOptions] = useState([{ id: 'all', label: __('All Shapes', 'sign-selector') }, { id: 'none', label: __('No Shape', 'sign-selector') }]);
    const [signStyleOptions, setSignStyleOptions] = useState([]);
    const [editingTemplateIndex, setEditingTemplateIndex] = useState(null);
    const [isAddingTemplate, setIsAddingTemplate] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 8;

    const templateFieldOptions = [
      { id: 'firstLine', label: __('First Line of Text', 'sign-selector') },
      { id: 'secondLine', label: __('Second Line of Text', 'sign-selector') },
      { id: 'topText', label: __('Top Text', 'sign-selector') },
      { id: 'houseNumber', label: __('House Number', 'sign-selector') },
      { id: 'bottomText', label: __('Bottom Text', 'sign-selector') }
    ];

    useEffect(() => {
      apiFetch({ path: '/sign-selector/v1/shapes' }).then((data) => {
        const options = (Array.isArray(data) ? data : [])
          .filter((shape) => shape && shape.id)
          .map((shape) => ({ id: shape.id, label: shape.label || shape.id }));

        setShapeOptions([{ id: 'all', label: __('All Shapes', 'sign-selector') }, { id: 'none', label: __('No Shape', 'sign-selector') }, ...options]);
      }).catch(() => { });

      apiFetch({ path: '/sign-selector/v1/sign-styles' }).then((data) => {
        const options = (Array.isArray(data) ? data : [])
          .filter((style) => style && style.id)
          .map((style) => ({ id: style.id, label: style.label || style.id }));

        setSignStyleOptions(options);
      }).catch(() => { });
    }, []);

    const updateField = (index, field, value) => {
      const next = [...items];
      next[index] = { ...next[index], [field]: value };
      setItems(next);
    };

    const normalizeTemplateFieldKey = (value) => {
      const normalized = String(value || '').trim().toLowerCase();

      if (['first', 'firstline', 'first_line', 'line1', 'line_1'].includes(normalized)) return 'firstLine';
      if (['second', 'secondline', 'second_line', 'line2', 'line_2'].includes(normalized)) return 'secondLine';
      if (['top', 'toptext', 'top_text', 'header', 'title'].includes(normalized)) return 'topText';
      if (['number', 'house', 'housenumber', 'house_number', 'address'].includes(normalized)) return 'houseNumber';
      if (['bottom', 'bottomtext', 'bottom_text', 'street', 'footer', 'subtitle'].includes(normalized)) return 'bottomText';

      return '';
    };

    const getTemplateFields = (item) => {
      if (Array.isArray(item.fields) && item.fields.length) {
        return item.fields
          .map(normalizeTemplateFieldKey)
          .filter(Boolean)
          .filter((value, index, arr) => arr.indexOf(value) === index);
      }

      const layout = String(item.textLayout || '').trim().toLowerCase();

      if (layout === 'top-number-bottom' || layout === 'top_house_bottom' || layout === 'full') {
        return ['topText', 'houseNumber', 'bottomText'];
      }

      if (layout === 'number') {
        return ['houseNumber'];
      }

      return ['houseNumber', 'bottomText'];
    };

    const inferTextLayout = (fields) => {
      if (fields.includes('firstLine') || fields.includes('secondLine')) {
        return fields.includes('secondLine') ? 'two-lines' : 'one-line';
      }
      if (fields.includes('topText')) return 'top-number-bottom';
      if (fields.includes('bottomText')) return 'number-bottom';
      if (fields.includes('houseNumber')) return 'number';
      return 'number';
    };

    const toggleTemplateField = (index, fieldKey, checked) => {
      const next = [...items];
      const currentFields = getTemplateFields(next[index]);
      const updatedFields = checked
        ? Array.from(new Set([...currentFields, fieldKey]))
        : currentFields.filter((value) => value !== fieldKey);

      next[index] = {
        ...next[index],
        fields: updatedFields,
        textLayout: inferTextLayout(updatedFields)
      };

      setItems(next);
    };

    const getAssignedSignStyleIds = (item) => {
      if (Array.isArray(item.signStyleIds)) {
        return item.signStyleIds;
      }

      return signStyleOptions.map((style) => style.id);
    };

    const toggleSignStyle = (index, styleId, checked) => {
      const next = [...items];
      const currentIds = getAssignedSignStyleIds(next[index]);
      const newIds = checked
        ? Array.from(new Set([...currentIds, styleId]))
        : currentIds.filter((id) => id !== styleId);

      next[index] = { ...next[index], signStyleIds: newIds };
      setItems(next);
    };

    const openTemplateOptions = (index) => {
      setIsAddingTemplate(false);
      setEditingTemplateIndex(index);
    };

    const closeTemplateOptions = () => {
      setEditingTemplateIndex(null);
      setIsAddingTemplate(false);
    };

    const getStyleSummary = (item) => {
      const assignedIds = getAssignedSignStyleIds(item);

      if (!signStyleOptions.length || assignedIds.length === signStyleOptions.length) {
        return __('All sign styles selected', 'sign-selector');
      }

      if (!assignedIds.length) {
        return __('No sign styles selected', 'sign-selector');
      }

      const labels = assignedIds
        .map((id) => signStyleOptions.find((style) => style.id === id)?.label || id)
        .filter(Boolean);

      return labels.join(', ');
    };

    const getFieldSummary = (item) => {
      const activeFields = getTemplateFields(item);

      if (!activeFields.length) {
        return __('No text fields selected', 'sign-selector');
      }

      return activeFields
        .map((id) => templateFieldOptions.find((field) => field.id === id)?.label || id)
        .join(', ');
    };

    const getShapeSummary = (item) => {
      return shapeOptions.find((shape) => shape.id === (item.shapeId || 'all'))?.label || item.shapeId || __('All Shapes', 'sign-selector');
    };

    const orderedTemplateEntries = items.map((item, index) => ({ item, index })).reverse();
    const totalPages = Math.max(1, Math.ceil(orderedTemplateEntries.length / pageSize));
    const paginatedTemplateEntries = orderedTemplateEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    useEffect(() => {
      if (currentPage > totalPages) {
        setCurrentPage(totalPages);
      }
    }, [currentPage, totalPages]);

    const addItem = () => {
      const nextItems = [...items, {
        id: uid(),
        label: '',
        tier: 'Standard',
        shapeId: 'all',
        signStyleIds: signStyleOptions.map((style) => style.id),
        fields: ['houseNumber'],
        textLayout: 'number',
        imageUrl: '',
        enabled: true
      }];

      setItems(nextItems);
      setCurrentPage(1);
      setIsAddingTemplate(true);
      setEditingTemplateIndex(nextItems.length - 1);
    };

    const saveTemplates = () => {
      const normalized = items.map(({ images, price, ...item }) => {
        const fields = getTemplateFields(item);

        return {
          ...item,
          price: 0,
          shapeId: item.shapeId || 'all',
          signStyleIds: Array.isArray(item.signStyleIds)
            ? item.signStyleIds
            : signStyleOptions.map((style) => style.id),
          fields,
          textLayout: inferTextLayout(fields),
          imageUrl: item.imageUrl || ''
        };
      });

      save(normalized);
    };

    if (loading) return el('p', null, __('Loading…', 'sign-selector'));

    return el(Fragment, null,
      el('div', { className: 'ss-toolbar' },
        el('h2', null, __('Design Templates', 'sign-selector')),
        el('button', { className: 'ss-btn ss-btn-primary', onClick: addItem }, __('+ Add Template', 'sign-selector'))
      ),
      el('table', { className: 'ss-table' },
        el('thead', null,
          el('tr', null,
            el('th', null, __('Image', 'sign-selector')),
            el('th', null, __('Template', 'sign-selector')),
            el('th', null, __('Tier', 'sign-selector')),
            el('th', null, __('Shape', 'sign-selector')),
            el('th', null, __('Template Options', 'sign-selector')),
            el('th', null, __('Status', 'sign-selector')),
            el('th', null, __('Actions', 'sign-selector'))
          )
        ),
        el('tbody', null,
          paginatedTemplateEntries.map(({ item, index }) =>
            el('tr', { key: item.id || index },
              el('td', null,
                item.imageUrl
                  ? el('img', { className: 'ss-img-preview', src: item.imageUrl, alt: item.label || item.id || 'Template preview' })
                  : el('div', { className: 'ss-img-preview ss-img-preview-empty' })
              ),
              el('td', null,
                el('div', { className: 'ss-template-meta' },
                  el('strong', { className: 'ss-template-title' }, item.label || __('Untitled Template', 'sign-selector')),
                  el('span', { className: 'ss-template-id' }, item.id || __('No ID', 'sign-selector'))
                )
              ),
              el('td', null, item.tier || 'Standard'),
              el('td', null, getShapeSummary(item)),
              el('td', null,
                el('div', { className: 'ss-template-config-summary' },
                  el('div', { className: 'ss-template-config-line' },
                    el('strong', null, __('Styles:', 'sign-selector') + ' '),
                    el('span', null, getStyleSummary(item))
                  ),
                  el('div', { className: 'ss-template-config-line' },
                    el('strong', null, __('Fields:', 'sign-selector') + ' '),
                    el('span', null, getFieldSummary(item))
                  )
                )
              ),
              el('td', null,
                el('span', { className: `ss-status-pill ${item.enabled !== false ? 'enabled' : 'disabled'}` }, item.enabled !== false ? __('Enabled', 'sign-selector') : __('Disabled', 'sign-selector'))
              ),
              el('td', null,
                el('div', { className: 'ss-actions' },
                  el('button', {
                    type: 'button',
                    className: 'ss-btn ss-btn-sm',
                    onClick: () => openTemplateOptions(index)
                  }, __('Edit', 'sign-selector')),
                  el('button', { className: 'ss-btn ss-btn-danger ss-btn-sm', onClick: () => askRemove(index) }, __('Remove', 'sign-selector'))
                )
              )
            )
          )
        )
      ),
      totalPages > 1 && el('div', { className: 'ss-pagination' },
        el('button', {
          type: 'button',
          className: 'ss-btn ss-btn-sm',
          disabled: currentPage <= 1,
          onClick: () => setCurrentPage((page) => Math.max(1, page - 1))
        }, __('Previous', 'sign-selector')),
        el('span', { className: 'ss-pagination-label' }, `${__('Page', 'sign-selector')} ${currentPage} ${__('of', 'sign-selector')} ${totalPages}`),
        el('button', {
          type: 'button',
          className: 'ss-btn ss-btn-sm',
          disabled: currentPage >= totalPages,
          onClick: () => setCurrentPage((page) => Math.min(totalPages, page + 1))
        }, __('Next', 'sign-selector'))
      ),
      el('div', { className: 'ss-save-bar' },
        el('button', { className: 'ss-btn ss-btn-primary', onClick: saveTemplates }, __('Save Templates', 'sign-selector'))
      ),
      el(Toast, toast),
      editingTemplateIndex !== null && items[editingTemplateIndex] && el('div', { className: 'ss-modal-overlay', onClick: closeTemplateOptions },
        el('div', { className: 'ss-modal ss-template-options-modal', onClick: (e) => e.stopPropagation() },
          el('h3', { className: 'ss-template-options-title' }, isAddingTemplate ? __('Add Template', 'sign-selector') : __('Edit Template', 'sign-selector')),
          el('p', { className: 'ss-template-options-subtitle' }, items[editingTemplateIndex].label || items[editingTemplateIndex].id || __('Template', 'sign-selector')),
          el('div', { className: 'ss-template-form-grid' },
            el('div', { className: 'ss-template-options-section' },
              el('h4', null, __('Basic Details', 'sign-selector')),
              items[editingTemplateIndex].imageUrl ? el('img', { className: 'ss-img-preview ss-template-modal-preview', src: items[editingTemplateIndex].imageUrl, alt: items[editingTemplateIndex].label || 'Template preview' }) : null,
              el('label', { className: 'ss-template-field-label' }, __('Image URL', 'sign-selector')),
              el('div', { className: 'ss-img-cell' },
                el('input', {
                  className: 'ss-input',
                  value: items[editingTemplateIndex].imageUrl || '',
                  onChange: (e) => updateField(editingTemplateIndex, 'imageUrl', e.target.value)
                }),
                el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openMediaPicker((url) => updateField(editingTemplateIndex, 'imageUrl', url)) }, __('Browse', 'sign-selector'))
              ),
              el('label', { className: 'ss-template-field-label' }, __('ID', 'sign-selector')),
              el('input', {
                className: 'ss-input',
                value: items[editingTemplateIndex].id || '',
                onChange: (e) => updateField(editingTemplateIndex, 'id', e.target.value)
              }),
              el('label', { className: 'ss-template-field-label' }, __('Label', 'sign-selector')),
              el('input', {
                className: 'ss-input',
                value: items[editingTemplateIndex].label || '',
                onChange: (e) => updateField(editingTemplateIndex, 'label', e.target.value)
              }),
              el('label', { className: 'ss-template-field-label' }, __('Tier', 'sign-selector')),
              el('select', {
                className: 'ss-input',
                value: items[editingTemplateIndex].tier || 'Standard',
                onChange: (e) => updateField(editingTemplateIndex, 'tier', e.target.value)
              },
                el('option', { value: 'Deluxe' }, 'Deluxe'),
                el('option', { value: 'Standard' }, 'Standard')
              ),
              el('label', { className: 'ss-template-field-label' }, __('Shape', 'sign-selector')),
              el('select', {
                className: 'ss-input',
                value: items[editingTemplateIndex].shapeId || 'all',
                onChange: (e) => updateField(editingTemplateIndex, 'shapeId', e.target.value)
              },
                shapeOptions.map((shape) => el('option', { key: shape.id, value: shape.id }, shape.label))
              ),
              el('div', { className: 'ss-template-enabled-row' },
                el('span', { className: 'ss-template-field-label ss-template-field-label-inline' }, __('Enabled', 'sign-selector')),
                el(Toggle, { checked: items[editingTemplateIndex].enabled !== false, onChange: (v) => updateField(editingTemplateIndex, 'enabled', v) })
              )
            ),
            el('div', { className: 'ss-template-options-section' },
              el('h4', null, __('Sign Styles', 'sign-selector')),
              signStyleOptions.map((style) =>
                el('label', { key: style.id, className: 'ss-template-option-check' },
                  el('input', {
                    type: 'checkbox',
                    checked: getAssignedSignStyleIds(items[editingTemplateIndex]).includes(style.id),
                    onChange: (e) => toggleSignStyle(editingTemplateIndex, style.id, e.target.checked)
                  }),
                  style.label
                )
              )
            ),
            el('div', { className: 'ss-template-options-section' },
              el('h4', null, __('Text Fields', 'sign-selector')),
              templateFieldOptions.map((field) =>
                el('label', { key: field.id, className: 'ss-template-option-check' },
                  el('input', {
                    type: 'checkbox',
                    checked: getTemplateFields(items[editingTemplateIndex]).includes(field.id),
                    onChange: (e) => toggleTemplateField(editingTemplateIndex, field.id, e.target.checked)
                  }),
                  field.label
                )
              )
            )
          ),
          el('div', { className: 'ss-modal-actions' },
            el('button', { className: 'ss-btn', onClick: closeTemplateOptions }, __('Close', 'sign-selector')),
            el('button', { className: 'ss-btn ss-btn-primary', onClick: closeTemplateOptions }, __('Done', 'sign-selector'))
          )
        )
      ),
      pendingIndex !== null && el(ConfirmModal, {
        message: __('Are you sure you want to remove', 'sign-selector') + ' "' + pendingLabel + '"?',
        onConfirm: confirmRemove,
        onCancel: cancelRemove
      })
    );
  };

  /* ─── Tab: Paint Colors ───────────────────────────────── */

  const PaintColorsTab = () => {
    const { items, setItems, loading, save, toast } = useCollection('/sign-selector/v1/paint-colors');
    const { askRemove, confirmRemove, cancelRemove, pendingIndex, pendingLabel } = useConfirmRemove(items, setItems);
    const [editingIndex, setEditingIndex] = useState(null);
    const [isAddingPaint, setIsAddingPaint] = useState(false);

    const updateField = (index, field, value) => {
      const next = [...items];
      if (field === 'isDefault' && value === true) {
        next.forEach((item, i) => {
          if (i !== index) item.isDefault = false;
        });
      }
      next[index] = { ...next[index], [field]: value };
      setItems(next);
    };

    const addItem = () => {
      const nextItems = [...items, { id: uid(), label: '', hex: '#ffffff', price: 0, image: '', imageUrl: '', enabled: true, isDefault: false }];
      setItems(nextItems);
      setIsAddingPaint(true);
      setEditingIndex(nextItems.length - 1);
    };

    const openEditor = (index) => {
      setIsAddingPaint(false);
      setEditingIndex(index);
    };

    const closeEditor = () => {
      setEditingIndex(null);
      setIsAddingPaint(false);
    };

    const savePaintColors = () => {
      save(items.map((item) => ({ ...item, price: 0 })));
    };

    if (loading) return el('p', null, __('Loading…', 'sign-selector'));

    return el(Fragment, null,
      el('div', { className: 'ss-toolbar' },
        el('h2', null, __('Paint Colors', 'sign-selector')),
        el('button', { className: 'ss-btn ss-btn-primary', onClick: addItem }, __('+ Add Paint Color', 'sign-selector'))
      ),
      el('table', { className: 'ss-table' },
        el('thead', null,
          el('tr', null,
            el('th', null, __('Color', 'sign-selector')),
            el('th', null, __('Paint', 'sign-selector')),
            el('th', null, __('Hex', 'sign-selector')),
            el('th', null, __('Status', 'sign-selector')),
            el('th', null, __('Actions', 'sign-selector'))
          )
        ),
        el('tbody', null,
          items.map((item, i) =>
            el('tr', { key: i },
              el('td', null, el('div', { className: 'ss-color-preview', style: { backgroundColor: item.hex || '#ccc' } })),
              el('td', null,
                el('div', { className: 'ss-template-meta' },
                  el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                    el('strong', { className: 'ss-template-title' }, item.label || __('Untitled Paint', 'sign-selector')),
                    item.isDefault && el('span', { className: 'ss-status-pill', style: { background: '#e0f2fe', color: '#0369a1', fontSize: '10px', padding: '2px 6px', lineHeight: '1' } }, __('Default', 'sign-selector'))
                  ),
                  el('span', { className: 'ss-template-id' }, item.id || __('No ID', 'sign-selector'))
                )
              ),
              el('td', null, item.hex || '#ffffff'),
              el('td', null,
                el('span', { className: `ss-status-pill ${item.enabled !== false ? 'enabled' : 'disabled'}` }, item.enabled !== false ? __('Enabled', 'sign-selector') : __('Disabled', 'sign-selector'))
              ),
              el('td', null,
                el('div', { className: 'ss-actions' },
                  el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openEditor(i) }, __('Edit', 'sign-selector')),
                  el('button', { className: 'ss-btn ss-btn-danger ss-btn-sm', onClick: () => askRemove(i) }, __('Remove', 'sign-selector'))
                )
              )
            )
          )
        )
      ),
      el('div', { className: 'ss-save-bar' },
        el('button', { className: 'ss-btn ss-btn-primary', onClick: savePaintColors }, __('Save Paint Colors', 'sign-selector'))
      ),
      el(Toast, toast),
      editingIndex !== null && items[editingIndex] && el('div', { className: 'ss-modal-overlay', onClick: closeEditor },
        el('div', { className: 'ss-modal ss-template-options-modal', onClick: (e) => e.stopPropagation() },
          el('h3', { className: 'ss-template-options-title' }, isAddingPaint ? __('Add Paint Color', 'sign-selector') : __('Edit Paint Color', 'sign-selector')),
          el('div', { className: 'ss-template-options-section' },
            items[editingIndex].imageUrl ? el('img', { className: 'ss-img-preview ss-template-modal-preview', src: items[editingIndex].imageUrl, alt: items[editingIndex].label || 'Paint preview' }) : null,
            el('label', { className: 'ss-template-field-label' }, __('ID', 'sign-selector')),
            el('input', { className: 'ss-input', value: items[editingIndex].id || '', onChange: (e) => updateField(editingIndex, 'id', e.target.value) }),
            el('label', { className: 'ss-template-field-label' }, __('Label', 'sign-selector')),
            el('input', { className: 'ss-input', value: items[editingIndex].label || '', onChange: (e) => updateField(editingIndex, 'label', e.target.value) }),
            el('label', { className: 'ss-template-field-label' }, __('Hex', 'sign-selector')),
            el('input', { className: 'ss-input', type: 'color', value: items[editingIndex].hex || '#ffffff', onChange: (e) => updateField(editingIndex, 'hex', e.target.value) }),
            el('label', { className: 'ss-template-field-label' }, __('Texture Image URL', 'sign-selector')),
            el('div', { className: 'ss-img-cell' },
              el('input', { className: 'ss-input', value: items[editingIndex].imageUrl || '', onChange: (e) => updateField(editingIndex, 'imageUrl', e.target.value) }),
              el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openMediaPicker((url) => updateField(editingIndex, 'imageUrl', url)) }, __('Browse', 'sign-selector'))
            ),
            el('div', { className: 'ss-template-enabled-row' },
              el('span', { className: 'ss-template-field-label ss-template-field-label-inline' }, __('Enabled', 'sign-selector')),
              el(Toggle, { checked: items[editingIndex].enabled !== false, onChange: (v) => updateField(editingIndex, 'enabled', v) })
            ),
            el('div', { className: 'ss-template-enabled-row' },
              el('span', { className: 'ss-template-field-label ss-template-field-label-inline' }, __('Is Default', 'sign-selector')),
              el(Toggle, { checked: items[editingIndex].isDefault === true, onChange: (v) => updateField(editingIndex, 'isDefault', v) })
            )
          ),
          el('div', { className: 'ss-modal-actions' },
            el('button', { className: 'ss-btn ss-btn-primary', onClick: closeEditor }, __('Done', 'sign-selector'))
          )
        )
      ),
      pendingIndex !== null && el(ConfirmModal, {
        message: __('Are you sure you want to remove', 'sign-selector') + ' "' + pendingLabel + '"?',
        onConfirm: confirmRemove,
        onCancel: cancelRemove
      })
    );
  };

  /* ─── Tab: Add-ons ────────────────────────────────────── */

  const AddonsTab = () => {
    const { items, setItems, loading, save, toast } = useCollection('/sign-selector/v1/addons');
    const { askRemove, confirmRemove, cancelRemove, pendingIndex, pendingLabel } = useConfirmRemove(items, setItems);
    const [editingIndex, setEditingIndex] = useState(null);
    const [isAddingAddon, setIsAddingAddon] = useState(false);

    const updateField = (index, field, value) => {
      const next = [...items];
      const parsed = field === 'price' ? Number(value) || 0 : value;
      next[index] = { ...next[index], [field]: parsed };
      setItems(next);
    };

    const addItem = () => {
      const nextItems = [...items, { id: uid(), label: '', price: 0, enabled: true, isDefault: false }];
      setItems(nextItems);
      setIsAddingAddon(true);
      setEditingIndex(nextItems.length - 1);
    };

    const openEditor = (index) => {
      setIsAddingAddon(false);
      setEditingIndex(index);
    };

    const closeEditor = () => {
      setEditingIndex(null);
      setIsAddingAddon(false);
    };

    if (loading) return el('p', null, __('Loading…', 'sign-selector'));

    return el(Fragment, null,
      el('div', { className: 'ss-toolbar' },
        el('h2', null, __('Add-ons', 'sign-selector')),
        el('button', { className: 'ss-btn ss-btn-primary', onClick: addItem }, __('+ Add', 'sign-selector'))
      ),
      el('table', { className: 'ss-table' },
        el('thead', null,
          el('tr', null,
            el('th', null, __('Add-on', 'sign-selector')),
            el('th', null, __('Price ($)', 'sign-selector')),
            el('th', null, __('Status', 'sign-selector')),
            el('th', null, __('Actions', 'sign-selector'))
          )
        ),
        el('tbody', null,
          items.map((item, i) =>
            el('tr', { key: i },
              el('td', null,
                el('div', { className: 'ss-template-meta' },
                  el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                    el('strong', { className: 'ss-template-title' }, item.label || __('Untitled Add-on', 'sign-selector')),
                    item.isDefault && el('span', { className: 'ss-status-pill', style: { background: '#e0f2fe', color: '#0369a1', fontSize: '10px', padding: '2px 6px', lineHeight: '1' } }, __('Default', 'sign-selector'))
                  ),
                  el('span', { className: 'ss-template-id' }, item.id || __('No ID', 'sign-selector'))
                )
              ),
              el('td', null, Number(item.price ?? 0).toFixed(2)),
              el('td', null,
                el('span', { className: `ss-status-pill ${item.enabled !== false ? 'enabled' : 'disabled'}` }, item.enabled !== false ? __('Enabled', 'sign-selector') : __('Disabled', 'sign-selector'))
              ),
              el('td', null,
                el('div', { className: 'ss-actions' },
                  el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openEditor(i) }, __('Edit', 'sign-selector')),
                  el('button', { className: 'ss-btn ss-btn-danger ss-btn-sm', onClick: () => askRemove(i) }, __('Remove', 'sign-selector'))
                )
              )
            )
          )
        )
      ),
      el('div', { className: 'ss-save-bar' },
        el('button', { className: 'ss-btn ss-btn-primary', onClick: () => save() }, __('Save Add-ons', 'sign-selector'))
      ),
      el(Toast, toast),
      editingIndex !== null && items[editingIndex] && el('div', { className: 'ss-modal-overlay', onClick: closeEditor },
        el('div', { className: 'ss-modal ss-template-options-modal', onClick: (e) => e.stopPropagation() },
          el('h3', { className: 'ss-template-options-title' }, isAddingAddon ? __('Add Add-on', 'sign-selector') : __('Edit Add-on', 'sign-selector')),
          el('div', { className: 'ss-template-options-section' },
            el('label', { className: 'ss-template-field-label' }, __('ID', 'sign-selector')),
            el('input', { className: 'ss-input', value: items[editingIndex].id || '', onChange: (e) => updateField(editingIndex, 'id', e.target.value) }),
            el('label', { className: 'ss-template-field-label' }, __('Label', 'sign-selector')),
            el('input', { className: 'ss-input', value: items[editingIndex].label || '', onChange: (e) => updateField(editingIndex, 'label', e.target.value) }),
            el('label', { className: 'ss-template-field-label' }, __('Price ($)', 'sign-selector')),
            el('input', { className: 'ss-input', type: 'number', step: '0.01', value: items[editingIndex].price ?? 0, onChange: (e) => updateField(editingIndex, 'price', e.target.value) }),
            el('div', { className: 'ss-template-enabled-row' },
              el('span', { className: 'ss-template-field-label ss-template-field-label-inline' }, __('Enabled', 'sign-selector')),
              el(Toggle, { checked: items[editingIndex].enabled !== false, onChange: (v) => updateField(editingIndex, 'enabled', v) })
            ),
            el('div', { className: 'ss-template-enabled-row' },
              el('span', { className: 'ss-template-field-label ss-template-field-label-inline' }, __('Is Default', 'sign-selector')),
              el(Toggle, { checked: items[editingIndex].isDefault === true, onChange: (v) => updateField(editingIndex, 'isDefault', v) })
            )
          ),
          el('div', { className: 'ss-modal-actions' },
            el('button', { className: 'ss-btn ss-btn-primary', onClick: closeEditor }, __('Done', 'sign-selector'))
          )
        )
      ),
      pendingIndex !== null && el(ConfirmModal, {
        message: __('Are you sure you want to remove', 'sign-selector') + ' "' + pendingLabel + '"?',
        onConfirm: confirmRemove,
        onCancel: cancelRemove
      })
    );
  };

  /* ─── Tab: Mounting Hardware ──────────────────────────── */

  const MountingHardwareTab = () => {
    const { items, setItems, loading, save, toast } = useCollection('/sign-selector/v1/mounting-hardware');
    const { askRemove, confirmRemove, cancelRemove, pendingIndex, pendingLabel } = useConfirmRemove(items, setItems);
    const [editingIndex, setEditingIndex] = useState(null);
    const [isAddingHardware, setIsAddingHardware] = useState(false);

    const updateField = (index, field, value) => {
      const next = [...items];
      if (field === 'isDefault' && value === true) {
        next.forEach((item, i) => {
          if (i !== index) item.isDefault = false;
        });
      }
      const parsed = field === 'price' ? Number(value) || 0 : value;
      next[index] = { ...next[index], [field]: parsed };
      setItems(next);
    };

    const addItem = () => {
      const nextItems = [...items, { id: uid(), label: '', price: 0, enabled: true, isDefault: false }];
      setItems(nextItems);
      setIsAddingHardware(true);
      setEditingIndex(nextItems.length - 1);
    };

    const openEditor = (index) => {
      setIsAddingHardware(false);
      setEditingIndex(index);
    };

    const closeEditor = () => {
      setEditingIndex(null);
      setIsAddingHardware(false);
    };

    if (loading) return el('p', null, __('Loading…', 'sign-selector'));

    return el(Fragment, null,
      el('div', { className: 'ss-toolbar' },
        el('h2', null, __('Mounting Hardware', 'sign-selector')),
        el('button', { className: 'ss-btn ss-btn-primary', onClick: addItem }, __('+ Add', 'sign-selector'))
      ),
      el('table', { className: 'ss-table' },
        el('thead', null,
          el('tr', null,
            el('th', null, __('Hardware', 'sign-selector')),
            el('th', null, __('Price ($)', 'sign-selector')),
            el('th', null, __('Status', 'sign-selector')),
            el('th', null, __('Actions', 'sign-selector'))
          )
        ),
        el('tbody', null,
          items.map((item, i) =>
            el('tr', { key: i },
              el('td', null,
                el('div', { className: 'ss-template-meta' },
                  el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                    el('strong', { className: 'ss-template-title' }, item.label || __('Untitled Hardware', 'sign-selector')),
                    item.isDefault && el('span', { className: 'ss-status-pill', style: { background: '#e0f2fe', color: '#0369a1', fontSize: '10px', padding: '2px 6px', lineHeight: '1' } }, __('Default', 'sign-selector'))
                  ),
                  el('span', { className: 'ss-template-id' }, item.id || __('No ID', 'sign-selector'))
                )
              ),
              el('td', null, Number(item.price ?? 0).toFixed(2)),
              el('td', null,
                el('span', { className: `ss-status-pill ${item.enabled !== false ? 'enabled' : 'disabled'}` }, item.enabled !== false ? __('Enabled', 'sign-selector') : __('Disabled', 'sign-selector'))
              ),
              el('td', null,
                el('div', { className: 'ss-actions' },
                  el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openEditor(i) }, __('Edit', 'sign-selector')),
                  el('button', { className: 'ss-btn ss-btn-danger ss-btn-sm', onClick: () => askRemove(i) }, __('Remove', 'sign-selector'))
                )
              )
            )
          )
        )
      ),
      el('div', { className: 'ss-save-bar' },
        el('button', { className: 'ss-btn ss-btn-primary', onClick: () => save() }, __('Save Hardware', 'sign-selector'))
      ),
      el(Toast, toast),
      editingIndex !== null && items[editingIndex] && el('div', { className: 'ss-modal-overlay', onClick: closeEditor },
        el('div', { className: 'ss-modal ss-template-options-modal', onClick: (e) => e.stopPropagation() },
          el('h3', { className: 'ss-template-options-title' }, isAddingHardware ? __('Add Hardware', 'sign-selector') : __('Edit Hardware', 'sign-selector')),
          el('div', { className: 'ss-template-options-section' },
            el('label', { className: 'ss-template-field-label' }, __('ID', 'sign-selector')),
            el('input', { className: 'ss-input', value: items[editingIndex].id || '', onChange: (e) => updateField(editingIndex, 'id', e.target.value) }),
            el('label', { className: 'ss-template-field-label' }, __('Label', 'sign-selector')),
            el('input', { className: 'ss-input', value: items[editingIndex].label || '', onChange: (e) => updateField(editingIndex, 'label', e.target.value) }),
            el('label', { className: 'ss-template-field-label' }, __('Price ($)', 'sign-selector')),
            el('input', { className: 'ss-input', type: 'number', step: '0.01', value: items[editingIndex].price ?? 0, onChange: (e) => updateField(editingIndex, 'price', e.target.value) }),
            el('div', { className: 'ss-template-enabled-row' },
              el('span', { className: 'ss-template-field-label ss-template-field-label-inline' }, __('Enabled', 'sign-selector')),
              el(Toggle, { checked: items[editingIndex].enabled !== false, onChange: (v) => updateField(editingIndex, 'enabled', v) })
            ),
            el('div', { className: 'ss-template-enabled-row' },
              el('span', { className: 'ss-template-field-label ss-template-field-label-inline' }, __('Is Default', 'sign-selector')),
              el(Toggle, { checked: items[editingIndex].isDefault === true, onChange: (v) => updateField(editingIndex, 'isDefault', v) })
            )
          ),
          el('div', { className: 'ss-modal-actions' },
            el('button', { className: 'ss-btn ss-btn-primary', onClick: closeEditor }, __('Done', 'sign-selector'))
          )
        )
      ),
      pendingIndex !== null && el(ConfirmModal, {
        message: __('Are you sure you want to remove', 'sign-selector') + ' "' + pendingLabel + '"?',
        onConfirm: confirmRemove,
        onCancel: cancelRemove
      })
    );
  };

  /* ─── App shell ───────────────────────────────────────── */

  const TABS = [
    { key: 'steps', label: __('Steps', 'sign-selector'), component: StepsTab },
    { key: 'styles', label: __('Sign Styles', 'sign-selector'), component: SignStylesTab },
    { key: 'surfaces', label: __('Surfaces', 'sign-selector'), component: SurfacesTab },
    { key: 'shapes', label: __('Shapes & Sizes', 'sign-selector'), component: ShapesTab },
    { key: 'slates', label: __('Slate Colors', 'sign-selector'), component: SlateColorsTab },
    { key: 'templates', label: __('Templates', 'sign-selector'), component: DesignTemplatesTab },
    { key: 'paints', label: __('Paint Colors', 'sign-selector'), component: PaintColorsTab },
    { key: 'addons', label: __('Add-ons', 'sign-selector'), component: AddonsTab },
    { key: 'hardware', label: __('Hardware', 'sign-selector'), component: MountingHardwareTab },
  ];

  const App = () => {
    const [activeTab, setActiveTab] = useState('steps');
    const ActiveComponent = TABS.find(t => t.key === activeTab)?.component || StepsTab;

    return el('div', { id: 'sign-selector-admin-app' },
      el('div', { className: 'ss-admin-header' },
        el('h1', null, __('Sign Selector Settings', 'sign-selector'))
      ),
      el('div', { className: 'ss-tabs' },
        TABS.map(tab =>
          el('button', {
            key: tab.key,
            className: 'ss-tab' + (activeTab === tab.key ? ' active' : ''),
            onClick: () => setActiveTab(tab.key)
          }, tab.label)
        )
      ),
      el('div', { className: 'ss-section' },
        el(ActiveComponent)
      )
    );
  };

  /* ─── Mount ───────────────────────────────────────────── */

  const target = document.getElementById('sign-selector-admin-app');
  if (target) {
    wp.element.render(el(App), target);
  }
})();
