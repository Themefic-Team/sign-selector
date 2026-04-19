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

    const updateField = (index, field, value) => {
      const next = [...items];
      next[index] = { ...next[index], [field]: value };
      setItems(next);
    };

    const addItem = () => {
      setItems([...items, { id: items.length + 1, title: '', heading: '', subheading: '', enabled: true }]);
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
            el('th', null, __('Heading', 'sign-selector')),
            el('th', null, __('Subheading', 'sign-selector')),
            el('th', null, __('Enabled', 'sign-selector')),
            el('th', null, __('Actions', 'sign-selector'))
          )
        ),
        el('tbody', null,
          items.map((item, i) =>
            el('tr', { key: i },
              el('td', null, item.id),
              el('td', null, el('input', { className: 'ss-input', value: item.title || '', onChange: (e) => updateField(i, 'title', e.target.value) })),
              el('td', null, el('input', { className: 'ss-input', value: item.heading || '', onChange: (e) => updateField(i, 'heading', e.target.value) })),
              el('td', null, el('input', { className: 'ss-input', value: item.subheading || '', onChange: (e) => updateField(i, 'subheading', e.target.value) })),
              el('td', null, el(Toggle, { checked: item.enabled !== false, onChange: (v) => updateField(i, 'enabled', v) })),
              el('td', null, el('button', { className: 'ss-btn ss-btn-danger ss-btn-sm', onClick: () => askRemove(i) }, __('Remove', 'sign-selector')))
            )
          )
        )
      ),
      el('div', { className: 'ss-save-bar' },
        el('button', { className: 'ss-btn ss-btn-primary', onClick: () => save() }, __('Save Steps', 'sign-selector'))
      ),
      el(Toast, toast),
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
    const [expandedFlow, setExpandedFlow] = useState(null);

    const updateField = (index, field, value) => {
      const next = [...items];
      next[index] = { ...next[index], [field]: value };
      setItems(next);
    };

    const addItem = () => {
      setItems([...items, { id: uid(), label: '', description: '', icon: '', iconUrl: '', enabled: true, flow: [...defaultFlow] }]);
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
            el('th', null, __('ID', 'sign-selector')),
            el('th', null, __('Label', 'sign-selector')),
            el('th', null, __('Description', 'sign-selector')),
            el('th', null, __('Icon (Image URL or SVG)', 'sign-selector')),
            el('th', null, __('Enabled', 'sign-selector')),
            el('th', null, __('Actions', 'sign-selector'))
          )
        ),
        el('tbody', null,
          items.map((item, i) =>
            el(Fragment, { key: i },
              el('tr', null,
                el('td', null,
                  item.iconUrl
                    ? el('img', { className: 'ss-img-preview', src: item.iconUrl, alt: item.label, style: { width: '48px', height: '48px', objectFit: 'contain' } })
                    : item.icon && item.icon.trim().startsWith('<')
                      ? el('span', { className: 'ss-svg-preview', dangerouslySetInnerHTML: { __html: item.icon }, style: { display: 'inline-block', width: '48px', height: '48px' } })
                      : el('span', { style: { fontSize: '28px' } }, item.icon || '—')
                ),
                el('td', null, el('input', { className: 'ss-input ss-input-sm', value: item.id || '', onChange: (e) => updateField(i, 'id', e.target.value) })),
                el('td', null, el('input', { className: 'ss-input', value: item.label || '', onChange: (e) => updateField(i, 'label', e.target.value) })),
                el('td', null, el('input', { className: 'ss-input', value: item.description || '', onChange: (e) => updateField(i, 'description', e.target.value) })),
                el('td', null,
                  el('div', { className: 'ss-img-cell' },
                    el('input', { className: 'ss-input', value: item.iconUrl || '', onChange: (e) => updateField(i, 'iconUrl', e.target.value), placeholder: __('Image URL (or paste SVG below)', 'sign-selector') }),
                    el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openMediaPicker((url) => updateField(i, 'iconUrl', url)) }, __('Browse', 'sign-selector')),
                    el('textarea', { className: 'ss-input ss-svg-textarea', rows: 2, value: item.icon || '', onChange: (e) => updateField(i, 'icon', e.target.value), placeholder: __('Inline SVG code (optional)', 'sign-selector') })
                  )
                ),
                el('td', null, el(Toggle, { checked: item.enabled !== false, onChange: (v) => updateField(i, 'enabled', v) })),
                el('td', null, el('div', { className: 'ss-actions' },
                  el('button', { className: 'ss-btn ss-btn-sm', onClick: () => setExpandedFlow(expandedFlow === i ? null : i) }, expandedFlow === i ? __('Hide Flow', 'sign-selector') : __('Edit Flow', 'sign-selector')),
                  el('button', { className: 'ss-btn ss-btn-danger ss-btn-sm', onClick: () => askRemove(i) }, __('Remove', 'sign-selector'))
                ))
              ),
              expandedFlow === i && el('tr', null,
                el('td', { colSpan: 7 },
                  el('div', { className: 'ss-flow-section' },
                    el('h4', null, __('Configurator flow for: ', 'sign-selector') + (item.label || item.id)),
                    el('p', { className: 'ss-flow-hint' }, __('Check/uncheck sections and use arrows to reorder. Step 1 (Sign Style selection) is always shown first.', 'sign-selector')),
                    el(FlowEditor, {
                      flow: item.flow || defaultFlow,
                      onChange: (newFlow) => updateField(i, 'flow', newFlow)
                    })
                  )
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
    const { askRemove, confirmRemove, cancelRemove, pendingIndex, pendingLabel } = useConfirmRemove(items, setItems);

    const updateField = (index, field, value) => {
      const next = [...items];
      next[index] = { ...next[index], [field]: value };
      setItems(next);
    };

    const addItem = () => {
      setItems([...items, { id: uid(), label: '', image: '', imageUrl: '', enabled: true }]);
    };

    if (loading) return el('p', null, __('Loading…', 'sign-selector'));

    return el(Fragment, null,
      el('div', { className: 'ss-toolbar' },
        el('h2', null, __('Installation Surfaces', 'sign-selector')),
        el('button', { className: 'ss-btn ss-btn-primary', onClick: addItem }, __('+ Add Surface', 'sign-selector'))
      ),
      el('table', { className: 'ss-table' },
        el('thead', null,
          el('tr', null,
            el('th', null, __('Preview', 'sign-selector')),
            el('th', null, __('ID', 'sign-selector')),
            el('th', null, __('Label', 'sign-selector')),
            el('th', null, __('Image URL', 'sign-selector')),
            el('th', null, __('Enabled', 'sign-selector')),
            el('th', null, __('Actions', 'sign-selector'))
          )
        ),
        el('tbody', null,
          items.map((item, i) =>
            el('tr', { key: i },
              el('td', null,
                item.imageUrl
                  ? el('img', { className: 'ss-img-preview', src: item.imageUrl, alt: item.label })
                  : el('span', { className: 'ss-img-preview', style: { display: 'inline-block', background: '#eee' } })
              ),
              el('td', null, el('input', { className: 'ss-input ss-input-sm', value: item.id || '', onChange: (e) => updateField(i, 'id', e.target.value) })),
              el('td', null, el('input', { className: 'ss-input', value: item.label || '', onChange: (e) => updateField(i, 'label', e.target.value) })),
              el('td', null, el('div', { className: 'ss-img-cell' },
                el('input', { className: 'ss-input', value: item.imageUrl || '', onChange: (e) => updateField(i, 'imageUrl', e.target.value) }),
                el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openMediaPicker((url) => updateField(i, 'imageUrl', url)) }, __('Browse', 'sign-selector'))
              )),
              el('td', null, el(Toggle, { checked: item.enabled !== false, onChange: (v) => updateField(i, 'enabled', v) })),
              el('td', null, el('button', { className: 'ss-btn ss-btn-danger ss-btn-sm', onClick: () => askRemove(i) }, __('Remove', 'sign-selector')))
            )
          )
        )
      ),
      el('div', { className: 'ss-save-bar' },
        el('button', { className: 'ss-btn ss-btn-primary', onClick: () => save() }, __('Save Surfaces', 'sign-selector'))
      ),
      el(Toast, toast),
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
    const { askRemove, confirmRemove, cancelRemove, pendingIndex, pendingLabel } = useConfirmRemove(items, setItems);

    const updateField = (index, field, value) => {
      const next = [...items];
      const parsed = (field === 'width' || field === 'height' || field === 'basePrice') ? Number(value) || 0 : value;
      next[index] = { ...next[index], [field]: parsed };
      setItems(next);
    };

    const addItem = () => {
      setItems([...items, { id: uid(), label: '', width: 10, height: 5, basePrice: 0, enabled: true }]);
    };

    if (loading) return el('p', null, __('Loading…', 'sign-selector'));

    return el(Fragment, null,
      el('div', { className: 'ss-toolbar' },
        el('h2', null, __('Size & Shape', 'sign-selector')),
        el('button', { className: 'ss-btn ss-btn-primary', onClick: addItem }, __('+ Add Shape', 'sign-selector'))
      ),
      el('table', { className: 'ss-table' },
        el('thead', null,
          el('tr', null,
            el('th', null, __('ID', 'sign-selector')),
            el('th', null, __('Label', 'sign-selector')),
            el('th', null, __('Width', 'sign-selector')),
            el('th', null, __('Height', 'sign-selector')),
            el('th', null, __('Base Price ($)', 'sign-selector')),
            el('th', null, __('Enabled', 'sign-selector')),
            el('th', null, __('Actions', 'sign-selector'))
          )
        ),
        el('tbody', null,
          items.map((item, i) =>
            el('tr', { key: i },
              el('td', null, el('input', { className: 'ss-input ss-input-sm', value: item.id || '', onChange: (e) => updateField(i, 'id', e.target.value) })),
              el('td', null, el('input', { className: 'ss-input', value: item.label || '', onChange: (e) => updateField(i, 'label', e.target.value) })),
              el('td', null, el('input', { className: 'ss-input ss-input-sm', type: 'number', value: item.width ?? 0, onChange: (e) => updateField(i, 'width', e.target.value) })),
              el('td', null, el('input', { className: 'ss-input ss-input-sm', type: 'number', value: item.height ?? 0, onChange: (e) => updateField(i, 'height', e.target.value) })),
              el('td', null, el('input', { className: 'ss-input ss-input-sm', type: 'number', step: '0.01', value: item.basePrice ?? 0, onChange: (e) => updateField(i, 'basePrice', e.target.value) })),
              el('td', null, el(Toggle, { checked: item.enabled !== false, onChange: (v) => updateField(i, 'enabled', v) })),
              el('td', null, el('button', { className: 'ss-btn ss-btn-danger ss-btn-sm', onClick: () => askRemove(i) }, __('Remove', 'sign-selector')))
            )
          )
        )
      ),
      el('div', { className: 'ss-save-bar' },
        el('button', { className: 'ss-btn ss-btn-primary', onClick: () => save() }, __('Save Shapes', 'sign-selector'))
      ),
      el(Toast, toast),
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
    const [expandedRow, setExpandedRow] = useState(null);
    const [shapeIds, setShapeIds] = useState(['default']);

    // Fetch shapes dynamically so newly added shapes appear as image override slots
    useEffect(() => {
      apiFetch({ path: '/sign-selector/v1/shapes' }).then((data) => {
        const ids = (Array.isArray(data) ? data : []).map((s) => s.id).filter(Boolean);
        setShapeIds(['default'].concat(ids));
      }).catch(() => {});
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

    const addItem = () => {
      setItems([...items, { id: uid(), label: '', price: 0, imageUrl: '', images: {}, enabled: true }]);
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
            el('th', null, __('ID', 'sign-selector')),
            el('th', null, __('Label', 'sign-selector')),
            el('th', null, __('Price ($)', 'sign-selector')),
            el('th', null, __('Default Image', 'sign-selector')),
            el('th', null, __('Enabled', 'sign-selector')),
            el('th', null, __('Actions', 'sign-selector'))
          )
        ),
        el('tbody', null,
          items.map((item, i) =>
            el(Fragment, { key: i },
              el('tr', null,
                el('td', null, item.imageUrl
                  ? el('img', { className: 'ss-img-preview', src: item.imageUrl, alt: item.label })
                  : el('div', { className: 'ss-color-preview', style: { backgroundColor: '#ccc' } })
                ),
                el('td', null, el('input', { className: 'ss-input ss-input-sm', value: item.id || '', onChange: (e) => updateField(i, 'id', e.target.value) })),
                el('td', null, el('input', { className: 'ss-input', value: item.label || '', onChange: (e) => updateField(i, 'label', e.target.value) })),
                el('td', null, el('input', { className: 'ss-input ss-input-sm', type: 'number', step: '0.01', value: item.price ?? 0, onChange: (e) => updateField(i, 'price', e.target.value) })),
                el('td', null, el('div', { className: 'ss-img-cell' },
                  el('input', { className: 'ss-input', value: item.imageUrl || '', onChange: (e) => updateField(i, 'imageUrl', e.target.value), placeholder: __('Default image URL', 'sign-selector') }),
                  el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openMediaPicker((url) => updateField(i, 'imageUrl', url)) }, __('Browse', 'sign-selector'))
                )),
                el('td', null, el(Toggle, { checked: item.enabled !== false, onChange: (v) => updateField(i, 'enabled', v) })),
                el('td', null, el('div', { className: 'ss-actions' },
                  el('button', { className: 'ss-btn ss-btn-sm', onClick: () => setExpandedRow(expandedRow === i ? null : i) }, expandedRow === i ? __('Hide Shapes', 'sign-selector') : __('Shape Images', 'sign-selector')),
                  el('button', { className: 'ss-btn ss-btn-danger ss-btn-sm', onClick: () => askRemove(i) }, __('Remove', 'sign-selector'))
                ))
              ),
              expandedRow === i && el('tr', null,
                el('td', { colSpan: 7 },
                  el('div', { className: 'ss-shape-images-section' },
                    el('h4', null, __('Shape-specific image overrides for: ', 'sign-selector') + item.label),
                    el('div', { className: 'ss-shape-images-grid' },
                      shapeIds.map(shapeId =>
                        el('div', { className: 'ss-shape-img-item', key: shapeId },
                          el('label', null, shapeId),
                          item.images && item.images[shapeId]
                            ? el('img', { className: 'ss-img-preview', src: item.images[shapeId], alt: shapeId })
                            : null,
                          el('div', { className: 'ss-img-cell' },
                            el('input', {
                              className: 'ss-input',
                              value: (item.images && item.images[shapeId]) || '',
                              onChange: (e) => updateShapeImage(i, shapeId, e.target.value),
                              placeholder: __('Image URL', 'sign-selector')
                            }),
                            el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openMediaPicker((url) => updateShapeImage(i, shapeId, url)) }, __('Browse', 'sign-selector'))
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      ),
      el('div', { className: 'ss-save-bar' },
        el('button', { className: 'ss-btn ss-btn-primary', onClick: () => save() }, __('Save Slate Colors', 'sign-selector'))
      ),
      el(Toast, toast),
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
    const [shapeOptions, setShapeOptions] = useState([{ id: 'all', label: __('All Shapes', 'sign-selector') }]);
    const [signStyleOptions, setSignStyleOptions] = useState([]);
    const [editingTemplateIndex, setEditingTemplateIndex] = useState(null);

    const templateFieldOptions = [
      { id: 'topText', label: __('Top Text', 'sign-selector') },
      { id: 'houseNumber', label: __('House Number', 'sign-selector') },
      { id: 'bottomText', label: __('Bottom Text', 'sign-selector') }
    ];

    useEffect(() => {
      apiFetch({ path: '/sign-selector/v1/shapes' }).then((data) => {
        const options = (Array.isArray(data) ? data : [])
          .filter((shape) => shape && shape.id)
          .map((shape) => ({ id: shape.id, label: shape.label || shape.id }));

        setShapeOptions([{ id: 'all', label: __('All Shapes', 'sign-selector') }, ...options]);
      }).catch(() => {});

      apiFetch({ path: '/sign-selector/v1/sign-styles' }).then((data) => {
        const options = (Array.isArray(data) ? data : [])
          .filter((style) => style && style.id)
          .map((style) => ({ id: style.id, label: style.label || style.id }));

        setSignStyleOptions(options);
      }).catch(() => {});
    }, []);

    const updateField = (index, field, value) => {
      const next = [...items];
      next[index] = { ...next[index], [field]: value };
      setItems(next);
    };

    const normalizeTemplateFieldKey = (value) => {
      const normalized = String(value || '').trim().toLowerCase();

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

    const openTemplateOptions = (index) => setEditingTemplateIndex(index);
    const closeTemplateOptions = () => setEditingTemplateIndex(null);

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

    const addItem = () => {
      setItems([...items, {
        id: uid(),
        label: '',
        tier: 'Standard',
        shapeId: 'all',
        signStyleIds: signStyleOptions.map((style) => style.id),
        fields: ['houseNumber'],
        textLayout: 'number',
        imageUrl: '',
        enabled: true
      }]);
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
            el('th', null, __('ID', 'sign-selector')),
            el('th', null, __('Label', 'sign-selector')),
            el('th', null, __('Tier', 'sign-selector')),
            el('th', null, __('Shape', 'sign-selector')),
            el('th', null, __('Template Options', 'sign-selector')),
            el('th', null, __('Enabled', 'sign-selector')),
            el('th', null, __('Actions', 'sign-selector'))
          )
        ),
        el('tbody', null,
          items.map((item, i) =>
            el('tr', { key: i },
              el('td', null,
                el('div', { className: 'ss-img-cell' },
                  item.imageUrl ? el('img', { className: 'ss-img-preview', src: item.imageUrl, alt: item.label }) : null,
                  el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openMediaPicker((url) => updateField(i, 'imageUrl', url)) }, __('Browse', 'sign-selector'))
                )
              ),
              el('td', null, el('input', { className: 'ss-input ss-input-sm', value: item.id || '', onChange: (e) => updateField(i, 'id', e.target.value) })),
              el('td', null, el('input', { className: 'ss-input', value: item.label || '', onChange: (e) => updateField(i, 'label', e.target.value) })),
              el('td', null,
                el('select', { className: 'ss-input ss-input-sm', value: item.tier || 'Standard', onChange: (e) => updateField(i, 'tier', e.target.value) },
                  el('option', { value: 'Deluxe' }, 'Deluxe'),
                  el('option', { value: 'Standard' }, 'Standard')
                )
              ),
              el('td', null,
                el('select', { className: 'ss-input ss-input-sm', value: item.shapeId || 'all', onChange: (e) => updateField(i, 'shapeId', e.target.value) },
                  shapeOptions.map((shape) => el('option', { key: shape.id, value: shape.id }, shape.label))
                )
              ),
              el('td', null,
                el('div', { className: 'ss-template-config-summary' },
                  el('div', { className: 'ss-template-config-line' },
                    el('strong', null, __('Styles:', 'sign-selector') + ' '),
                    el('span', null, getStyleSummary(item))
                  ),
                  el('div', { className: 'ss-template-config-line' },
                    el('strong', null, __('Fields:', 'sign-selector') + ' '),
                    el('span', null, getFieldSummary(item))
                  ),
                  el('button', {
                    type: 'button',
                    className: 'ss-btn ss-btn-sm',
                    onClick: () => openTemplateOptions(i)
                  }, __('Configure', 'sign-selector'))
                )
              ),
              el('td', null, el(Toggle, { checked: item.enabled !== false, onChange: (v) => updateField(i, 'enabled', v) })),
              el('td', null, el('button', { className: 'ss-btn ss-btn-danger ss-btn-sm', onClick: () => askRemove(i) }, __('Remove', 'sign-selector')))
            )
          )
        )
      ),
      el('div', { className: 'ss-save-bar' },
        el('button', { className: 'ss-btn ss-btn-primary', onClick: saveTemplates }, __('Save Templates', 'sign-selector'))
      ),
      el(Toast, toast),
      editingTemplateIndex !== null && items[editingTemplateIndex] && el('div', { className: 'ss-modal-overlay', onClick: closeTemplateOptions },
        el('div', { className: 'ss-modal ss-template-options-modal', onClick: (e) => e.stopPropagation() },
          el('h3', { className: 'ss-template-options-title' }, __('Template Options', 'sign-selector')),
          el('p', { className: 'ss-template-options-subtitle' }, items[editingTemplateIndex].label || items[editingTemplateIndex].id || __('Template', 'sign-selector')),
          el('div', { className: 'ss-template-options-grid' },
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

    const updateField = (index, field, value) => {
      const next = [...items];
      next[index] = { ...next[index], [field]: value };
      setItems(next);
    };

    const addItem = () => {
      setItems([...items, { id: uid(), label: '', hex: '#ffffff', price: 0, image: '', imageUrl: '', enabled: true }]);
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
            el('th', null, __('Image', 'sign-selector')),
            el('th', null, __('ID', 'sign-selector')),
            el('th', null, __('Label', 'sign-selector')),
            el('th', null, __('Hex', 'sign-selector')),
            el('th', null, __('Enabled', 'sign-selector')),
            el('th', null, __('Actions', 'sign-selector'))
          )
        ),
        el('tbody', null,
          items.map((item, i) =>
            el('tr', { key: i },
              el('td', null, el('div', { className: 'ss-color-preview', style: { backgroundColor: item.hex || '#ccc' } })),
              el('td', null,
                el('div', { className: 'ss-img-cell' },
                  item.imageUrl ? el('img', { className: 'ss-img-preview', src: item.imageUrl, alt: item.label }) : null,
                  el('button', { className: 'ss-btn ss-btn-sm', onClick: () => openMediaPicker((url) => updateField(i, 'imageUrl', url)) }, __('Browse', 'sign-selector'))
                )
              ),
              el('td', null, el('input', { className: 'ss-input ss-input-sm', value: item.id || '', onChange: (e) => updateField(i, 'id', e.target.value) })),
              el('td', null, el('input', { className: 'ss-input', value: item.label || '', onChange: (e) => updateField(i, 'label', e.target.value) })),
              el('td', null, el('input', { className: 'ss-input ss-input-sm', type: 'color', value: item.hex || '#ffffff', onChange: (e) => updateField(i, 'hex', e.target.value) })),
              el('td', null, el(Toggle, { checked: item.enabled !== false, onChange: (v) => updateField(i, 'enabled', v) })),
              el('td', null, el('button', { className: 'ss-btn ss-btn-danger ss-btn-sm', onClick: () => askRemove(i) }, __('Remove', 'sign-selector')))
            )
          )
        )
      ),
      el('div', { className: 'ss-save-bar' },
        el('button', { className: 'ss-btn ss-btn-primary', onClick: savePaintColors }, __('Save Paint Colors', 'sign-selector'))
      ),
      el(Toast, toast),
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

    const updateField = (index, field, value) => {
      const next = [...items];
      const parsed = field === 'price' ? Number(value) || 0 : value;
      next[index] = { ...next[index], [field]: parsed };
      setItems(next);
    };

    const addItem = () => {
      setItems([...items, { id: uid(), label: '', price: 0, enabled: true }]);
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
            el('th', null, __('ID', 'sign-selector')),
            el('th', null, __('Label', 'sign-selector')),
            el('th', null, __('Price ($)', 'sign-selector')),
            el('th', null, __('Enabled', 'sign-selector')),
            el('th', null, __('Actions', 'sign-selector'))
          )
        ),
        el('tbody', null,
          items.map((item, i) =>
            el('tr', { key: i },
              el('td', null, el('input', { className: 'ss-input ss-input-sm', value: item.id || '', onChange: (e) => updateField(i, 'id', e.target.value) })),
              el('td', null, el('input', { className: 'ss-input', value: item.label || '', onChange: (e) => updateField(i, 'label', e.target.value) })),
              el('td', null, el('input', { className: 'ss-input ss-input-sm', type: 'number', step: '0.01', value: item.price ?? 0, onChange: (e) => updateField(i, 'price', e.target.value) })),
              el('td', null, el(Toggle, { checked: item.enabled !== false, onChange: (v) => updateField(i, 'enabled', v) })),
              el('td', null, el('button', { className: 'ss-btn ss-btn-danger ss-btn-sm', onClick: () => askRemove(i) }, __('Remove', 'sign-selector')))
            )
          )
        )
      ),
      el('div', { className: 'ss-save-bar' },
        el('button', { className: 'ss-btn ss-btn-primary', onClick: () => save() }, __('Save Add-ons', 'sign-selector'))
      ),
      el(Toast, toast),
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

    const updateField = (index, field, value) => {
      const next = [...items];
      const parsed = field === 'price' ? Number(value) || 0 : value;
      next[index] = { ...next[index], [field]: parsed };
      setItems(next);
    };

    const addItem = () => {
      setItems([...items, { id: uid(), label: '', price: 0, enabled: true }]);
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
            el('th', null, __('ID', 'sign-selector')),
            el('th', null, __('Label', 'sign-selector')),
            el('th', null, __('Price ($)', 'sign-selector')),
            el('th', null, __('Enabled', 'sign-selector')),
            el('th', null, __('Actions', 'sign-selector'))
          )
        ),
        el('tbody', null,
          items.map((item, i) =>
            el('tr', { key: i },
              el('td', null, el('input', { className: 'ss-input ss-input-sm', value: item.id || '', onChange: (e) => updateField(i, 'id', e.target.value) })),
              el('td', null, el('input', { className: 'ss-input', value: item.label || '', onChange: (e) => updateField(i, 'label', e.target.value) })),
              el('td', null, el('input', { className: 'ss-input ss-input-sm', type: 'number', step: '0.01', value: item.price ?? 0, onChange: (e) => updateField(i, 'price', e.target.value) })),
              el('td', null, el(Toggle, { checked: item.enabled !== false, onChange: (v) => updateField(i, 'enabled', v) })),
              el('td', null, el('button', { className: 'ss-btn ss-btn-danger ss-btn-sm', onClick: () => askRemove(i) }, __('Remove', 'sign-selector')))
            )
          )
        )
      ),
      el('div', { className: 'ss-save-bar' },
        el('button', { className: 'ss-btn ss-btn-primary', onClick: () => save() }, __('Save Hardware', 'sign-selector'))
      ),
      el(Toast, toast),
      pendingIndex !== null && el(ConfirmModal, {
        message: __('Are you sure you want to remove', 'sign-selector') + ' "' + pendingLabel + '"?',
        onConfirm: confirmRemove,
        onCancel: cancelRemove
      })
    );
  };

  /* ─── App shell ───────────────────────────────────────── */

  const TABS = [
    { key: 'steps',      label: __('Steps', 'sign-selector'),          component: StepsTab },
    { key: 'styles',     label: __('Sign Styles', 'sign-selector'),    component: SignStylesTab },
    { key: 'surfaces',   label: __('Surfaces', 'sign-selector'),       component: SurfacesTab },
    { key: 'shapes',     label: __('Shapes & Sizes', 'sign-selector'), component: ShapesTab },
    { key: 'slates',     label: __('Slate Colors', 'sign-selector'),   component: SlateColorsTab },
    { key: 'templates',  label: __('Templates', 'sign-selector'),      component: DesignTemplatesTab },
    { key: 'paints',     label: __('Paint Colors', 'sign-selector'),   component: PaintColorsTab },
    { key: 'addons',     label: __('Add-ons', 'sign-selector'),        component: AddonsTab },
    { key: 'hardware',   label: __('Hardware', 'sign-selector'),       component: MountingHardwareTab },
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
